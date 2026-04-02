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
}

type GameSceneData = {
  boardColumns?: number
  boardRows?: number
  gemTypeCount?: number
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
const DEFAULT_BACKGROUND_MUSIC_VOLUME = 0.06
const MUSIC_VOLUME_TRACK_WIDTH = 190
const BACKGROUND_MUSIC_VOLUME_REGISTRY_KEY = 'backgroundMusicVolume'
const BACKGROUND_MUSIC_MUTED_REGISTRY_KEY = 'backgroundMusicMuted'
const MATCH_SOUND_CASCADE_DETUNE_STEP = 120
const DESKTOP_LAYOUT_BREAKPOINT = 900
const DESKTOP_CONTROLS_WIDTH = 320
const DESKTOP_CONTROLS_HEIGHT = 560
const DESKTOP_CONTROLS_INNER_OFFSET = 28
const MOBILE_CONTROLS_HEIGHT = 360
const SCENE_PADDING = 16
const BOARD_TO_CONTROLS_GAP = 18
const DESKTOP_TITLE_HEIGHT = 104
const BOARD_SIZE_VALUE_OFFSET = 32
const GEM_TYPE_VALUE_OFFSET = 14
const DESKTOP_RESTART_BUTTON_Y = 356
const MOBILE_RESTART_BUTTON_Y = 212
const DESKTOP_MUSIC_LABEL_Y = 418
const MOBILE_MUSIC_LABEL_Y = 266
const MOBILE_COLORS_LABEL_Y = 148
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

  constructor() {
    super('game')
  }

  create(data: GameSceneData = {}): void {
    this.initializeBoardSettings(data)
    this.initializeGameState()

    const { width, height } = this.scale
    this.calculateLayout(width, height)

    this.drawBackground(width, height)
    this.drawBoardFrame(this.boardLeft, this.boardTop, this.boardWidth, this.boardHeight)
    this.drawBoard(this.boardState)
    this.registerDragHandlers()
    this.setupAudio()
    this.createDesktopTitle()
    this.createScoreText()
    this.createBoardSizeControls()
    this.createGemTypeControls()
    this.createRestartButton()
    this.createMusicVolumeControl()

  }

  private calculateLayout(width: number, height: number): void {
    this.isDesktopLayout = width >= DESKTOP_LAYOUT_BREAKPOINT

    if (this.isDesktopLayout) {
      this.calculateDesktopLayout(width, height)
      return
    }

    this.calculateMobileLayout(width, height)
  }

  private calculateDesktopLayout(width: number, height: number): void {
    this.controlsWidth = DESKTOP_CONTROLS_WIDTH
    this.controlsLeft = SCENE_PADDING

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
    this.controlsTop = Math.max(SCENE_PADDING, (height - DESKTOP_CONTROLS_HEIGHT) / 2)
    this.musicVolumeTrackWidth = Math.max(120, this.controlsWidth - DESKTOP_CONTROLS_INNER_OFFSET * 2)
  }

  private calculateMobileLayout(width: number, height: number): void {
    this.controlsWidth = Math.max(120, width - SCENE_PADDING * 2)
    this.controlsLeft = SCENE_PADDING
    this.musicVolumeTrackWidth = Math.max(120, this.controlsWidth)

    const boardAreaWidth = this.controlsWidth
    const boardAreaHeight = Math.max(
      120,
      height - SCENE_PADDING * 2 - MOBILE_CONTROLS_HEIGHT - BOARD_TO_CONTROLS_GAP,
    )
    const horizontalCellSize = (boardAreaWidth - BOARD_PADDING * 2) / this.boardColumns
    const verticalCellSize = (boardAreaHeight - BOARD_PADDING * 2) / this.boardRows

    this.cellSize = Math.max(14, Math.min(horizontalCellSize, verticalCellSize))
    this.boardWidth = this.boardColumns * this.cellSize + BOARD_PADDING * 2
    this.boardHeight = this.boardRows * this.cellSize + BOARD_PADDING * 2
    this.boardLeft = SCENE_PADDING + Math.max(0, (boardAreaWidth - this.boardWidth) / 2)
    this.boardTop = SCENE_PADDING
    this.controlsTop = this.boardTop + this.boardHeight + BOARD_TO_CONTROLS_GAP
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

  private getDesktopControlsInnerRight(): number {
    return this.getDesktopControlsInnerLeft() + this.getDesktopControlsInnerWidth()
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
    this.matchSoundCascadeStep = 0
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

  private updateSelectionState(): void {
    for (const row of this.gemViews) {
      for (const gemView of row) {
        if (!gemView) {
          continue
        }

        const isSelected = this.selectedGem === gemView
        const isMatched = this.matchedGemKeys.has(this.getPositionKey(gemView.position))
        const strokeColor = isSelected ? 0xfff4d6 : isMatched ? 0x7ae582 : 0xffffff
        const strokeAlpha = isSelected ? 0.95 : isMatched ? 0.92 : 0
        const scale = isSelected ? 1.08 : isMatched ? 1.04 : 1

        gemView.highlight.setStrokeStyle(3, strokeColor, strokeAlpha)
        gemView.highlight.setAlpha(isSelected || isMatched ? 1 : 0)
        gemView.sprite.setScale(this.getGemBaseScale() * scale)
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

  private resetDragPreviewTarget(): void {
    if (!this.dragPreviewTargetGem) {
      return
    }

    const cellPosition = this.getCellSpritePosition(this.dragPreviewTargetGem.position)
    this.dragPreviewTargetGem.sprite.x = cellPosition.x
    this.dragPreviewTargetGem.sprite.y = cellPosition.y
    this.dragPreviewTargetGem.highlight.x = cellPosition.x
    this.dragPreviewTargetGem.highlight.y = cellPosition.y
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

    targetGem.sprite.x = targetCellPosition.x + previewOffsetX
    targetGem.sprite.y = targetCellPosition.y + previewOffsetY
    targetGem.highlight.x = targetCellPosition.x + previewOffsetX
    targetGem.highlight.y = targetCellPosition.y + previewOffsetY
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
    }

    gem.setData('gemView', gemView)

    gem.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.draggedGem === gemView || pointer.getDistance() > 8) {
        return
      }

      this.handleGemSelection(gemView)
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
    this.sound.off('unlocked', this.handleAudioUnlocked, this)
    this.input.off('pointermove', this.handleMusicVolumePointerMove, this)
    this.input.off('pointerup', this.stopMusicVolumeDrag, this)
    this.input.off('gameout', this.stopMusicVolumeDrag, this)
    this.isMusicVolumeDragging = false
    this.backgroundMusic = null
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

  private createMusicVolumeControl(): void {
    if (this.isDesktopLayout) {
      this.createDesktopMusicVolumeControl()
      return
    }

    this.createMobileMusicVolumeControl()
  }

  private createDesktopMusicVolumeControl(): void {
    const labelY = this.controlsTop + DESKTOP_MUSIC_LABEL_Y
    const trackY = labelY + 33
    const trackLeft = this.getDesktopControlsInnerLeft()
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
      .text(trackLeft, trackY + 20, '', {
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

  private createMobileMusicVolumeControl(): void {
    const labelY = this.controlsTop + MOBILE_MUSIC_LABEL_Y
    const trackY = labelY + 34
    const trackLeft = this.controlsLeft
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

    this.musicVolumeValueText = this.add
      .text(trackLeft + trackWidth, labelY, '', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '16px',
        color: '#fff4d6',
      })
      .setOrigin(1, 0)

    this.musicMuteButton = this.add
      .text(trackLeft, trackY + 20, '', {
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

  private createScoreText(): void {
    const scoreX = this.isDesktopLayout
      ? this.getDesktopControlsInnerLeft()
      : this.controlsLeft

    const scoreY = this.isDesktopLayout ? this.controlsTop + DESKTOP_TITLE_HEIGHT : this.controlsTop

    this.scoreText = this.add.text(scoreX, scoreY, '', {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif',
      fontSize: '24px',
      color: '#fff4d6',
      fontStyle: 'bold',
    })

    this.updateScoreText()
  }

  private createBoardSizeControls(): void {
    if (this.isDesktopLayout) {
      this.createDesktopBoardSizeControls()
      return
    }

    this.createMobileBoardSizeControls()
  }

  private createDesktopBoardSizeControls(): void {
    const labelY = this.controlsTop + 176
    const firstRowY = labelY + 28
    const secondRowY = firstRowY + 36
    const controlsLeft = this.getDesktopControlsInnerLeft()
    const controlsRight = this.getDesktopControlsInnerRight()
    const centerX = controlsLeft + this.getDesktopControlsInnerWidth() / 2

    this.add.text(controlsLeft, labelY, 'Board', {
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
  }

  private createMobileBoardSizeControls(): void {
    const labelY = this.controlsTop + 42
    const firstRowY = labelY + 28
    const secondRowY = firstRowY + 36
    const centerX = this.controlsLeft + this.controlsWidth / 2

    this.add.text(this.controlsLeft, labelY, 'Board', {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif',
      fontSize: '18px',
      color: '#f7b267',
      fontStyle: 'bold',
    })

    const decreaseColumnsButton = this.createBoardSizeButton(this.controlsLeft, firstRowY, '-C')
    decreaseColumnsButton.on('pointerdown', () => {
      this.changeBoardSize('columns', -1)
    })

    const increaseColumnsButton = this.createBoardSizeButton(this.controlsLeft, firstRowY, '+C')
    increaseColumnsButton.on('pointerdown', () => {
      this.changeBoardSize('columns', 1)
    })

    decreaseColumnsButton.setPosition(this.controlsLeft, firstRowY)
    increaseColumnsButton.setPosition(
      this.controlsLeft + this.controlsWidth - increaseColumnsButton.width,
      firstRowY,
    )

    const decreaseRowsButton = this.createBoardSizeButton(this.controlsLeft, secondRowY, '-R')
    decreaseRowsButton.on('pointerdown', () => {
      this.changeBoardSize('rows', -1)
    })

    const increaseRowsButton = this.createBoardSizeButton(this.controlsLeft, secondRowY, '+R')
    increaseRowsButton.on('pointerdown', () => {
      this.changeBoardSize('rows', 1)
    })

    decreaseRowsButton.setPosition(this.controlsLeft, secondRowY)
    increaseRowsButton.setPosition(
      this.controlsLeft + this.controlsWidth - increaseRowsButton.width,
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
  }

  private createGemTypeControls(): void {
    if (this.isDesktopLayout) {
      this.createDesktopGemTypeControls()
      return
    }

    this.createMobileGemTypeControls()
  }

  private createDesktopGemTypeControls(): void {
    const labelY = this.controlsTop + 290
    const rowY = labelY + 28
    const controlsLeft = this.getDesktopControlsInnerLeft()
    const controlsRight = this.getDesktopControlsInnerRight()
    const centerX = controlsLeft + this.getDesktopControlsInnerWidth() / 2

    this.add.text(controlsLeft, labelY, 'Colors', {
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
  }

  private createMobileGemTypeControls(): void {
    const labelY = this.controlsTop + MOBILE_COLORS_LABEL_Y
    const rowY = labelY + 28
    const centerX = this.controlsLeft + this.controlsWidth / 2

    this.add.text(this.controlsLeft, labelY, 'Colors', {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif',
      fontSize: '18px',
      color: '#f7b267',
      fontStyle: 'bold',
    })

    const decreaseGemTypesButton = this.createBoardSizeButton(this.controlsLeft, rowY, '-')
    decreaseGemTypesButton.on('pointerdown', () => {
      this.changeGemTypeCount(-1)
    })

    const increaseGemTypesButton = this.createBoardSizeButton(this.controlsLeft, rowY, '+')
    increaseGemTypesButton.on('pointerdown', () => {
      this.changeGemTypeCount(1)
    })

    decreaseGemTypesButton.setPosition(this.controlsLeft, rowY)
    increaseGemTypesButton.setPosition(
      this.controlsLeft + this.controlsWidth - increaseGemTypesButton.width,
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

  private createRestartButton(): void {
    if (this.isDesktopLayout) {
      this.createDesktopRestartButton()
      return
    }

    this.createMobileRestartButton()
  }

  private createDesktopRestartButton(): void {
    const button = this.add
      .text(this.getDesktopControlsInnerLeft(), this.controlsTop + DESKTOP_RESTART_BUTTON_Y, 'Restart game', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '18px',
        color: '#24173f',
        backgroundColor: '#f7b267',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })

    this.setupRestartButtonInteractions(button)
  }

  private createMobileRestartButton(): void {
    const button = this.add
      .text(0, this.controlsTop + MOBILE_RESTART_BUTTON_Y, 'Restart game', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '18px',
        color: '#24173f',
        backgroundColor: '#f7b267',
        padding: { x: 10, y: 6 },
      })
      .setInteractive({ useHandCursor: true })

    button.setPosition(this.controlsLeft + (this.controlsWidth - button.width) / 2, button.y)

    this.setupRestartButtonInteractions(button)
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

  private createDesktopTitle(): void {
    if (!this.isDesktopLayout) {
      return
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
      .flatMap((position) => {
        const gemView = this.gemViews[position.row][position.column]

        return gemView ? [gemView.highlight, gemView.sprite] : []
      })

    if (matchedSprites.length > 0) {
      this.playMatchSound()
      this.advanceMatchSoundCascade()
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
