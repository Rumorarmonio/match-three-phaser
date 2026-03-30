import type { BoardState, MatchGroup } from './types'

export const findMatches = (board: BoardState): MatchGroup[] => {
  const matches: MatchGroup[] = []

  for (let row = 0; row < board.length; row += 1) {
    let startColumn = 0

    while (startColumn < board[row].length) {
      const gemType = board[row][startColumn]
      let endColumn = startColumn + 1

      while (endColumn < board[row].length && board[row][endColumn] === gemType) {
        endColumn += 1
      }

      if (endColumn - startColumn >= 3) {
        const match: MatchGroup = []

        for (let column = startColumn; column < endColumn; column += 1) {
          match.push({ row, column })
        }

        matches.push(match)
      }

      startColumn = endColumn
    }
  }

  for (let column = 0; column < board[0].length; column += 1) {
    let startRow = 0

    while (startRow < board.length) {
      const gemType = board[startRow][column]
      let endRow = startRow + 1

      while (endRow < board.length && board[endRow][column] === gemType) {
        endRow += 1
      }

      if (endRow - startRow >= 3) {
        const match: MatchGroup = []

        for (let row = startRow; row < endRow; row += 1) {
          match.push({ row, column })
        }

        matches.push(match)
      }

      startRow = endRow
    }
  }

  return matches
}
