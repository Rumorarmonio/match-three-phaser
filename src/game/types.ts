import { GEM_TYPES } from './constants'

export type GridPosition = {
  row: number
  column: number
}

export type BoardSettings = {
  rows: number
  columns: number
}

export type GemType = (typeof GEM_TYPES)[number]

export type BoardCell = GemType | null

export type BoardState = BoardCell[][]

export type MatchGroup = GridPosition[]

export type FallMove = {
  from: GridPosition
  to: GridPosition
}

export type RefillMove = {
  gemType: GemType
  spawnRow: number
  to: GridPosition
}
