import { callFunction } from './cloud'
import { ErrorCode, type Game } from '@/types'

export async function searchGames(keyword: string, pageSize = 20) {
  return callFunction<{ list: Game[]; nextCursor?: string }>('searchGames', {
    keyword,
    pageSize
  })
}

export async function getGameDetail(gameId: string) {
  return callFunction<Game>('getGameDetail', { gameId })
}

export async function listPopularGames(pageSize = 20) {
  return callFunction<{ list: Game[] }>('searchGames', {
    sort: 'popular',
    pageSize
  })
}
