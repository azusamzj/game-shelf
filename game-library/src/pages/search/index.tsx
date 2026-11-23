import { View, Text, Input } from '@tarojs/components'
import { useState } from 'react'
import './index.scss'

export default function Search() {
  const [keyword, setKeyword] = useState('')

  return (
    <View className='page'>
      <View className='search-bar'>
        <Input
          className='search-input'
          placeholder='搜索游戏名称'
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
        />
      </View>
      <View className='empty-hint'>输入关键词开始搜索（M1 接入 searchGames）</View>
    </View>
  )
}
