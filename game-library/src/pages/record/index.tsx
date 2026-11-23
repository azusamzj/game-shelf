import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import { useRouter } from '@tarojs/taro'
import { GAME_STATUS_OPTIONS, type GameStatus } from '@/types'
import './index.scss'

export default function Record() {
  const router = useRouter()
  const gameId = router.params.gameId
  const [status, setStatus] = useState<GameStatus>('want_to_play')

  return (
    <View className='page'>
      <Text className='page-title'>记录游戏</Text>
      <Text className='page-desc'>
        {gameId ? `游戏 ID：${gameId}` : '请从游戏详情页进入记录页。'}
      </Text>

      <View className='record-section'>
        <Text className='record-section__label'>状态</Text>
        <View className='record-options'>
          {GAME_STATUS_OPTIONS.map((item) => (
            <Text
              key={item.value}
              className={`record-option ${status === item.value ? 'record-option--active' : ''}`}
              onClick={() => setStatus(item.value)}
            >
              {item.label}
            </Text>
          ))}
        </View>
      </View>

      <View className='record-section'>
        <Text className='record-section__label'>评分</Text>
        <Text className='record-section__value'>1 - 10</Text>
      </View>

      <View className='record-section'>
        <Text className='record-section__label'>心得</Text>
        <Text className='record-section__value'>最多 500 字</Text>
      </View>

      <View className='record-section'>
        <Text className='record-section__label'>截图</Text>
        <Text className='record-section__value'>最多 9 张，单张不超过 2MB</Text>
      </View>

      <Text className='record-hint'>表单提交将在 M2 阶段接入 saveUserGame。</Text>
    </View>
  )
}
