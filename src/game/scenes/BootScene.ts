import Phaser from 'phaser'
import particleAsset from '../../assets/particle.png'
import backgroundMusicAsset from '../../assets/sounds/Księżyc - MM.mp3'
import matchSoundAsset from '../../assets/sounds/match.mp3'
import swapSoundAsset from '../../assets/sounds/swap.mp3'
import gemsSpriteSheetAsset from '../../assets/sprite/gems.png'

const SWAP_SOUND_KEY = 'swap-sound'
const MATCH_SOUND_KEY = 'match-sound'
const BACKGROUND_MUSIC_KEY = 'background-music'
const GEMS_SPRITE_SHEET_KEY = 'gems-sprite-sheet'
const PARTICLE_TEXTURE_KEY = 'bubble-particle'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot')
  }

  preload(): void {
    this.load.audio(SWAP_SOUND_KEY, swapSoundAsset)
    this.load.audio(MATCH_SOUND_KEY, matchSoundAsset)
    this.load.audio(BACKGROUND_MUSIC_KEY, backgroundMusicAsset)
    this.load.image(PARTICLE_TEXTURE_KEY, particleAsset)
    this.load.spritesheet(GEMS_SPRITE_SHEET_KEY, gemsSpriteSheetAsset, {
      frameWidth: 128,
      frameHeight: 128,
    })
  }

  create(): void {
    this.scene.start('game')
  }
}
