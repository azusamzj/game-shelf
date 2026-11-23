import { View, Text, Image } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { getGameDetail } from '@/services/game'
import { ErrorCode } from '@/types'
import './index.scss'

interface GameDetail {
  _id: string
  name: string
  summary?: string
  first_release_date?: number
  genres?: string[]
  platforms?: string[]
  developers?: string[]
  metacritic_score?: number
  rating?: number
  cover_url?: string
  cover_file_id?: string
  stale?: boolean
}

function formatDate(ts?: number) {
  if (!ts) return '-'
  return new Date(ts * 1000).toISOString().slice(0, 10)
}

export default function Detail() {
  const router = useRouter()
  const gameId = router.params.gameId
  const slug = router.params.slug
  const [game, setGame] = useState<GameDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!gameId && !slug) {
      setErr('缺少游戏 ID')
      setLoading(false)
      return
    }
    getGameDetail({ gameId: gameId as string, slug: slug as string })
      .then((res) => {
        if (res.code === ErrorCode.SUCCESS || res.code === 50002) {
          setGame(res.data)
        } else {
          setErr(res.message || '加载失败')
        }
      })
      .catch((e: any) => setErr(e.message || '网络错误'))
      .finally(() => setLoading(false))
  }, [gameId, slug])

  if (loading) return <View className='page'><Text className='empty-hint'>加载中…</Text></View>
  if (err) return <View className='page'><Text className='empty-hint'>{err}</Text></View>
  if (!game) return <View className='page'><Text className='empty-hint'>未找到</Text></View>

  return (
    <View className='page'>
      {game.cover_url && (
        <Image className='cover' src={game.cover_url} mode='aspectFill' />
      )}
      <Text className='page-title'>{game.name}</Text>
      {game.stale && <Text className='stale-tag'>⚠️ 上游不可用，显示的是缓存数据</Text>}

      <View className='info-row'>
        <Text className='label'>发行日期</Text>
        <Text className='value'>{formatDate(game.first_release_date)}</Text>
      </View>
      {game.metacritic_score !== undefined && (
        <View className='info-row'>
          <Text className='label'>Metacritic</Text>
          <Text className='value'>{game.metacritic_score}</Text>
        </View>
      )}
      {game.genres && game.genres.length > 0 && (
        <View className='info-row'>
          <Text className='label'>类型</Text>
          <Text className='value'>{game.genres.join(' · ')}</Text>
        </View>
      )}
      {game.platforms && game.platforms.length > 0 && (
        <View className='info-row'>
          <Text className='label'>平台</Text>
          <Text className='value'>{game.platforms.join(' · ')}</Text>
        </View>
      )}
      {game.developers && game.developers.length > 0 && (
        <View className='info-row'>
          <Text className='label'>开发商</Text>
          <Text className='value'>{game.developers.join(' · ')}</Text>
        </View>
      )}
      {game.summary && (
        <View className='summary'>
          <Text className='label'>简介</Text>
          <Text className='summary-text'>{game.summary}</Text>
        </View>
      )}
    </View>
  )
}
