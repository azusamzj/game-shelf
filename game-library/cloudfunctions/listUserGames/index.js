// listUserGames - 当前用户的游戏记录列表
// M2 阶段实现
const { cloud } = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  console.log('[listUserGames] event:', event)
  return { code: 50099, message: '尚未实现', data: null }
}
