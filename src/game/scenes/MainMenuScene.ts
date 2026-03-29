import Phaser from 'phaser'

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('main-menu')
  }

  create(): void {
    const { width, height } = this.scale

    const background = this.add.graphics()
    background.fillGradientStyle(0x2a1d45, 0x2a1d45, 0x120d24, 0x120d24, 1)
    background.fillRect(0, 0, width, height)

    const glow = this.add.graphics()
    glow.fillStyle(0xffc857, 0.16)
    glow.fillCircle(width * 0.2, height * 0.18, 140)
    glow.fillStyle(0x55d6ff, 0.14)
    glow.fillCircle(width * 0.82, height * 0.3, 180)

    const boardShadow = this.add.rectangle(
      width / 2,
      height / 2,
      430,
      430,
      0x000000,
      0.22,
    )
    boardShadow.setStrokeStyle(2, 0xffffff, 0.06)

    const board = this.add.rectangle(
      width / 2,
      height / 2,
      400,
      400,
      0x24173f,
      0.92,
    )
    board.setStrokeStyle(4, 0xf7b267, 0.85)

    const gems = [
      { x: -105, y: -105, color: 0xff5d8f },
      { x: 0, y: -105, color: 0xf7b267 },
      { x: 105, y: -105, color: 0x7ae582 },
      { x: -105, y: 0, color: 0x55d6ff },
      { x: 0, y: 0, color: 0xc77dff },
      { x: 105, y: 0, color: 0xff9f1c },
      { x: -105, y: 105, color: 0x7bdff2 },
      { x: 0, y: 105, color: 0xb8f2e6 },
      { x: 105, y: 105, color: 0xff5d8f },
    ]

    for (const gem of gems) {
      const tile = this.add.rectangle(
        width / 2 + gem.x,
        height / 2 + gem.y,
        88,
        88,
        gem.color,
        0.95,
      )
      tile.setStrokeStyle(4, 0xffffff, 0.2)
      tile.setRotation(Phaser.Math.DegToRad(45))
    }

    this.add
      .text(width / 2, 56, 'Match-Three', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '48px',
        color: '#fff4d6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, 108, 'Starter screen', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '20px',
        color: '#f7b267',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height - 46, 'Vite + TypeScript + Phaser 3', {
        fontFamily: 'Trebuchet MS, Verdana, sans-serif',
        fontSize: '18px',
        color: '#f7efe6',
      })
      .setOrigin(0.5)
  }
}
