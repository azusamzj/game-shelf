import { View, Text } from '@tarojs/components'
import './index.scss'

export default function Profile() {
  return (
    <View className='page'>
      <Text className='page-title'>设置</Text>

      <View className='menu'>
        <Text className='menu-item'>隐私政策（M5）</Text>
        <Text className='menu-item'>用户协议（M5）</Text>
        <Text className='menu-item'>注销账号（M5）</Text>
        <Text className='menu-item'>关于</Text>
      </View>
    </View>
  )
}
