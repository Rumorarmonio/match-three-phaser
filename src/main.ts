import './style.css'
import { createGame } from './game/game'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root element was not found')
}

app.innerHTML = `
  <main class="app-shell">
    <section class="hero-panel">
      <p class="eyebrow">Phaser 3 + Vite + TypeScript</p>
      <h1>Match-Three Prototype</h1>
      <p class="lead">
        Базовый каркас для браузерной игры: стартовый экран уже запускается,
        дальше можно добавлять сцены, механику поля и UI.
      </p>
    </section>
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
