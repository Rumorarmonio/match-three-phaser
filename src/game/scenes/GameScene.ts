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
  BoardSettings,
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

type GameSceneData = {
  boardColumns?: number
  boardRows?: number
}

const BOARD_SIZE_OPTIONS = [6, 8, 10] as const

export class GameScene extends Phaser.Scene {
  private boardState: BoardState = []
  private gemViews: Array<Array<GemView | null>> = []
  private selectedGem: GemView | null = null
  private matchedGemKeys = new Set<string>()
  private isBoardBusy = false
  private draggedGem: GemView | null = null
  private dragStartPointerPosition: { x: number; y: number } | null = null
  private dragPreviewTargetGem: GemView | null = null
  private boardLeft = 0
  private boardTop = 0
  private boardColumns = BOARD_COLUMNS
  private boardRows = BOARD_ROWS
  private score = 0
  private scoreText!: Phaser.GameObjects.Text
  private boardSizeText!: Phaser.GameObjects.Text

  constructor() {
    super('game')
  }

  create(data: GameSceneData = {}): void {
    this.initializeBoardSettings(data)
    this.initializeGameState()

    const { width, height } = this.scale
    const boardWidth = this.boardColumns * CELL_SIZE + BOARD_PADDING * 2
    const boardHeight = this.boardRows * CELL_SIZE + BOARD_PADDING * 2
    const boardTopOffset = 64
    this.boardLeft = Math.round((width - boardWidth) / 2)
    this.boardTop = Math.round((height - boardHeight) / 2) - boardTopOffset

    this.drawBackground(width, height)
    this.drawBoardFrame(this.boardLeft, this.boardTop, boardWidth, boardHeight)
    this.drawBoard(this.boardState, this.boardLeft + BOARD_PADDING, this.boardTop + BOARD_PADDING)
    this.registerDragHandlers()
    this.createScoreText()
    this.createBoardSizeControls()
    this.createRestartButton()

    this.add
      .text(width / 2, height - 28, 'Stage 12: runtime board size controls', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '16px',
        color: '#f7efe6',
      })
      .setOrigin(0.5)
  }

  private initializeBoardSettings(data: GameSceneData): void {
    this.boardColumns = data.boardColumns ?? BOARD_COLUMNS
    this.boardRows = data.boardRows ?? BOARD_ROWS
  }

  private initializeGameState(): void {
    this.boardState = createInitialBoard(this.getBoardSettings())
    this.gemViews = []
    this.selectedGem = null
    this.matchedGemKeys.clear()
    this.isBoardBusy = false
    this.draggedGem = null
    this.dragStartPointerPosition = null
    this.dragPreviewTargetGem = null
    this.score = 0
  }

  private getBoardSettings(): BoardSettings {
    return {
      rows: this.boardRows,
      columns: this.boardColumns,
    }
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

  private getCellSpritePosition(position: GridPosition): { x: number; y: number } {
    const cellCenter = this.getCellCenter(position)

    return {
      x: cellCenter.x,
      y: (position.row + position.column) % 2 === 0 ? cellCenter.y - 1 : cellCenter.y,
    }
  }

  private resetDragPreviewTarget(): void {
    if (!this.dragPreviewTargetGem) {
      return
    }

    const cellPosition = this.getCellSpritePosition(this.dragPreviewTargetGem.position)
    this.dragPreviewTargetGem.sprite.x = cellPosition.x
    this.dragPreviewTargetGem.sprite.y = cellPosition.y
    this.dragPreviewTargetGem = null
  }

  private registerDragHandlers(): void {
    this.input.off('dragstart')
    this.input.off('drag')
    this.input.off('dragend')

    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      const gemView = gameObject.getData('gemView') as GemView | undefined

      if (!gemView || this.isBoardBusy) {
        return
      }

      this.draggedGem = gemView
      this.dragStartPointerPosition = { x: gemView.sprite.x, y: gemView.sprite.y }
      this.selectedGem = gemView
      gemView.sprite.setDepth(2)
      this.updateSelectionState()
    })

    this.input.on(
      'drag',
      (
        pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.GameObject,
      ) => {
        const gemView = gameObject.getData('gemView') as GemView | undefined

        if (!gemView || this.draggedGem !== gemView || this.isBoardBusy) {
          return
        }

        const { x, y } = this.getDraggedGemPosition(pointer)
        gemView.sprite.x = x
        gemView.sprite.y = y
        this.updateDragPreviewTarget(gemView)
      },
    )

    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      const gemView = gameObject.getData('gemView') as GemView | undefined

      if (!gemView || this.draggedGem !== gemView) {
        return
      }

      gemView.sprite.setDepth(1)

      const targetGem = this.getDragSwapTarget(gemView)
      this.draggedGem = null
      this.dragStartPointerPosition = null

      if (!targetGem) {
        this.resetDragPreviewTarget()
        void this.animateGemMove(gemView, gemView.position)
        this.updateSelectionState()
        return
      }

      this.dragPreviewTargetGem = null
      void this.swapSelectedGems(gemView, targetGem)
    })
  }

  private getDraggedGemPosition(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    if (!this.draggedGem || !this.dragStartPointerPosition) {
      return { x: pointer.x, y: pointer.y }
    }

    const dragOffsetX = pointer.x - this.dragStartPointerPosition.x
    const dragOffsetY = pointer.y - this.dragStartPointerPosition.y
    const isHorizontal = Math.abs(dragOffsetX) >= Math.abs(dragOffsetY)
    const maxOffset = CELL_SIZE

    if (isHorizontal) {
      return {
        x: this.dragStartPointerPosition.x + Phaser.Math.Clamp(dragOffsetX, -maxOffset, maxOffset),
        y: this.dragStartPointerPosition.y,
      }
    }

    return {
      x: this.dragStartPointerPosition.x,
      y: this.dragStartPointerPosition.y + Phaser.Math.Clamp(dragOffsetY, -maxOffset, maxOffset),
    }
  }

  private getDragSwapTarget(gemView: GemView): GemView | null {
    if (!this.dragStartPointerPosition) {
      return null
    }

    const dragOffsetX = gemView.sprite.x - this.dragStartPointerPosition.x
    const dragOffsetY = gemView.sprite.y - this.dragStartPointerPosition.y
    const minimumSwapDistance = CELL_SIZE * 0.35

    if (Math.max(Math.abs(dragOffsetX), Math.abs(dragOffsetY)) < minimumSwapDistance) {
      return null
    }

    const targetPosition = { ...gemView.position }

    if (Math.abs(dragOffsetX) >= Math.abs(dragOffsetY)) {
      targetPosition.column += dragOffsetX > 0 ? 1 : -1
    } else {
      targetPosition.row += dragOffsetY > 0 ? 1 : -1
    }

    if (
      targetPosition.row < 0 ||
      targetPosition.row >= this.boardRows ||
      targetPosition.column < 0 ||
      targetPosition.column >= this.boardColumns
    ) {
      return null
    }

    return this.gemViews[targetPosition.row][targetPosition.column]
  }

  private updateDragPreviewTarget(gemView: GemView): void {
    if (!this.dragStartPointerPosition) {
      return
    }

    const targetGem = this.getDragSwapTarget(gemView)

    if (targetGem !== this.dragPreviewTargetGem) {
      this.resetDragPreviewTarget()
      this.dragPreviewTargetGem = targetGem
    }

    if (!targetGem) {
      return
    }

    const targetCellPosition = this.getCellSpritePosition(targetGem.position)
    const previewOffsetX = this.dragStartPointerPosition.x - gemView.sprite.x
    const previewOffsetY = this.dragStartPointerPosition.y - gemView.sprite.y

    targetGem.sprite.x = targetCellPosition.x + previewOffsetX
    targetGem.sprite.y = targetCellPosition.y + previewOffsetY
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
    this.input.setDraggable(gem)
    gem.setDepth(1)

    const gemView: GemView = {
      position: { ...position },
      gemType,
      sprite: gem,
    }

    gem.setData('gemView', gemView)

    gem.on('pointerdown', () => {
      if (this.draggedGem === gemView) {
        return
      }

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

  private createBoardSizeControls(): void {
    this.add.text(28, 96, 'Board', {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif',
      fontSize: '18px',
      color: '#f7b267',
      fontStyle: 'bold',
    })

    const decreaseColumnsButton = this.createBoardSizeButton(28, 124, '-C')
    decreaseColumnsButton.on('pointerdown', () => {
      this.changeBoardSize('columns', -1)
    })

    this.boardSizeText = this.add.text(85, 142, '', {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif',
      fontSize: '18px',
      color: '#fff4d6',
    })

    const increaseColumnsButton = this.createBoardSizeButton(218, 124, '+C')
    increaseColumnsButton.on('pointerdown', () => {
      this.changeBoardSize('columns', 1)
    })

    const decreaseRowsButton = this.createBoardSizeButton(28, 160, '-R')
    decreaseRowsButton.on('pointerdown', () => {
      this.changeBoardSize('rows', -1)
    })

    const increaseRowsButton = this.createBoardSizeButton(218, 160, '+R')
    increaseRowsButton.on('pointerdown', () => {
      this.changeBoardSize('rows', 1)
    })

    this.updateBoardSizeText()
  }

  private createBoardSizeButton(
    x: number,
    y: number,
    label: string,
  ): Phaser.GameObjects.Text {
    const button = this.add
      .text(x, y, label, {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '16px',
        color: '#24173f',
        backgroundColor: '#f7b267',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })

    button.on('pointerover', () => {
      button.setStyle({ backgroundColor: '#ffd08a' })
    })

    button.on('pointerout', () => {
      button.setStyle({ backgroundColor: '#f7b267' })
    })

    return button
  }

  private updateBoardSizeText(): void {
    this.boardSizeText.setText(`${this.boardColumns} cols x ${this.boardRows} rows`)
  }

  private changeBoardSize(axis: 'columns' | 'rows', direction: -1 | 1): void {
    if (this.isBoardBusy) {
      return
    }

    const currentValue = axis === 'columns' ? this.boardColumns : this.boardRows
    const optionIndex = (BOARD_SIZE_OPTIONS as readonly number[]).indexOf(currentValue)
    const nextIndex = Phaser.Math.Clamp(optionIndex + direction, 0, BOARD_SIZE_OPTIONS.length - 1)
    const nextValue = BOARD_SIZE_OPTIONS[nextIndex]

    if (nextValue === currentValue) {
      return
    }

    const nextBoardColumns = axis === 'columns' ? nextValue : this.boardColumns
    const nextBoardRows = axis === 'rows' ? nextValue : this.boardRows

    this.scene.restart({
      boardColumns: nextBoardColumns,
      boardRows: nextBoardRows,
    })
  }

  private createRestartButton(): void {
    const button = this.add
      .text(28, 198, 'Restart', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '18px',
        color: '#24173f',
        backgroundColor: '#f7b267',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })

    button.on('pointerdown', () => {
      this.scene.restart({
        boardColumns: this.boardColumns,
        boardRows: this.boardRows,
      })
    })

    button.on('pointerover', () => {
      button.setStyle({ backgroundColor: '#ffd08a' })
    })

    button.on('pointerout', () => {
      button.setStyle({ backgroundColor: '#f7b267' })
    })
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

      const fallMoves = applyGravity(this.boardState, this.getBoardSettings())
      await this.animateGravity(fallMoves)

      const refillMoves = refillBoard(this.boardState, this.getBoardSettings())
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
