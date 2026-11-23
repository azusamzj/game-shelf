import { View, Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import './index.scss'

export default function Index() {
  const [games] = useState<any[]>([])

  useEffect(() => {
    // TODO: M1 接入 getGameDetail / searchGames
  }, [])

  return (
    <View className='page'>
      <View className='page-header'>
        <Text className='page-title'>发现</Text>
        <Text className='page-subtitle'>探索游戏，记录每一次玩过的时光</Text>
      </View>

      <View className='section'>
        <Text className='section-title'>热门游戏</Text>
        {games.length === 0 ? (
          <View className='empty-hint'>数据加载中…（M1 阶段接入云函数）</View>
        ) : (
          <View className='game-grid'>
            {games.map((g) => (
              <View className='game-card' key={g._id}>
                <Text className='game-card__name'>{g.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}
