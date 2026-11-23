// syncGames - 定时同步热门 / 新游
// M1 阶段实现：每日定时触发，幂等 upsert
const { cloud } = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  console.log('[syncGames] event:', event)
  return { code: 50099, message: '尚未实现', data: null }
}
