// listUserGames - 当前用户的游戏记录列表
const { cloud } = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
var db = cloud.database()
var userGamesCol = db.collection('user_games')
var gamesCol = db.collection('games')

exports.main = async function (event) {
  try {
    var wxContext = cloud.getWXContext()
    var OPENID = wxContext.OPENID
    if (!OPENID) {
      return { code: 40101, message: 'not logged in', data: [] }
    }

    var query = { _openid: OPENID }
    if (event.status) query.status = event.status

    var res = await userGamesCol.where(query).orderBy('updated_at', 'desc').limit(100).get()

    // 补游戏元信息
    var gameIds = []
    for (var i = 0; i < res.data.length; i++) {
      if (res.data[i].game_id) gameIds.push(res.data[i].game_id)
    }
    var gameMap = {}
    if (gameIds.length > 0) {
      var chunks = []
      for (var j = 0; j < gameIds.length; j += 20) chunks.push(gameIds.slice(j, j + 20))
      for (var k = 0; k < chunks.length; k++) {
        var gRes = await gamesCol.where({ _id: db.command.in(chunks[k]) }).get()
        for (var m = 0; m < gRes.data.length; m++) {
          gameMap[gRes.data[m]._id] = gRes.data[m]
        }
      }
    }

    var list = []
    for (var n = 0; n < res.data.length; n++) {
      var item = res.data[n]
      item.game = gameMap[item.game_id] || null
      list.push(item)
    }

    return { code: 0, message: 'ok', data: list }
  } catch (err) {
    console.error('[listUserGames] fatal:', err)
    return { code: 50001, message: err && err.message ? err.message : 'internal', data: [] }
  }
}
