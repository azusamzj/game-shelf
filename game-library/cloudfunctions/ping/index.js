// ping - 极简连通性测试
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = function (event, context) {
  return { code: 0, message: 'pong', data: { time: Date.now(), env: cloud.DYNAMIC_CURRENT_ENV } }
}
