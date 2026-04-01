import { BOARD_COLUMNS, BOARD_ROWS, DEFAULT_GEM_TYPE_COUNT, GEM_TYPES } from './constants'
import type {
  BoardState,
  BoardSettings,
  FallMove,
  GemType,
  GridPosition,
  MatchGroup,
  RefillMove,
} from './types'

const pickRandomGemType = (availableGemTypes: GemType[]): GemType => {
  const randomIndex = Math.floor(Math.random() * availableGemTypes.length)
  return availableGemTypes[randomIndex]
}

const shuffleGemTypes = (gemTypes: GemType[]): GemType[] => {
  const shuffledGemTypes = [...gemTypes]

  for (let index = shuffledGemTypes.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const currentGemType = shuffledGemTypes[index]
    shuffledGemTypes[index] = shuffledGemTypes[randomIndex]
    shuffledGemTypes[randomIndex] = currentGemType
  }

  return shuffledGemTypes
}

const getDefaultBoardSettings = (): BoardSettings => ({
  rows: BOARD_ROWS,
  columns: BOARD_COLUMNS,
  gemTypes: GEM_TYPES.slice(0, DEFAULT_GEM_TYPE_COUNT),
})

const createsMatchAt = (
  board: BoardState,
  row: number,
  column: number,
  gemType: GemType,
  boardSettings: BoardSettings,
): boolean => {
  const { columns, rows } = boardSettings
  let horizontalCount = 1
  let verticalCount = 1

  for (let currentColumn = column - 1; currentColumn >= 0; currentColumn -= 1) {
    if (board[row][currentColumn] !== gemType) {
      break
    }

    horizontalCount += 1
  }

  for (let currentColumn = column + 1; currentColumn < columns; currentColumn += 1) {
    if (board[row][currentColumn] !== gemType) {
      break
    }

    horizontalCount += 1
  }

  for (let currentRow = row - 1; currentRow >= 0; currentRow -= 1) {
    if (board[currentRow][column] !== gemType) {
      break
    }

    verticalCount += 1
  }

  for (let currentRow = row + 1; currentRow < rows; currentRow += 1) {
    if (board[currentRow]?.[column] !== gemType) {
      break
    }

    verticalCount += 1
  }

  return horizontalCount >= 3 || verticalCount >= 3
}

const fillBoardPositions = (
  board: BoardState,
  positions: GridPosition[],
  boardSettings: BoardSettings,
  positionIndex = 0,
): boolean => {
  if (positionIndex >= positions.length) {
    return true
  }

  const { row, column } = positions[positionIndex]
  const nextGemTypes = shuffleGemTypes(boardSettings.gemTypes)

  for (const gemType of nextGemTypes) {
    board[row][column] = gemType

    if (createsMatchAt(board, row, column, gemType, boardSettings)) {
      continue
    }

    if (fillBoardPositions(board, positions, boardSettings, positionIndex + 1)) {
      return true
    }
  }

  board[row][column] = null
  return false
}

export const createInitialBoard = (
  boardSettings: BoardSettings = getDefaultBoardSettings(),
): BoardState => {
  const { rows, columns, gemTypes } = boardSettings
  const board: BoardState = []

  for (let row = 0; row < rows; row += 1) {
    const currentRow: GemType[] = []
    board.push(currentRow)

    for (let column = 0; column < columns; column += 1) {
      currentRow.push(pickRandomGemType(gemTypes))
    }
  }

  const positions: GridPosition[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      positions.push({ row, column })
    }
  }

  fillBoardPositions(board, positions, boardSettings)

  return board
}

export const swapBoardCells = (
  board: BoardState,
  first: GridPosition,
  second: GridPosition,
): void => {
  const firstGemType = board[first.row][first.column]
  board[first.row][first.column] = board[second.row][second.column]
  board[second.row][second.column] = firstGemType
}

export const clearMatchedCells = (board: BoardState, matches: MatchGroup[]): void => {
  for (const match of matches) {
    for (const position of match) {
      board[position.row][position.column] = null
    }
  }
}

export const applyGravity = (
  board: BoardState,
  boardSettings: BoardSettings = getDefaultBoardSettings(),
): FallMove[] => {
  const { columns, rows } = boardSettings
  const moves: FallMove[] = []

  for (let column = 0; column < columns; column += 1) {
    let targetRow = rows - 1

    for (let row = rows - 1; row >= 0; row -= 1) {
      const gemType = board[row][column]

      if (gemType === null) {
        continue
      }

      if (row !== targetRow) {
        board[targetRow][column] = gemType
        board[row][column] = null
        moves.push({
          from: { row, column },
          to: { row: targetRow, column },
        })
      }

      targetRow -= 1
    }
  }

  return moves
}

export const refillBoard = (
  board: BoardState,
  boardSettings: BoardSettings = getDefaultBoardSettings(),
): RefillMove[] => {
  const { columns, rows, gemTypes } = boardSettings
  const moves: RefillMove[] = []
  const refillPositions: GridPosition[] = []

  for (let column = 0; column < columns; column += 1) {
    let spawnRow = -1

    for (let row = rows - 1; row >= 0; row -= 1) {
      if (board[row][column] !== null) {
        continue
      }

      board[row][column] = pickRandomGemType(gemTypes)
      refillPositions.push({ row, column })
      moves.push({
        gemType: board[row][column] as GemType,
        spawnRow,
        to: { row, column },
      })
      spawnRow -= 1
    }
  }

  fillBoardPositions(board, refillPositions, boardSettings)

  for (const move of moves) {
    move.gemType = board[move.to.row][move.to.column] as GemType
  }

  return moves
}
