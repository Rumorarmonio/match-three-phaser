import { BOARD_COLUMNS, BOARD_ROWS, GEM_TYPES } from './constants'
import type {
  BoardState,
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

const createsMatchAt = (
  board: BoardState,
  row: number,
  column: number,
  gemType: GemType,
): boolean => {
  let horizontalCount = 1
  let verticalCount = 1

  for (let currentColumn = column - 1; currentColumn >= 0; currentColumn -= 1) {
    if (board[row][currentColumn] !== gemType) {
      break
    }

    horizontalCount += 1
  }

  for (let currentColumn = column + 1; currentColumn < BOARD_COLUMNS; currentColumn += 1) {
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

  for (let currentRow = row + 1; currentRow < BOARD_ROWS; currentRow += 1) {
    if (board[currentRow]?.[column] !== gemType) {
      break
    }

    verticalCount += 1
  }

  return horizontalCount >= 3 || verticalCount >= 3
}

export const createInitialBoard = (): BoardState => {
  const board: BoardState = []

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    const currentRow: GemType[] = []
    board.push(currentRow)

    for (let column = 0; column < BOARD_COLUMNS; column += 1) {
      const availableGemTypes = GEM_TYPES.filter(
        (gemType) => !createsMatchAt(board, row, column, gemType),
      )

      currentRow.push(pickRandomGemType(availableGemTypes))
    }
  }

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

export const applyGravity = (board: BoardState): FallMove[] => {
  const moves: FallMove[] = []

  for (let column = 0; column < BOARD_COLUMNS; column += 1) {
    let targetRow = BOARD_ROWS - 1

    for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
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

export const refillBoard = (board: BoardState): RefillMove[] => {
  const moves: RefillMove[] = []

  for (let column = 0; column < BOARD_COLUMNS; column += 1) {
    let spawnRow = -1

    for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
      if (board[row][column] !== null) {
        continue
      }

      const availableGemTypes = GEM_TYPES.filter(
        (gemType) => !createsMatchAt(board, row, column, gemType),
      )
      const gemType = pickRandomGemType(availableGemTypes)

      board[row][column] = gemType
      moves.push({
        gemType,
        spawnRow,
        to: { row, column },
      })
      spawnRow -= 1
    }
  }

  return moves
}
