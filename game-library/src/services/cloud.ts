import Taro from '@tarojs/taro'
import { ErrorCode, type ApiResponse } from '@/types'

/**
 * 统一云函数调用封装
 * H5 / 非微信平台直接抛出，不调用
 */
export async function callFunction<T = any>(
  name: string,
  data?: Record<string, any>
): Promise<ApiResponse<T>> {
  if (process.env.TARO_ENV !== 'weapp') {
    throw new Error('云函数仅在微信小程序端可用')
  }

  try {
    const res = await Taro.cloud.callFunction({ name, data })
    const result = res.result as ApiResponse<T>
    if (!result || typeof result.code === 'undefined') {
      throw new Error(`云函数 ${name} 返回格式异常`)
    }
    if (result.code !== ErrorCode.SUCCESS) {
      console.warn(`[cloud] ${name} non-zero code:`, result.code, result.message)
    }
    return result
  } catch (err) {
    console.error(`[cloud] ${name} call failed:`, err)
    throw err
  }
}
