import { PropsWithChildren } from 'react'
import { useLaunch, useDidShow, useDidHide } from '@tarojs/taro'
import Taro from '@tarojs/taro'

import './app.scss'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('[App] launched. env:', process.env.TARO_ENV)

    if (process.env.TARO_ENV === 'weapp') {
      try {
        Taro.cloud.init({
          env: process.env.TARO_APP_CLOUD_ENV,
          traceUser: true
        })
        console.log('[App] cloud init ok')
      } catch (e) {
        console.warn('[App] cloud init failed:', e)
      }
    }
  })

  useDidShow(() => {
    console.log('[App] show')
  })

  useDidHide(() => {
    console.log('[App] hide')
  })

  return children
}

export default App
