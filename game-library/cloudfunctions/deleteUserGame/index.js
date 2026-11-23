// deleteUserGame - 删除用户游戏记录
// M2 阶段实现：归属校验 + 删记录 + 删云存储文件
const { cloud } = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  console.log('[deleteUserGame] event:', event)
  return { code: 50099, message: '尚未实现', data: null }
}
