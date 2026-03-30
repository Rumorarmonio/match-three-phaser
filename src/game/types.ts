import { GEM_TYPES } from './constants'

export type GridPosition = {
  row: number
  column: number
}

export type GemType = (typeof GEM_TYPES)[number]
