import { BOARD_COLUMNS, BOARD_ROWS, GEM_TYPES } from './constants'
import type { BoardState, FallMove, GemType, GridPosition, MatchGroup } from './types'

const pickRandomGemType = (availableGemTypes: GemType[]): GemType => {
  const randomIndex = Math.floor(Math.random() * availableGemTypes.length)
  return availableGemTypes[randomIndex]
}

const createsStartMatch = (
  board: BoardState,
  currentRow: GemType[],
  row: number,
  column: number,
  gemType: GemType,
): boolean => {
  const hasHorizontalMatch =
    column >= 2 &&
    currentRow[column - 1] === gemType &&
    currentRow[column - 2] === gemType

  const hasVerticalMatch =
    row >= 2 &&
    board[row - 1][column] === gemType &&
    board[row - 2][column] === gemType

  return hasHorizontalMatch || hasVerticalMatch
}

export const createInitialBoard = (): BoardState => {
  const board: BoardState = []

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    const currentRow: GemType[] = []

    for (let column = 0; column < BOARD_COLUMNS; column += 1) {
      const availableGemTypes = GEM_TYPES.filter(
        (gemType) => !createsStartMatch(board, currentRow, row, column, gemType),
      )

      currentRow.push(pickRandomGemType(availableGemTypes))
    }

    board.push(currentRow)
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
