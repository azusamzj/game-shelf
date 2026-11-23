// getGameDetail - 游戏详情
// M1 阶段接入缓存策略 + SteamGridDB 补图
const { cloud } = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  console.log('[getGameDetail] event:', event)
  return { code: 50099, message: '尚未实现', data: null }
}
