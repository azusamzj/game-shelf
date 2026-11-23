import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import { searchGames } from '@/services/game'
import { ErrorCode } from '@/types'
import './index.scss'

interface GameItem {
  _id: string
  name: string
  genres?: string[]
  metacritic_score?: number
  cover_file_id?: string
  cover_url?: string
}

export default function Index() {
  const [games, setGames] = useState<GameItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string>('')

  useEffect(() => {
    searchGames('', 20)
      .then((res) => {
        if (res.code === ErrorCode.SUCCESS && res.data) {
          setGames(res.data.list || [])
        } else {
          setErr(res.message || '加载失败')
        }
      })
      .catch((e: any) => setErr(e.message || '网络错误'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <View className='page'>
      <View className='page-header'>
        <Text className='page-title'>发现</Text>
        <Text className='page-subtitle'>探索游戏，记录每一次玩过的时光</Text>
      </View>

      <View className='section'>
        <Text className='section-title'>热门游戏</Text>
        {loading && <View className='empty-hint'>加载中…</View>}
        {!loading && err && <View className='empty-hint'>{err}</View>}
        {!loading && !err && games.length === 0 && (
          <View className='empty-hint'>暂无游戏，搜索看看？</View>
        )}
        {games.length > 0 && (
          <View className='game-grid'>
            {games.map((g) => (
              <View className='game-card' key={g._id}>
                <Text className='game-card__name'>{g.name}</Text>
                {g.metacritic_score !== undefined && (
                  <Text className='game-card__score'>MC {g.metacritic_score}</Text>
                )}
                {g.genres && g.genres.length > 0 && (
                  <Text className='game-card__genres'>{g.genres.slice(0, 3).join(' · ')}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}
