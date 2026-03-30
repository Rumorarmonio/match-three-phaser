import Phaser from 'phaser'
import {
  BOARD_COLUMNS,
  BOARD_PADDING,
  BOARD_ROWS,
  CELL_SIZE,
  GEM_TYPES,
} from '../constants'
import type { GemType, GridPosition } from '../types'

const GEM_COLORS: Record<GemType, number> = {
  ruby: 0xff5d8f,
  amber: 0xf7b267,
  lime: 0x7ae582,
  cyan: 0x55d6ff,
  violet: 0xc77dff,
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super('game')
  }

  create(): void {
    const { width, height } = this.scale
    const boardWidth = BOARD_COLUMNS * CELL_SIZE + BOARD_PADDING * 2
    const boardHeight = BOARD_ROWS * CELL_SIZE + BOARD_PADDING * 2
    const boardLeft = Math.round((width - boardWidth) / 2)
    const boardTop = Math.round((height - boardHeight) / 2)

    this.drawBackground(width, height)
    this.drawBoardFrame(boardLeft, boardTop, boardWidth, boardHeight)
    this.drawTestGrid(boardLeft + BOARD_PADDING, boardTop + BOARD_PADDING)

    this.add
      .text(width / 2, 36, 'Match-3 Board Prototype', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '28px',
        color: '#fff4d6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height - 28, 'Stage 1: board frame, constants and gem types', {
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

  private drawTestGrid(gridLeft: number, gridTop: number): void {
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let column = 0; column < BOARD_COLUMNS; column += 1) {
        const position: GridPosition = { row, column }
        const gemType = GEM_TYPES[(row + column) % GEM_TYPES.length]
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

        if ((position.row + position.column) % 2 === 0) {
          gem.y -= 1
        }
      }
    }
  }
}
