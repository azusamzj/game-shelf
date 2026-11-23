import { callFunction } from './cloud'
import type { UserGame, GameStatus } from '@/types'

export async function listUserGames(status?: GameStatus) {
  return callFunction<UserGame[]>('listUserGames', { status })
}

export async function saveUserGame(payload: {
  gameId: string
  status: GameStatus
  rating?: number
  notes?: string
  playHours?: number
  fileIds?: string[]
}) {
  return callFunction<UserGame>('saveUserGame', payload)
}

export async function deleteUserGame(recordId: string) {
  return callFunction<null>('deleteUserGame', { recordId })
}
