import './style.css'
import { createGame } from './game/game'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root element was not found')
}

app.innerHTML = `
  <main class="app-shell">
    <header class="app-header">
      <p class="eyebrow">Phaser 3 + Vite + TypeScript</p>
      <h1>Match-Three Game</h1>
    </header>
    <section class="game-panel">
      <div id="game-root" class="game-root" aria-label="Игровой экран"></div>
    </section>
  </main>
`

const gameRoot = document.querySelector<HTMLDivElement>('#game-root')

if (!gameRoot) {
  throw new Error('Game root element was not found')
}

const game = createGame(gameRoot)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true)
  })
}
