// listUserGames - 当前用户的游戏记录列表
// M2 依赖的读取接口，先用 db 权限 "仅创建者可读写" 过滤
const { cloud } = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const userGamesCol = db.collection('user_games')
const gamesCol = db.collection('games')

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { status } = event

  if (!OPENID) {
    return { code: 40101, message: 'not logged in', data: [] }
  }

  try {
    const query = { _openid: OPENID }
    if (status) query.status = status

    const res = await userGamesCol.where(query).orderBy('updated_at', 'desc').limit(100).get()

    // 补游戏元信息
    const gameIds = [...new Set(res.data.map((r) => r.game_id).filter(Boolean))]
    let gameMap = {}
    if (gameIds.length > 0) {
      // _id 过滤最多 20 个，分批
      const chunkSize = 20
      for (let i = 0; i < gameIds.length; i += chunkSize) {
        const chunk = gameIds.slice(i, i + chunkSize)
        const gRes = await gamesCol.where({ _id: db.command.in(chunk) }).get()
        for (const g of gRes.data) gameMap[g._id] = g
      }
    }

    const list = res.data.map((r) => ({
      ...r,
      game: gameMap[r.game_id] || null
    }))

    return { code: 0, message: 'ok', data: list }
  } catch (err) {
    console.error('[listUserGames] fatal:', err)
    return { code: 50001, message: err.message || 'internal error', data: [] }
  }
}
