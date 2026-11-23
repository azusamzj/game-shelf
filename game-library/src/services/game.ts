import { callFunction } from './cloud'

export async function searchGames(keyword: string, pageSize = 20) {
  return callFunction<{ list: any[]; nextCursor?: string }>('searchGames', {
    keyword,
    pageSize
  })
}

export async function getGameDetail(params: { gameId?: string; slug?: string }) {
  return callFunction<any>('getGameDetail', params)
}

export async function listPopularGames(pageSize = 20) {
  return callFunction<{ list: any[] }>('searchGames', {
    sort: 'popular',
    pageSize
  })
}
