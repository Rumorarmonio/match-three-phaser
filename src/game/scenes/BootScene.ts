import Phaser from 'phaser'
import backgroundMusicAsset from '../../assets/sounds/Księżyc - MM.mp3'
import matchSoundAsset from '../../assets/sounds/match.mp3'
import swapSoundAsset from '../../assets/sounds/swap.mp3'

const SWAP_SOUND_KEY = 'swap-sound'
const MATCH_SOUND_KEY = 'match-sound'
const BACKGROUND_MUSIC_KEY = 'background-music'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  preload(): void {
    this.load.audio(SWAP_SOUND_KEY, swapSoundAsset)
    this.load.audio(MATCH_SOUND_KEY, matchSoundAsset)
    this.load.audio(BACKGROUND_MUSIC_KEY, backgroundMusicAsset)
  }

  create(): void {
    this.scene.start('game')
  }
}
