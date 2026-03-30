import Phaser from 'phaser'
import { createInitialBoard, swapBoardCells } from '../boardModel'
import { BOARD_COLUMNS, BOARD_PADDING, BOARD_ROWS, CELL_SIZE } from '../constants'
import type { BoardState, GemType, GridPosition } from '../types'

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
  private gemViews: GemView[][] = []
  private selectedGem: GemView | null = null
  private isSwapping = false
  private boardLeft = 0
  private boardTop = 0

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

    this.add
      .text(width / 2, 36, 'Match-3 Start Board', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '28px',
        color: '#fff4d6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height - 28, 'Stage 3: select gems and swap adjacent cells', {
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
      const viewRow: GemView[] = []

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

        const gem = this.add.rectangle(
          centerX,
          centerY,
          CELL_SIZE - 14,
          CELL_SIZE - 14,
          GEM_COLORS[gemType],
          0.96,
        )
        gem.setStrokeStyle(3, 0xffffff, 0.18)
        gem.setRotation(Phaser.Math.DegToRad(45))
        gem.setInteractive({ useHandCursor: true })

        if ((position.row + position.column) % 2 === 0) {
          gem.y -= 1
        }

        const gemView: GemView = {
          position: { ...position },
          gemType,
          sprite: gem,
        }

        gem.on('pointerdown', () => {
          this.handleGemSelection(gemView)
        })

        viewRow.push(gemView)
      }

      this.gemViews.push(viewRow)
    }
  }

  private handleGemSelection(gemView: GemView): void {
    if (this.isSwapping) {
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
        const isSelected = this.selectedGem === gemView
        gemView.sprite.setStrokeStyle(3, 0xffffff, isSelected ? 0.95 : 0.18)
        gemView.sprite.setScale(isSelected ? 1.08 : 1)
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

  private async swapSelectedGems(first: GemView, second: GemView): Promise<void> {
    this.isSwapping = true

    const firstPosition = { ...first.position }
    const secondPosition = { ...second.position }

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

    this.isSwapping = false
  }
}
