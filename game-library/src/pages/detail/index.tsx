import { View, Text } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import './index.scss'

export default function Detail() {
  const router = useRouter()
  const gameId = router.params.gameId

  return (
    <View className='page'>
      <Text className='page-title'>游戏详情</Text>
      <Text className='page-desc'>
        游戏 ID：{gameId || '未指定'}（M1 接入 getGameDetail）
      </Text>
    </View>
  )
}
