// searchGames - 游戏搜索与列表
// M1 阶段接入 RAWG 回源与本地库归一化
const { cloud } = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  console.log('[searchGames] event:', event)
  return { code: 50099, message: '尚未实现', data: null }
}
