// deleteAccount - 注销当前用户
// M5 阶段实现：删全部 user_games + 截图文件
const { cloud } = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  console.log('[deleteAccount] event:', event)
  return { code: 50099, message: '尚未实现', data: null }
}
