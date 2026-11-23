import { View, Text } from '@tarojs/components'
import './index.scss'

export default function Library() {
  return (
    <View className='page'>
      <Text className='page-title'>我的游戏库</Text>
      <Text className='empty-hint'>还没有记录，去发现页找一款游戏吧（M2 接入 saveUserGame）</Text>
    </View>
  )
}
