import Phaser from 'phaser'
import {
  applyGravity,
  clearMatchedCells,
  createInitialBoard,
  refillBoard,
  swapBoardCells,
} from '../boardModel'
import {
  BOARD_COLUMNS,
  BOARD_PADDING,
  BOARD_ROWS,
  CELL_SIZE,
  DEFAULT_GEM_TYPE_COUNT,
  GEM_TYPES,
  MIN_GEM_TYPE_COUNT,
} from '../constants'
import { findMatches } from '../matchFinder'
import type { BoardState, BoardSettings, FallMove, GemType, GridPosition, MatchGroup, RefillMove } from '../types'

type GemView = {
  position: GridPosition
  gemType: GemType
  sprite: Phaser.GameObjects.Image
  highlight: Phaser.GameObjects.Rectangle
  positionTween: Phaser.Tweens.Tween | null
}

type GameSceneData = {
  boardColumns?: number
  boardRows?: number
  gemTypeCount?: number
  boardState?: BoardState
  score?: number
}

type BackgroundMusicSound = Phaser.Sound.BaseSound & {
  setLoop(value: boolean): Phaser.Sound.BaseSound
  setVolume(value: number): Phaser.Sound.BaseSound
}

const MIN_BOARD_SIZE = 6
const MAX_BOARD_SIZE = 16
const SWAP_SOUND_KEY = 'swap-sound'
const MATCH_SOUND_KEY = 'match-sound'
const BACKGROUND_MUSIC_KEY = 'background-music'
const GEMS_SPRITE_SHEET_KEY = 'gems-sprite-sheet'
const BUBBLE_PARTICLE_TEXTURE_KEY = 'bubble-particle'
const DEFAULT_BACKGROUND_MUSIC_VOLUME = 0.06
const MUSIC_VOLUME_TRACK_WIDTH = 190
const BACKGROUND_MUSIC_VOLUME_REGISTRY_KEY = 'backgroundMusicVolume'
const BACKGROUND_MUSIC_MUTED_REGISTRY_KEY = 'backgroundMusicMuted'
const MATCH_SOUND_CASCADE_DETUNE_STEP = 120
const DESKTOP_LAYOUT_BREAKPOINT = 900
const DESKTOP_CONTROLS_WIDTH = 320
const DESKTOP_CONTROLS_INNER_OFFSET = 28
const SCENE_PADDING = 16
const BOARD_TO_CONTROLS_GAP = 18
const DESKTOP_TITLE_HEIGHT = 104
const CONTROL_SECTION_GAP = 30
const CONTROL_LABEL_TO_ROWS_GAP = 28
const CONTROL_ROW_GAP = 36
const SCORE_TO_RESTART_GAP = 16
const RESTART_TO_SECTION_GAP = 26
const MUSIC_LABEL_TO_TRACK_GAP = 34
const MUSIC_TRACK_TO_BUTTON_GAP = 20
const BOARD_SIZE_VALUE_OFFSET = 32
const GEM_TYPE_VALUE_OFFSET = 14
const SCORE_TEXT_HEIGHT = 30
const SECTION_LABEL_HEIGHT = 22
const VALUE_TEXT_HEIGHT = 22
const CONTROL_BUTTON_HEIGHT = 30
const MUSIC_BUTTON_HEIGHT = 30
const BOARD_FRAME_RADIUS = 20
const GEM_SELECTION_ANIMATION_DURATION = 140
const DRAG_RETURN_ANIMATION_DURATION = 120
const DRAG_PREVIEW_ANIMATION_DURATION = 75
const MATCH_BUBBLE_BASE_COUNT = 6
const MATCH_BUBBLE_PER_GEM = 3
const MATCH_BUBBLE_MAX_COUNT = 32
const GEM_DRAG_DISTANCE_THRESHOLD = 12
const BUBBLE_TINT_BY_GEM_TYPE: Record<GemType, number> = {
  ruby: 0xff6b7c,
  cyan: 0x71e5ff,
  amber: 0xffc65c,
  lime: 0xa6f26a,
  violet: 0xc89bff,
  rose: 0xff8fc3,
}
const GEM_SPRITE_FRAME_BY_TYPE: Record<GemType, number> = {
  ruby: 0,
  cyan: 1,
  amber: 2,
  lime: 3,
  violet: 4,
  rose: 5,
}

export class GameScene extends Phaser.Scene {
  private boardState: BoardState = []
  private gemViews: Array<Array<GemView | null>> = []
  private selectedGem: GemView | null = null
  private matchedGemKeys = new Set<string>()
  private isBoardBusy = false
  private draggedGem: GemView | null = null
  private pressedGem: GemView | null = null
  private didDragPressedGem = false
  private dragStartPointerPosition: { x: number; y: number } | null = null
  private dragPreviewTargetGem: GemView | null = null
  private boardLeft = 0
  private boardTop = 0
  private boardWidth = 0
  private boardHeight = 0
  private cellSize = CELL_SIZE
  private controlsLeft = 0
  private controlsTop = 0
  private controlsWidth = 0
  private musicVolumeTrackWidth = MUSIC_VOLUME_TRACK_WIDTH
  private isDesktopLayout = true
  private boardColumns = BOARD_COLUMNS
  private boardRows = BOARD_ROWS
  private gemTypeCount: number = DEFAULT_GEM_TYPE_COUNT
  private score = 0
  private scoreText!: Phaser.GameObjects.Text
  private boardSizeText!: Phaser.GameObjects.Text
  private gemTypeCountText!: Phaser.GameObjects.Text
  private backgroundMusic: BackgroundMusicSound | null = null
  private backgroundMusicVolume = DEFAULT_BACKGROUND_MUSIC_VOLUME
  private isBackgroundMusicMuted = false
  private musicVolumeTrack!: Phaser.GameObjects.Rectangle
  private musicVolumeFill!: Phaser.GameObjects.Rectangle
  private musicVolumeThumb!: Phaser.GameObjects.Rectangle
  private musicVolumeValueText!: Phaser.GameObjects.Text
  private musicMuteButton!: Phaser.GameObjects.Text
  private isMusicVolumeDragging = false
  private matchSoundCascadeStep = 0
  private pendingResizeRestart: Phaser.Time.TimerEvent | null = null

  constructor() {
    super('game')
  }

  create(data: GameSceneData = {}): void {
    this.initializeBoardSettings(data)
    this.initializeGameState(data)
    this.input.dragDistanceThreshold = GEM_DRAG_DISTANCE_THRESHOLD

    const { width, height } = this.scale
    this.calculateLayout(width, height)

    this.drawBackground(width, height)
    this.drawBoardFrame(this.boardLeft, this.boardTop, this.boardWidth, this.boardHeight)
    this.drawBoard(this.boardState)
    this.registerDragHandlers()
    this.setupAudio()
    this.createHud()
    this.registerResizeHandler()
  }

  private calculateLayout(width: number, height: number): void {
    this.isDesktopLayout = width >= DESKTOP_LAYOUT_BREAKPOINT
    this.syncGameRootHeight(width)

    if (this.isDesktopLayout) {
      this.calculateDesktopLayout(width, height)
      return
    }

    this.calculateMobileLayout(width, height)
  }

  private calculateDesktopLayout(width: number, height: number): void {
    this.controlsWidth = DESKTOP_CONTROLS_WIDTH
    this.controlsLeft = SCENE_PADDING
    const controlsHeight = this.getControlsLayoutHeight()

    const boardAreaWidth = Math.max(120, width - SCENE_PADDING * 3 - this.controlsWidth)
    const boardAreaHeight = Math.max(120, height - SCENE_PADDING * 2)
    const horizontalCellSize = (boardAreaWidth - BOARD_PADDING * 2) / this.boardColumns
    const verticalCellSize = (boardAreaHeight - BOARD_PADDING * 2) / this.boardRows

    this.cellSize = Math.max(16, Math.min(horizontalCellSize, verticalCellSize))
    this.boardWidth = this.boardColumns * this.cellSize + BOARD_PADDING * 2
    this.boardHeight = this.boardRows * this.cellSize + BOARD_PADDING * 2
    this.boardLeft =
      this.controlsLeft +
      this.controlsWidth +
      SCENE_PADDING +
      Math.max(0, (boardAreaWidth - this.boardWidth) / 2)
    this.boardTop = Math.max(SCENE_PADDING, (height - this.boardHeight) / 2)
    this.controlsTop = Math.max(SCENE_PADDING, (height - controlsHeight) / 2)
    this.musicVolumeTrackWidth = Math.max(120, this.controlsWidth - DESKTOP_CONTROLS_INNER_OFFSET * 2)
  }

  private calculateMobileLayout(width: number, height: number): void {
    this.controlsWidth = Math.max(120, width - SCENE_PADDING * 2)
    this.controlsLeft = SCENE_PADDING
    this.musicVolumeTrackWidth = Math.max(120, this.controlsWidth)
    const controlsHeight = this.getControlsLayoutHeight()

    const boardAreaWidth = this.controlsWidth
    const horizontalCellSize = (boardAreaWidth - BOARD_PADDING * 2) / this.boardColumns

    this.cellSize = Math.max(14, horizontalCellSize)
    this.boardWidth = this.boardColumns * this.cellSize + BOARD_PADDING * 2
    this.boardHeight = this.boardRows * this.cellSize + BOARD_PADDING * 2
    this.boardLeft = SCENE_PADDING + Math.max(0, (boardAreaWidth - this.boardWidth) / 2)
    this.boardTop = SCENE_PADDING
    this.controlsTop = Math.min(
      this.boardTop + this.boardHeight + BOARD_TO_CONTROLS_GAP,
      height - controlsHeight - SCENE_PADDING,
    )
  }

  private getGemBaseScale(): number {
    return Math.max(0.12, (this.cellSize - 6) / 128)
  }

  private getDesktopControlsInnerLeft(): number {
    return this.controlsLeft + DESKTOP_CONTROLS_INNER_OFFSET
  }

  private getDesktopControlsInnerWidth(): number {
    return this.controlsWidth - DESKTOP_CONTROLS_INNER_OFFSET * 2
  }

  private getControlsContentLeft(): number {
    return this.isDesktopLayout ? this.getDesktopControlsInnerLeft() : this.controlsLeft
  }

  private getControlsContentWidth(): number {
    return this.isDesktopLayout ? this.getDesktopControlsInnerWidth() : this.controlsWidth
  }

  private getControlsContentRight(): number {
    return this.getControlsContentLeft() + this.getControlsContentWidth()
  }

  private getControlsLayoutHeight(): number {
    const titleHeight = this.isDesktopLayout ? DESKTOP_TITLE_HEIGHT : 0
    const scoreAndRestartHeight = SCORE_TEXT_HEIGHT + SCORE_TO_RESTART_GAP + CONTROL_BUTTON_HEIGHT + RESTART_TO_SECTION_GAP
    const boardSectionHeight =
      SECTION_LABEL_HEIGHT +
      CONTROL_LABEL_TO_ROWS_GAP +
      CONTROL_ROW_GAP +
      VALUE_TEXT_HEIGHT +
      CONTROL_SECTION_GAP
    const colorsSectionHeight =
      SECTION_LABEL_HEIGHT +
      CONTROL_LABEL_TO_ROWS_GAP +
      VALUE_TEXT_HEIGHT +
      CONTROL_SECTION_GAP
    const musicSectionHeight =
      SECTION_LABEL_HEIGHT +
      MUSIC_LABEL_TO_TRACK_GAP +
      MUSIC_TRACK_TO_BUTTON_GAP +
      MUSIC_BUTTON_HEIGHT

    return titleHeight + scoreAndRestartHeight + boardSectionHeight + colorsSectionHeight + musicSectionHeight
  }

  private syncGameRootHeight(width: number): void {
    const gameRoot = this.game.canvas.parentElement

    if (!gameRoot) {
      return
    }

    if (this.isDesktopLayout) {
      gameRoot.style.height = ''
      return
    }

    const controlsWidth = Math.max(120, width - SCENE_PADDING * 2)
    const cellSize = Math.max(14, (controlsWidth - BOARD_PADDING * 2) / this.boardColumns)
    const boardHeight = this.boardRows * cellSize + BOARD_PADDING * 2
    const requiredHeight =
      SCENE_PADDING * 2 +
      boardHeight +
      BOARD_TO_CONTROLS_GAP +
      this.getControlsLayoutHeight()
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    const fallbackHeight = Math.min(Math.max(320, viewportHeight - 96), 760)
    const nextHeight = Math.max(requiredHeight, fallbackHeight)

    gameRoot.style.height = `${Math.ceil(nextHeight)}px`
  }

  private initializeBoardSettings(data: GameSceneData): void {
    this.boardColumns = data.boardColumns ?? BOARD_COLUMNS
    this.boardRows = data.boardRows ?? BOARD_ROWS
    this.gemTypeCount = Phaser.Math.Clamp(
      data.gemTypeCount ?? DEFAULT_GEM_TYPE_COUNT,
      MIN_GEM_TYPE_COUNT,
      GEM_TYPES.length,
    )
  }

  private initializeGameState(data: GameSceneData): void {
    this.boardState = data.boardState ? this.cloneBoardState(data.boardState) : createInitialBoard(this.getBoardSettings())
    this.gemViews = []
    this.selectedGem = null
    this.matchedGemKeys.clear()
    this.isBoardBusy = false
    this.draggedGem = null
    this.pressedGem = null
    this.didDragPressedGem = false
    this.dragStartPointerPosition = null
    this.dragPreviewTargetGem = null
    this.score = data.score ?? 0
    this.matchSoundCascadeStep = 0
  }

  private cloneBoardState(boardState: BoardState): BoardState {
    return boardState.map((row) => [...row])
  }

  private getBoardSettings(): BoardSettings {
    return {
      rows: this.boardRows,
      columns: this.boardColumns,
      gemTypes: GEM_TYPES.slice(0, this.gemTypeCount),
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
    const shadow = this.add.graphics()
    shadow.fillStyle(0x000000, 0.22)
    shadow.lineStyle(2, 0xffffff, 0.06)
    shadow.fillRoundedRect(boardLeft - 11, boardTop - 11, boardWidth + 22, boardHeight + 22, BOARD_FRAME_RADIUS)
    shadow.strokeRoundedRect(boardLeft - 11, boardTop - 11, boardWidth + 22, boardHeight + 22, BOARD_FRAME_RADIUS)

    const board = this.add.graphics()
    board.fillStyle(0x24173f, 0.94)
    board.lineStyle(4, 0xf7b267, 0.8)
    board.fillRoundedRect(boardLeft, boardTop, boardWidth, boardHeight, BOARD_FRAME_RADIUS)
    board.strokeRoundedRect(boardLeft, boardTop, boardWidth, boardHeight, BOARD_FRAME_RADIUS)
  }

  private drawBoard(boardState: BoardState): void {
    this.gemViews = []

    for (let row = 0; row < boardState.length; row += 1) {
      const viewRow: Array<GemView | null> = []

      for (let column = 0; column < boardState[row].length; column += 1) {
        const position: GridPosition = { row, column }
        const gemType = boardState[row][column]

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

  private handleGemPointerDown(gemView: GemView): void {
    if (this.isBoardBusy) {
      return
    }

    this.pressedGem = gemView
    this.didDragPressedGem = false

    if (
      !this.selectedGem ||
      this.selectedGem === gemView ||
      !this.areAdjacent(this.selectedGem.position, gemView.position)
    ) {
      this.handleGemSelection(gemView)
    }
  }

  private handleGemPointerUp(gemView: GemView): void {
    if (this.pressedGem !== gemView) {
      return
    }

    this.pressedGem = null

    if (this.isBoardBusy || this.draggedGem === gemView || this.didDragPressedGem) {
      this.didDragPressedGem = false
      return
    }

    this.didDragPressedGem = false

    if (!this.selectedGem || this.selectedGem === gemView) {
      return
    }

    if (!this.areAdjacent(this.selectedGem.position, gemView.position)) {
      return
    }

    void this.swapSelectedGems(this.selectedGem, gemView)
  }

  private handleBoardPointerUp(): void {
    if (!this.pressedGem) {
      return
    }

    const pressedGem = this.pressedGem
    this.handleGemPointerUp(pressedGem)
  }

  private updateSelectionState(): void {
    for (const row of this.gemViews) {
      for (const gemView of row) {
        if (!gemView) {
          continue
        }

        const isSelected = this.selectedGem === gemView
        const isMatched = this.matchedGemKeys.has(this.getPositionKey(gemView.position))
        const strokeColor = 0xfff4d6
        const strokeAlpha = isSelected ? 0.95 : 0
        const scale = isSelected ? 1.08 : isMatched ? 1.04 : 1

        gemView.highlight.setStrokeStyle(3, strokeColor, strokeAlpha)
        this.tweens.killTweensOf(gemView.highlight)
        this.tweens.killTweensOf(gemView.sprite)

        this.tweens.add({
          targets: gemView.highlight,
          alpha: isSelected ? 1 : 0,
          duration: GEM_SELECTION_ANIMATION_DURATION,
          ease: 'Sine.easeOut',
        })

        this.tweens.add({
          targets: gemView.sprite,
          scale: this.getGemBaseScale() * scale,
          duration: GEM_SELECTION_ANIMATION_DURATION,
          ease: 'Sine.easeOut',
        })
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
      x: gridLeft + position.column * this.cellSize + this.cellSize / 2,
      y: gridTop + position.row * this.cellSize + this.cellSize / 2,
    }
  }

  private animateGemMove(gemView: GemView, target: GridPosition): Promise<void> {
    const cellCenter = this.getCellCenter(target)
    const targetY = (target.row + target.column) % 2 === 0 ? cellCenter.y - 1 : cellCenter.y

    return new Promise((resolve) => {
      this.tweens.add({
        targets: [gemView.highlight, gemView.sprite],
        x: cellCenter.x,
        y: targetY,
        duration: 160,
        ease: 'Sine.easeInOut',
        onComplete: () => resolve(),
      })
    })
  }

  private animateGemFall(gemView: GemView, target: GridPosition): Promise<void> {
    const targetPosition = this.getCellSpritePosition(target)
    const fallDistance = Math.abs(targetPosition.y - gemView.sprite.y)
    const settleOffset = Math.min(10, Math.max(4, fallDistance * 0.06))
    const fallDuration = Phaser.Math.Clamp(140 + fallDistance * 0.22, 140, 280)
    const bounceDuration = Phaser.Math.Clamp(90 + fallDistance * 0.08, 90, 150)

    return new Promise((resolve) => {
      this.tweens.add({
        targets: [gemView.highlight, gemView.sprite],
        x: targetPosition.x,
        y: targetPosition.y + settleOffset,
        duration: fallDuration,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.tweens.add({
            targets: [gemView.highlight, gemView.sprite],
            y: targetPosition.y,
            duration: bounceDuration,
            ease: 'Sine.easeOut',
            onComplete: () => resolve(),
          })
        },
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

  private snapGemToCell(gemView: GemView, position: GridPosition): void {
    gemView.positionTween?.stop()
    gemView.positionTween = null

    const cellPosition = this.getCellSpritePosition(position)
    gemView.highlight.x = cellPosition.x
    gemView.highlight.y = cellPosition.y
    gemView.sprite.x = cellPosition.x
    gemView.sprite.y = cellPosition.y
  }

  private animateGemToPoint(gemView: GemView, x: number, y: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      gemView.positionTween?.stop()

      gemView.positionTween = this.tweens.add({
        targets: [gemView.highlight, gemView.sprite],
        x,
        y,
        duration,
        ease: 'Sine.easeOut',
        onComplete: () => {
          gemView.positionTween = null
          resolve()
        },
      })
    })
  }

  private async animateGemBackToCell(gemView: GemView): Promise<void> {
    const cellPosition = this.getCellSpritePosition(gemView.position)
    await this.animateGemToPoint(gemView, cellPosition.x, cellPosition.y, DRAG_RETURN_ANIMATION_DURATION)
  }

  private resetDragPreviewTarget(): void {
    if (!this.dragPreviewTargetGem) {
      return
    }

    this.snapGemToCell(this.dragPreviewTargetGem, this.dragPreviewTargetGem.position)
    this.dragPreviewTargetGem = null
  }

  private async cancelDrag(gemView: GemView): Promise<void> {
    this.isBoardBusy = true

    try {
      this.resetDragPreviewTarget()
      await this.animateGemBackToCell(gemView)
      this.updateSelectionState()
    } finally {
      this.isBoardBusy = false
    }
  }

  private registerDragHandlers(): void {
    this.input.off('dragstart')
    this.input.off('drag')
    this.input.off('dragend')
    this.input.off('pointerup', this.handleBoardPointerUp, this)

    this.input.on('dragstart', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      const gemView = gameObject.getData('gemView') as GemView | undefined

      if (!gemView || this.isBoardBusy) {
        return
      }

      this.pressedGem = null
      this.didDragPressedGem = true
      this.draggedGem = gemView
      this.dragStartPointerPosition = { x: gemView.sprite.x, y: gemView.sprite.y }
      gemView.highlight.setDepth(2)
      gemView.sprite.setDepth(2)
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
        gemView.highlight.x = x
        gemView.highlight.y = y
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

      gemView.highlight.setDepth(1)
      gemView.sprite.setDepth(1)

      const targetGem = this.getDragSwapTarget(gemView)
      this.pressedGem = null
      this.didDragPressedGem = false
      this.draggedGem = null
      this.dragStartPointerPosition = null

      if (!targetGem) {
        void this.cancelDrag(gemView)
        return
      }

      this.dragPreviewTargetGem = null
      void this.swapSelectedGems(gemView, targetGem)
    })

    this.input.on('pointerup', this.handleBoardPointerUp, this)
  }

  private getDraggedGemPosition(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    if (!this.draggedGem || !this.dragStartPointerPosition) {
      return { x: pointer.x, y: pointer.y }
    }

    const dragOffsetX = pointer.x - this.dragStartPointerPosition.x
    const dragOffsetY = pointer.y - this.dragStartPointerPosition.y
    const isHorizontal = Math.abs(dragOffsetX) >= Math.abs(dragOffsetY)
    const maxOffset = this.cellSize

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
    const minimumSwapDistance = this.cellSize * 0.35

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

    void this.animateGemToPoint(
      targetGem,
      targetCellPosition.x + previewOffsetX,
      targetCellPosition.y + previewOffsetY,
      DRAG_PREVIEW_ANIMATION_DURATION,
    )
  }

  private createGemView(position: GridPosition, gemType: GemType): GemView {
    const cellCenter = this.getCellCenter(position)
    const highlight = this.add.rectangle(
      cellCenter.x,
      (position.row + position.column) % 2 === 0 ? cellCenter.y - 1 : cellCenter.y,
      this.cellSize - 2,
      this.cellSize - 2,
      0xffffff,
      0,
    )
    highlight.setStrokeStyle(3, 0xffffff, 0)
    highlight.setDepth(1)

    const gem = this.add.image(
      cellCenter.x,
      (position.row + position.column) % 2 === 0 ? cellCenter.y - 1 : cellCenter.y,
      GEMS_SPRITE_SHEET_KEY,
      GEM_SPRITE_FRAME_BY_TYPE[gemType],
    )
    gem.setScale(this.getGemBaseScale())
    gem.setInteractive({ useHandCursor: true })
    this.input.setDraggable(gem)
    gem.setDepth(1.1)

    const gemView: GemView = {
      position: { ...position },
      gemType,
      sprite: gem,
      highlight,
      positionTween: null,
    }

    gem.setData('gemView', gemView)

    gem.on('pointerdown', () => {
      this.handleGemPointerDown(gemView)
    })

    return gemView
  }

  private setupAudio(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this)
    this.sound.pauseOnBlur = false
    this.sound.off('unlocked', this.handleAudioUnlocked, this)
    this.sound.on('unlocked', this.handleAudioUnlocked, this)
    this.backgroundMusicVolume = this.getStoredBackgroundMusicVolume()
    this.isBackgroundMusicMuted = this.getStoredBackgroundMusicMuted()

    const existingMusic = this.sound.getAll<BackgroundMusicSound>(BACKGROUND_MUSIC_KEY)[0] ?? null
    this.backgroundMusic = existingMusic

    if (!this.backgroundMusic) {
      this.backgroundMusic = this.sound.add(BACKGROUND_MUSIC_KEY, {
        loop: true,
        volume: this.backgroundMusicVolume,
      }) as BackgroundMusicSound
    }

    this.applyBackgroundMusicState()

    this.tryStartBackgroundMusic()
    this.input.once('pointerdown', () => {
      this.tryStartBackgroundMusic()
    })
  }

  private handleAudioUnlocked(): void {
    this.tryStartBackgroundMusic()
  }

  private tryStartBackgroundMusic(): void {
    if (!this.backgroundMusic || this.backgroundMusic.isPlaying || this.sound.locked) {
      return
    }

    this.backgroundMusic.play()
  }

  private handleSceneShutdown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleSceneResize, this)
    this.sound.off('unlocked', this.handleAudioUnlocked, this)
    this.input.off('pointermove', this.handleMusicVolumePointerMove, this)
    this.input.off('pointerup', this.stopMusicVolumeDrag, this)
    this.input.off('gameout', this.stopMusicVolumeDrag, this)
    this.pendingResizeRestart?.remove(false)
    this.pendingResizeRestart = null
    this.isMusicVolumeDragging = false
    this.backgroundMusic = null
  }

  private registerResizeHandler(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleSceneResize, this)
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleSceneResize, this)
  }

  private handleSceneResize(gameSize: Phaser.Structs.Size): void {
    this.pendingResizeRestart?.remove(false)

    // Debounce resize bursts so the scene restarts only after the viewport settles.
    this.pendingResizeRestart = this.time.delayedCall(120, () => {
      const nextWidth = Math.round(gameSize.width)
      const nextHeight = Math.round(gameSize.height)

      if (nextWidth <= 0 || nextHeight <= 0) {
        return
      }

      this.scene.restart({
        boardColumns: this.boardColumns,
        boardRows: this.boardRows,
        gemTypeCount: this.gemTypeCount,
        boardState: this.cloneBoardState(this.boardState),
        score: this.score,
      })
    })
  }

  private playSwapSound(): void {
    this.sound.play(SWAP_SOUND_KEY, { volume: 0.4 })
  }

  private playMatchSound(): void {
    this.sound.play(MATCH_SOUND_KEY, {
      volume: 0.5,
      detune: this.matchSoundCascadeStep * MATCH_SOUND_CASCADE_DETUNE_STEP,
    })
  }

  private resetMatchSoundCascade(): void {
    this.matchSoundCascadeStep = 0
  }

  private advanceMatchSoundCascade(): void {
    this.matchSoundCascadeStep += 1
  }

  private getStoredBackgroundMusicVolume(): number {
    const storedVolume = this.registry.get(BACKGROUND_MUSIC_VOLUME_REGISTRY_KEY)

    if (typeof storedVolume !== 'number') {
      return DEFAULT_BACKGROUND_MUSIC_VOLUME
    }

    return Phaser.Math.Clamp(storedVolume, 0, 1)
  }

  private getStoredBackgroundMusicMuted(): boolean {
    return this.registry.get(BACKGROUND_MUSIC_MUTED_REGISTRY_KEY) === true
  }

  private applyBackgroundMusicState(): void {
    if (!this.backgroundMusic) {
      return
    }

    this.backgroundMusic.setLoop(true)
    this.backgroundMusic.setVolume(this.isBackgroundMusicMuted ? 0 : this.backgroundMusicVolume)
  }

  private createHud(): void {
    let nextSectionTop = this.createDesktopTitle()
    nextSectionTop = this.createScoreText(nextSectionTop)
    nextSectionTop = this.createRestartButton(nextSectionTop)
    nextSectionTop = this.createBoardSizeControls(nextSectionTop)
    nextSectionTop = this.createGemTypeControls(nextSectionTop)
    this.createMusicVolumeControl(nextSectionTop)
  }

  private createMusicVolumeControl(sectionTop: number): void {
    const labelY = sectionTop
    const trackY = labelY + MUSIC_LABEL_TO_TRACK_GAP
    const trackLeft = this.getControlsContentLeft()
    const trackWidth = this.musicVolumeTrackWidth

    this.add.text(trackLeft, labelY, 'Music', {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif',
      fontSize: '18px',
      color: '#f7b267',
      fontStyle: 'bold',
    })

    this.musicVolumeTrack = this.add
      .rectangle(trackLeft, trackY, trackWidth, 10, 0x4e4167, 0.95)
      .setOrigin(0, 0.5)

    this.musicVolumeFill = this.add
      .rectangle(trackLeft, trackY, trackWidth, 10, 0xf7b267, 1)
      .setOrigin(0, 0.5)

    this.musicVolumeThumb = this.add
      .rectangle(trackLeft, trackY, 14, 24, 0xfff4d6, 1)
      .setStrokeStyle(2, 0x24173f, 0.65)

    const trackHitArea = this.add
      .rectangle(trackLeft, trackY, trackWidth, 26, 0x000000, 0.001)
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })

    this.setupMusicTrackInteractions(trackHitArea)

    this.musicVolumeValueText = this.add.text(trackLeft + trackWidth, labelY, '', {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif',
      fontSize: '16px',
      color: '#fff4d6',
    })
    this.musicVolumeValueText.setOrigin(1, 0)

    this.musicMuteButton = this.add
      .text(trackLeft, trackY + MUSIC_TRACK_TO_BUTTON_GAP, '', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '16px',
        color: '#24173f',
        backgroundColor: '#f7b267',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })

    this.setupMusicMuteButtonInteractions()
    this.updateMusicVolumeControl()
  }

  private setupMusicTrackInteractions(trackHitArea: Phaser.GameObjects.Rectangle): void {
    this.musicVolumeThumb.setInteractive({ useHandCursor: true })

    trackHitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.startMusicVolumeDrag(pointer)
    })

    this.musicVolumeThumb.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.startMusicVolumeDrag(pointer)
    })

    this.input.on('pointermove', this.handleMusicVolumePointerMove, this)
    this.input.on('pointerup', this.stopMusicVolumeDrag, this)
    this.input.on('gameout', this.stopMusicVolumeDrag, this)
  }

  private setupMusicMuteButtonInteractions(): void {
    this.musicMuteButton.on('pointerdown', () => {
      this.toggleBackgroundMusicMute()
    })

    this.musicMuteButton.on('pointerover', () => {
      this.musicMuteButton.setStyle({ backgroundColor: '#ffd08a' })
    })

    this.musicMuteButton.on('pointerout', () => {
      this.updateMusicMuteButton()
    })
  }

  private startMusicVolumeDrag(pointer: Phaser.Input.Pointer): void {
    this.isMusicVolumeDragging = true
    this.updateMusicVolumeFromPointer(pointer.x)
    this.tryStartBackgroundMusic()
  }

  private handleMusicVolumePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isMusicVolumeDragging) {
      return
    }

    this.updateMusicVolumeFromPointer(pointer.x)
  }

  private stopMusicVolumeDrag(): void {
    this.isMusicVolumeDragging = false
  }

  private updateMusicVolumeFromPointer(pointerX: number): void {
    const volume = Phaser.Math.Clamp(
      (pointerX - this.musicVolumeTrack.x) / this.musicVolumeTrackWidth,
      0,
      1,
    )

    this.setBackgroundMusicVolume(volume)
  }

  private setBackgroundMusicVolume(volume: number): void {
    this.backgroundMusicVolume = volume
    this.isBackgroundMusicMuted = false
    this.registry.set(BACKGROUND_MUSIC_VOLUME_REGISTRY_KEY, volume)
    this.registry.set(BACKGROUND_MUSIC_MUTED_REGISTRY_KEY, false)
    this.applyBackgroundMusicState()
    this.updateMusicVolumeControl()
  }

  private toggleBackgroundMusicMute(): void {
    this.isBackgroundMusicMuted = !this.isBackgroundMusicMuted
    this.registry.set(BACKGROUND_MUSIC_MUTED_REGISTRY_KEY, this.isBackgroundMusicMuted)
    this.applyBackgroundMusicState()
    this.updateMusicVolumeControl()
  }

  private updateMusicMuteButton(): void {
    this.musicMuteButton.setText(this.isBackgroundMusicMuted ? 'Unmute' : 'Mute')
    this.musicMuteButton.setStyle({
      backgroundColor: this.isBackgroundMusicMuted ? '#ffd08a' : '#f7b267',
    })
  }

  private updateMusicVolumeControl(): void {
    const fillWidth = Math.max(0, this.musicVolumeTrackWidth * this.backgroundMusicVolume)
    const thumbX = this.musicVolumeTrack.x + fillWidth

    this.musicVolumeFill.width = fillWidth
    this.musicVolumeThumb.x = Phaser.Math.Clamp(
      thumbX,
      this.musicVolumeTrack.x,
      this.musicVolumeTrack.x + this.musicVolumeTrackWidth,
    )
    this.musicVolumeValueText.setText(
      this.isBackgroundMusicMuted
        ? `Muted ${Math.round(this.backgroundMusicVolume * 100)}%`
        : `${Math.round(this.backgroundMusicVolume * 100)}%`,
    )
    this.updateMusicMuteButton()
  }

  private createScoreText(sectionTop: number): number {
    this.scoreText = this.add.text(this.getControlsContentLeft(), sectionTop, '', {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif',
      fontSize: '24px',
      color: '#fff4d6',
      fontStyle: 'bold',
    })

    this.updateScoreText()
    return this.scoreText.y + this.scoreText.height + SCORE_TO_RESTART_GAP
  }

  private createBoardSizeControls(sectionTop: number): number {
    const labelY = sectionTop
    const firstRowY = labelY + CONTROL_LABEL_TO_ROWS_GAP
    const secondRowY = firstRowY + CONTROL_ROW_GAP
    const controlsLeft = this.getControlsContentLeft()
    const controlsRight = this.getControlsContentRight()
    const centerX = controlsLeft + this.getControlsContentWidth() / 2

    const label = this.add.text(controlsLeft, labelY, 'Board', {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif',
      fontSize: '18px',
      color: '#f7b267',
      fontStyle: 'bold',
    })

    const decreaseColumnsButton = this.createBoardSizeButton(controlsLeft, firstRowY, '-C')
    decreaseColumnsButton.on('pointerdown', () => {
      this.changeBoardSize('columns', -1)
    })

    const increaseColumnsButton = this.createBoardSizeButton(controlsLeft, firstRowY, '+C')
    increaseColumnsButton.on('pointerdown', () => {
      this.changeBoardSize('columns', 1)
    })

    increaseColumnsButton.setPosition(
      controlsRight - increaseColumnsButton.width,
      firstRowY,
    )

    const decreaseRowsButton = this.createBoardSizeButton(controlsLeft, secondRowY, '-R')
    decreaseRowsButton.on('pointerdown', () => {
      this.changeBoardSize('rows', -1)
    })

    const increaseRowsButton = this.createBoardSizeButton(controlsLeft, secondRowY, '+R')
    increaseRowsButton.on('pointerdown', () => {
      this.changeBoardSize('rows', 1)
    })

    increaseRowsButton.setPosition(
      controlsRight - increaseRowsButton.width,
      secondRowY,
    )

    this.boardSizeText = this.add
      .text(centerX, firstRowY + BOARD_SIZE_VALUE_OFFSET, '', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '18px',
        color: '#fff4d6',
        align: 'center',
      })
      .setOrigin(0.5)

    this.updateBoardSizeText()
    return Math.max(label.y + label.height, this.boardSizeText.y + this.boardSizeText.height) + CONTROL_SECTION_GAP
  }

  private createGemTypeControls(sectionTop: number): number {
    const labelY = sectionTop
    const rowY = labelY + CONTROL_LABEL_TO_ROWS_GAP
    const controlsLeft = this.getControlsContentLeft()
    const controlsRight = this.getControlsContentRight()
    const centerX = controlsLeft + this.getControlsContentWidth() / 2

    const label = this.add.text(controlsLeft, labelY, 'Colors', {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif',
      fontSize: '18px',
      color: '#f7b267',
      fontStyle: 'bold',
    })

    const decreaseGemTypesButton = this.createBoardSizeButton(controlsLeft, rowY, '-')
    decreaseGemTypesButton.on('pointerdown', () => {
      this.changeGemTypeCount(-1)
    })

    const increaseGemTypesButton = this.createBoardSizeButton(controlsLeft, rowY, '+')
    increaseGemTypesButton.on('pointerdown', () => {
      this.changeGemTypeCount(1)
    })

    increaseGemTypesButton.setPosition(
      controlsRight - increaseGemTypesButton.width,
      rowY,
    )

    this.gemTypeCountText = this.add
      .text(centerX, rowY + GEM_TYPE_VALUE_OFFSET, '', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '18px',
        color: '#fff4d6',
        align: 'center',
      })
      .setOrigin(0.5)

    this.updateGemTypeCountText()
    return Math.max(label.y + label.height, this.gemTypeCountText.y + this.gemTypeCountText.height) + CONTROL_SECTION_GAP
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

  private updateGemTypeCountText(): void {
    this.gemTypeCountText.setText(`${this.gemTypeCount} active colors`)
  }

  private changeBoardSize(axis: 'columns' | 'rows', direction: -1 | 1): void {
    if (this.isBoardBusy) {
      return
    }

    const currentValue = axis === 'columns' ? this.boardColumns : this.boardRows
    const nextValue = Phaser.Math.Clamp(currentValue + direction, MIN_BOARD_SIZE, MAX_BOARD_SIZE)

    if (nextValue === currentValue) {
      return
    }

    const nextBoardColumns = axis === 'columns' ? nextValue : this.boardColumns
    const nextBoardRows = axis === 'rows' ? nextValue : this.boardRows

    this.scene.restart({
      boardColumns: nextBoardColumns,
      boardRows: nextBoardRows,
      gemTypeCount: this.gemTypeCount,
    })
  }

  private changeGemTypeCount(direction: -1 | 1): void {
    if (this.isBoardBusy) {
      return
    }

    const nextGemTypeCount = Phaser.Math.Clamp(
      this.gemTypeCount + direction,
      MIN_GEM_TYPE_COUNT,
      GEM_TYPES.length,
    )

    if (nextGemTypeCount === this.gemTypeCount) {
      return
    }

    this.scene.restart({
      boardColumns: this.boardColumns,
      boardRows: this.boardRows,
      gemTypeCount: nextGemTypeCount,
    })
  }

  private createRestartButton(sectionTop: number): number {
    const button = this.add
      .text(this.getControlsContentLeft(), sectionTop, 'Restart game', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '18px',
        color: '#24173f',
        backgroundColor: '#f7b267',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })

    if (!this.isDesktopLayout) {
      button.setPosition(this.controlsLeft + (this.controlsWidth - button.width) / 2, button.y)
    }

    this.setupRestartButtonInteractions(button)
    return button.y + button.height + RESTART_TO_SECTION_GAP
  }

  private setupRestartButtonInteractions(button: Phaser.GameObjects.Text): void {

    button.on('pointerdown', () => {
      this.scene.restart({
        boardColumns: this.boardColumns,
        boardRows: this.boardRows,
        gemTypeCount: this.gemTypeCount,
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

  private createDesktopTitle(): number {
    if (!this.isDesktopLayout) {
      return this.controlsTop
    }

    const titleLeft = this.getDesktopControlsInnerLeft()
    const titleWidth = this.getDesktopControlsInnerWidth()

    this.add.text(titleLeft, this.controlsTop, 'Phaser 3 + Vite + TypeScript', {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif',
      fontSize: '13px',
      color: '#f7b267',
      letterSpacing: 2,
      fontStyle: 'bold',
    })

    this.add.text(titleLeft, this.controlsTop + 24, 'Match-Three', {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif',
      fontSize: '34px',
      color: '#fff4d6',
      fontStyle: 'bold',
      wordWrap: { width: titleWidth },
      lineSpacing: -4,
    })

    return this.controlsTop + DESKTOP_TITLE_HEIGHT
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

  private createMatchBubbleBurst(match: MatchGroup): void {
    if (match.length === 0) {
      return
    }

    const totalBubbleCount = Phaser.Math.Clamp(
      MATCH_BUBBLE_BASE_COUNT + match.length * MATCH_BUBBLE_PER_GEM,
      MATCH_BUBBLE_BASE_COUNT,
      MATCH_BUBBLE_MAX_COUNT,
    )
    const cellCenters = match.map((position) => this.getCellCenter(position))
    const uniqueRows = new Set(match.map((position) => position.row))
    const uniqueColumns = new Set(match.map((position) => position.column))
    const isHorizontalMatch = uniqueRows.size === 1
    const isVerticalMatch = uniqueColumns.size === 1

    const xPositions = cellCenters.map((center) => center.x)
    const yPositions = cellCenters.map((center) => center.y)
    const minX = Math.min(...xPositions)
    const maxX = Math.max(...xPositions)
    const minY = Math.min(...yPositions)
    const maxY = Math.max(...yPositions)
    const horizontalJitter = this.cellSize * 0.18
    const verticalJitter = this.cellSize * 0.18
    const bubbleTints = this.getMatchBubbleTints(match)

    const emitter = this.add.particles(0, 0, BUBBLE_PARTICLE_TEXTURE_KEY, {
      x: isVerticalMatch
        ? { min: minX - horizontalJitter, max: maxX + horizontalJitter }
        : { min: minX - this.cellSize * 0.35, max: maxX + this.cellSize * 0.35 },
      y: isHorizontalMatch
        ? { min: minY - verticalJitter, max: maxY + verticalJitter }
        : { min: minY - this.cellSize * 0.35, max: maxY + this.cellSize * 0.35 },
      angle: { min: -120, max: -60 },
      speed: { min: 60, max: 210 },
      accelerationX: { min: -18, max: 18 },
      accelerationY: { min: -36, max: -8 },
      scale: { start: 0.34, end: 0.03, random: true },
      alpha: { start: 0.78, end: 0 },
      lifespan: { min: 420, max: 980 },
      quantity: totalBubbleCount,
      rotate: { min: -70, max: 70 },
      maxVelocityX: 180,
      maxVelocityY: 260,
      bounce: { min: 0.08, max: 0.22 },
      delay: { min: 0, max: 120 },
      tint: bubbleTints.length === 1 ? bubbleTints[0] : bubbleTints,
      frequency: -1,
      blendMode: 'ADD',
    })

    emitter.explode(totalBubbleCount)
    this.time.delayedCall(700, () => {
      emitter.destroy()
    })
  }

  private getMatchBubbleTints(match: MatchGroup): number[] {
    const uniqueTints = new Set<number>()

    for (const position of match) {
      const gemType = this.boardState[position.row][position.column]

      if (!gemType) {
        continue
      }

      uniqueTints.add(BUBBLE_TINT_BY_GEM_TYPE[gemType])
    }

    return uniqueTints.size > 0 ? [...uniqueTints] : [0xffffff]
  }

  private async removeMatchedGems(matches: MatchGroup[]): Promise<void> {
    const uniquePositions = Array.from(
      new Set(matches.flatMap((match) => match.map((position) => this.getPositionKey(position)))),
    ).map((key) => {
      const [row, column] = key.split(':').map(Number)
      return { row, column }
    })

    const matchedSprites = uniquePositions
      .flatMap((position) => {
        const gemView = this.gemViews[position.row][position.column]

        return gemView ? [gemView.highlight, gemView.sprite] : []
      })

    if (matchedSprites.length > 0) {
      this.playMatchSound()
      this.advanceMatchSoundCascade()

      for (const match of matches) {
        this.createMatchBubbleBurst(match)
      }
    }

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

      gemView.highlight.destroy()
      gemView.sprite.destroy()
      this.gemViews[position.row][position.column] = null
    }

    this.score += uniquePositions.length * 10
    this.matchedGemKeys.clear()
    this.updateScoreText()
    this.updateSelectionState()
  }

  private async resolveBoardCascades(): Promise<void> {
    this.resetMatchSoundCascade()

    try {
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
    } finally {
      this.resetMatchSoundCascade()
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

        return this.animateGemFall(gemView, move.to)
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

      return this.animateGemFall(gemView, move.to)
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
      this.playSwapSound()

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
