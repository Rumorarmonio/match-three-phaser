import Phaser from 'phaser'
import {
  applyGravity,
  clearMatchedCells,
  createInitialBoard,
  refillBoard,
  swapBoardCells,
} from '../boardModel'
import { BOARD_COLUMNS, BOARD_PADDING, BOARD_ROWS, CELL_SIZE } from '../constants'
import { findMatches } from '../matchFinder'
import type {
  BoardState,
  FallMove,
  GemType,
  GridPosition,
  MatchGroup,
  RefillMove,
} from '../types'

const GEM_COLORS: Record<GemType, number> = {
  ruby: 0xff5d8f,
  amber: 0xf7b267,
  lime: 0x7ae582,
  cyan: 0x55d6ff,
  violet: 0xc77dff,
}

type GemView = {
  position: GridPosition
  gemType: GemType
  sprite: Phaser.GameObjects.Rectangle
}

export class GameScene extends Phaser.Scene {
  private boardState: BoardState = []
  private gemViews: Array<Array<GemView | null>> = []
  private selectedGem: GemView | null = null
  private matchedGemKeys = new Set<string>()
  private isBoardBusy = false
  private boardLeft = 0
  private boardTop = 0
  private score = 0
  private scoreText!: Phaser.GameObjects.Text

  constructor() {
    super('game')
  }

  create(): void {
    const { width, height } = this.scale
    const boardWidth = BOARD_COLUMNS * CELL_SIZE + BOARD_PADDING * 2
    const boardHeight = BOARD_ROWS * CELL_SIZE + BOARD_PADDING * 2
    this.boardLeft = Math.round((width - boardWidth) / 2)
    this.boardTop = Math.round((height - boardHeight) / 2)
    this.boardState = createInitialBoard()

    this.drawBackground(width, height)
    this.drawBoardFrame(this.boardLeft, this.boardTop, boardWidth, boardHeight)
    this.drawBoard(this.boardState, this.boardLeft + BOARD_PADDING, this.boardTop + BOARD_PADDING)
    this.createScoreText()

    this.add
      .text(width / 2, 36, 'Match-3 Start Board', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '28px',
        color: '#fff4d6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height - 28, 'Stage 8: resolve cascades and lock input during move', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '16px',
        color: '#f7efe6',
      })
      .setOrigin(0.5)
  }

  private drawBackground(width: number, height: number): void {
    const background = this.add.graphics()
    background.fillGradientStyle(0x2a1d45, 0x2a1d45, 0x120d24, 0x120d24, 1)
    background.fillRect(0, 0, width, height)

    const glow = this.add.graphics()
    glow.fillStyle(0xffc857, 0.14)
    glow.fillCircle(width * 0.18, height * 0.22, 130)
    glow.fillStyle(0x55d6ff, 0.12)
    glow.fillCircle(width * 0.84, height * 0.28, 160)
  }

  private drawBoardFrame(
    boardLeft: number,
    boardTop: number,
    boardWidth: number,
    boardHeight: number,
  ): void {
    const shadow = this.add.rectangle(
      boardLeft + boardWidth / 2,
      boardTop + boardHeight / 2,
      boardWidth + 22,
      boardHeight + 22,
      0x000000,
      0.22,
    )
    shadow.setStrokeStyle(2, 0xffffff, 0.06)

    const board = this.add.rectangle(
      boardLeft + boardWidth / 2,
      boardTop + boardHeight / 2,
      boardWidth,
      boardHeight,
      0x24173f,
      0.94,
    )
    board.setStrokeStyle(4, 0xf7b267, 0.8)
  }

  private drawBoard(boardState: BoardState, gridLeft: number, gridTop: number): void {
    this.gemViews = []

    for (let row = 0; row < boardState.length; row += 1) {
      const viewRow: Array<GemView | null> = []

      for (let column = 0; column < boardState[row].length; column += 1) {
        const position: GridPosition = { row, column }
        const gemType = boardState[row][column]
        const centerX = gridLeft + column * CELL_SIZE + CELL_SIZE / 2
        const centerY = gridTop + row * CELL_SIZE + CELL_SIZE / 2

        const cell = this.add.rectangle(
          centerX,
          centerY,
          CELL_SIZE - 4,
          CELL_SIZE - 4,
          0x1a1230,
          0.85,
        )
        cell.setStrokeStyle(1, 0xffffff, 0.08)
        cell.setDepth(0)

        if (gemType === null) {
          viewRow.push(null)
          continue
        }

        const gemView = this.createGemView(position, gemType)
        viewRow.push(gemView)
      }

      this.gemViews.push(viewRow)
    }
  }

  private handleGemSelection(gemView: GemView): void {
    if (this.isBoardBusy) {
      return
    }

    if (!this.selectedGem) {
      this.selectedGem = gemView
      this.updateSelectionState()
      return
    }

    if (this.selectedGem === gemView) {
      this.selectedGem = null
      this.updateSelectionState()
      return
    }

    if (!this.areAdjacent(this.selectedGem.position, gemView.position)) {
      this.selectedGem = gemView
      this.updateSelectionState()
      return
    }

    void this.swapSelectedGems(this.selectedGem, gemView)
  }

  private updateSelectionState(): void {
    for (const row of this.gemViews) {
      for (const gemView of row) {
        if (!gemView) {
          continue
        }

        const isSelected = this.selectedGem === gemView
        const isMatched = this.matchedGemKeys.has(this.getPositionKey(gemView.position))
        const strokeColor = isSelected ? 0xfff4d6 : isMatched ? 0x7ae582 : 0xffffff
        const strokeAlpha = isSelected ? 0.95 : isMatched ? 0.92 : 0.18
        const scale = isSelected ? 1.08 : isMatched ? 1.04 : 1

        gemView.sprite.setStrokeStyle(3, strokeColor, strokeAlpha)
        gemView.sprite.setScale(scale)
      }
    }
  }

  private areAdjacent(first: GridPosition, second: GridPosition): boolean {
    const rowDistance = Math.abs(first.row - second.row)
    const columnDistance = Math.abs(first.column - second.column)

    return rowDistance + columnDistance === 1
  }

  private getCellCenter(position: GridPosition): { x: number; y: number } {
    const gridLeft = this.boardLeft + BOARD_PADDING
    const gridTop = this.boardTop + BOARD_PADDING

    return {
      x: gridLeft + position.column * CELL_SIZE + CELL_SIZE / 2,
      y: gridTop + position.row * CELL_SIZE + CELL_SIZE / 2,
    }
  }

  private animateGemMove(gemView: GemView, target: GridPosition): Promise<void> {
    const cellCenter = this.getCellCenter(target)
    const targetY = (target.row + target.column) % 2 === 0 ? cellCenter.y - 1 : cellCenter.y

    return new Promise((resolve) => {
      this.tweens.add({
        targets: gemView.sprite,
        x: cellCenter.x,
        y: targetY,
        duration: 160,
        ease: 'Sine.easeInOut',
        onComplete: () => resolve(),
      })
    })
  }

  private createGemView(position: GridPosition, gemType: GemType): GemView {
    const cellCenter = this.getCellCenter(position)
    const gem = this.add.rectangle(
      cellCenter.x,
      (position.row + position.column) % 2 === 0 ? cellCenter.y - 1 : cellCenter.y,
      CELL_SIZE - 14,
      CELL_SIZE - 14,
      GEM_COLORS[gemType],
      0.96,
    )
    gem.setStrokeStyle(3, 0xffffff, 0.18)
    gem.setRotation(Phaser.Math.DegToRad(45))
    gem.setInteractive({ useHandCursor: true })
    gem.setDepth(1)

    const gemView: GemView = {
      position: { ...position },
      gemType,
      sprite: gem,
    }

    gem.on('pointerdown', () => {
      this.handleGemSelection(gemView)
    })

    return gemView
  }

  private createScoreText(): void {
    this.scoreText = this.add.text(28, 28, '', {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif',
      fontSize: '24px',
      color: '#fff4d6',
      fontStyle: 'bold',
    })

    this.updateScoreText()
  }

  private updateScoreText(): void {
    this.scoreText.setText(`Score: ${this.score}`)
  }

  private getPositionKey(position: GridPosition): string {
    return `${position.row}:${position.column}`
  }

  private setMatchedState(matches: MatchGroup[]): void {
    this.matchedGemKeys = new Set(
      matches.flatMap((match) => match.map((position) => this.getPositionKey(position))),
    )
    this.updateSelectionState()
  }

  private async removeMatchedGems(matches: MatchGroup[]): Promise<void> {
    const uniquePositions = Array.from(
      new Set(matches.flatMap((match) => match.map((position) => this.getPositionKey(position)))),
    ).map((key) => {
      const [row, column] = key.split(':').map(Number)
      return { row, column }
    })

    const matchedSprites = uniquePositions
      .map((position) => this.gemViews[position.row][position.column]?.sprite)
      .filter((sprite): sprite is Phaser.GameObjects.Rectangle => Boolean(sprite))

    await new Promise<void>((resolve) => {
      if (matchedSprites.length === 0) {
        resolve()
        return
      }

      this.tweens.add({
        targets: matchedSprites,
        alpha: 0,
        scale: 0.7,
        duration: 180,
        ease: 'Sine.easeInOut',
        onComplete: () => resolve(),
      })
    })

    clearMatchedCells(this.boardState, matches)

    for (const position of uniquePositions) {
      const gemView = this.gemViews[position.row][position.column]

      if (!gemView) {
        continue
      }

      gemView.sprite.destroy()
      this.gemViews[position.row][position.column] = null
    }

    this.score += uniquePositions.length * 10
    this.matchedGemKeys.clear()
    this.updateScoreText()
    this.updateSelectionState()
  }

  private async resolveBoardCascades(): Promise<void> {
    while (true) {
      const matches = findMatches(this.boardState)

      if (matches.length === 0) {
        this.matchedGemKeys.clear()
        this.updateSelectionState()
        return
      }

      this.setMatchedState(matches)
      await this.removeMatchedGems(matches)

      const fallMoves = applyGravity(this.boardState)
      await this.animateGravity(fallMoves)

      const refillMoves = refillBoard(this.boardState)
      await this.animateRefill(refillMoves)
    }
  }

  private async animateGravity(moves: FallMove[]): Promise<void> {
    if (moves.length === 0) {
      return
    }

    const animatedMoves = moves
      .map((move) => {
        const gemView = this.gemViews[move.from.row][move.from.column]

        if (!gemView) {
          return null
        }

        this.gemViews[move.from.row][move.from.column] = null
        this.gemViews[move.to.row][move.to.column] = gemView
        gemView.position = { ...move.to }

        return this.animateGemMove(gemView, move.to)
      })
      .filter((animation): animation is Promise<void> => Boolean(animation))

    await Promise.all(animatedMoves)
    this.updateSelectionState()
  }

  private async animateRefill(moves: RefillMove[]): Promise<void> {
    if (moves.length === 0) {
      return
    }

    const animations = moves.map((move) => {
      const gemView = this.createGemView(move.to, move.gemType)
      const spawnPosition = { row: move.spawnRow, column: move.to.column }
      const spawnCenter = this.getCellCenter(spawnPosition)

      gemView.sprite.x = spawnCenter.x
      gemView.sprite.y = (move.spawnRow + move.to.column) % 2 === 0 ? spawnCenter.y - 1 : spawnCenter.y

      this.gemViews[move.to.row][move.to.column] = gemView

      return this.animateGemMove(gemView, move.to)
    })

    await Promise.all(animations)
    this.updateSelectionState()
  }

  private async swapSelectedGems(first: GemView, second: GemView): Promise<void> {
    this.isBoardBusy = true

    try {
      const firstPosition = { ...first.position }
      const secondPosition = { ...second.position }
      this.matchedGemKeys.clear()

      this.selectedGem = null
      this.updateSelectionState()

      swapBoardCells(this.boardState, firstPosition, secondPosition)

      this.gemViews[firstPosition.row][firstPosition.column] = second
      this.gemViews[secondPosition.row][secondPosition.column] = first

      first.position = secondPosition
      second.position = firstPosition

      await Promise.all([
        this.animateGemMove(first, secondPosition),
        this.animateGemMove(second, firstPosition),
      ])

      const matches = findMatches(this.boardState)

      if (matches.length === 0) {
        swapBoardCells(this.boardState, secondPosition, firstPosition)

        this.gemViews[firstPosition.row][firstPosition.column] = first
        this.gemViews[secondPosition.row][secondPosition.column] = second

        first.position = firstPosition
        second.position = secondPosition

        await Promise.all([
          this.animateGemMove(first, firstPosition),
          this.animateGemMove(second, secondPosition),
        ])
      } else {
        await this.resolveBoardCascades()
      }
    } finally {
      this.isBoardBusy = false
    }
  }
}
