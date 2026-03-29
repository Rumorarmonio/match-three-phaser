import Phaser from 'phaser'
import { gameConfig } from './config'

export const createGame = (parent: HTMLElement): Phaser.Game =>
  new Phaser.Game({
    ...gameConfig,
    parent,
  })
