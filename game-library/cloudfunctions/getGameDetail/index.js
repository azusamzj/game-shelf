// getGameDetail - 游戏详情
// 简化版：本地 → RAWG → 缓存 7 天 → 临时 URL 取封面
const { cloud } = require('wx-server-sdk')
const https = require('https')
const http = require('http')
const url = require('url')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
var db = cloud.database()
var gamesCol = db.collection('games')

var RAWG_API_BASE = 'https://api.rawg.io/api'
var CACHE_TTL = 7 * 24 * 3600

function rawgGet(path, query) {
  query = query || {}
  return new Promise(function (resolve, reject) {
    var key = process.env.RAWG_API_KEY
    if (!key) return reject(new Error('RAWG_API_KEY missing'))
    var qs = new URLSearchParams(Object.assign({ key: key }, query)).toString()
    var fullUrl = RAWG_API_BASE + path + '?' + qs
    var parsed = url.parse(fullUrl)
    var mod = parsed.protocol === 'https:' ? https : http
    var req = mod.request({
      hostname: parsed.hostname,
      path: parsed.path + (parsed.search || ''),
      method: 'GET',
      headers: { 'User-Agent': 'game-library-miniapp/1.0' },
      timeout: 8000
    }, function (res) {
      var data = ''
      res.on('data', function (c) { data += c })
      res.on('end', function () {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch (e) { reject(new Error('RAWG parse fail')) }
      })
    })
    req.on('error', reject)
    req.on('timeout', function () { req.destroy(new Error('RAWG timeout')) })
    req.end()
  })
}

function normalizeDetail(raw) {
  return {
    rawg_id: raw.id,
    slug: raw.slug,
    name: raw.name,
    summary: raw.description_raw || raw.description || '',
    first_release_date: raw.released ? Math.floor(new Date(raw.released).getTime() / 1000) : null,
    genres: (raw.genres || []).map(function (g) { return g.name }),
    platforms: (raw.platforms || []).map(function (p) { return p.platform && p.platform.name }).filter(Boolean),
    developers: (raw.developers || []).map(function (d) { return d.name }),
    publishers: (raw.publishers || []).map(function (p) { return p.name }),
    metacritic_score: raw.metacritic || null,
    rating: raw.rating || null,
    cover_url: raw.background_image || null,
    tags: (raw.tags || []).slice(0, 10).map(function (t) { return t.name }),
    status: raw.tba ? 'upcoming' : 'released',
    source_updated_at: Math.floor(Date.now() / 1000)
  }
}

async function upsertDetail(doc) {
  if (!doc.slug) return null
  var existing = await gamesCol.where({ slug: doc.slug }).limit(1).get()
  var now = Math.floor(Date.now() / 1000)
  if (existing.data.length > 0) {
    var id = existing.data[0]._id
    await gamesCol.doc(id).update({ data: Object.assign({}, doc, { updated_at: now }) })
    return Object.assign({ _id: id }, doc, { updated_at: now })
  } else {
    var res = await gamesCol.add({ data: Object.assign({}, doc, { created_at: now, updated_at: now }) })
    return Object.assign({ _id: res._id }, doc, { created_at: now, updated_at: now })
  }
}

async function getTempUrl(fileID) {
  if (!fileID) return null
  try {
    var res = await cloud.getTempFileURL({ fileList: [fileID] })
    if (res.fileList && res.fileList[0]) return res.fileList[0].tempFileURL
  } catch (e) {
    console.warn('[getTempUrl] fail:', e.message)
  }
  return null
}

exports.main = async function (event) {
  try {
    var slug = event.slug
    var gameId = event.gameId
    var now = Math.floor(Date.now() / 1000)

    // 1. 本地查
    var localRes = slug
      ? await gamesCol.where({ slug: slug }).limit(1).get()
      : gameId ? await gamesCol.where({ _id: gameId }).limit(1).get() : { data: [] }
    var game = localRes.data[0] || null

    // 2. 缓存新鲜 → 返回
    if (game && game.source_updated_at && now - game.source_updated_at < CACHE_TTL) {
      var coverTempUrl = await getTempUrl(game.cover_file_id)
      return { code: 0, message: 'ok', data: Object.assign({}, game, { cover_url: coverTempUrl, stale: false }) }
    }

    // 3. 回源 RAWG
    var rawgSlug = slug || (game && game.slug)
    if (rawgSlug) {
      var rawgRes = await rawgGet('/games/' + encodeURIComponent(rawgSlug)).catch(function () { return null })
      if (rawgRes && rawgRes.status === 200 && rawgRes.body) {
        var doc = normalizeDetail(rawgRes.body)
        var saved = await upsertDetail(doc)
        var coverTempUrl2 = await getTempUrl(saved && saved.cover_file_id)
        return { code: 0, message: 'ok', data: Object.assign({}, saved, { cover_url: coverTempUrl2, stale: false }) }
      }
    }

    // 4. 降级
    if (game) {
      var coverTempUrl3 = await getTempUrl(game.cover_file_id)
      return { code: 50002, message: 'cached', data: Object.assign({}, game, { cover_url: coverTempUrl3, stale: true }) }
    }

    return { code: 404, message: 'not found', data: null }
  } catch (err) {
    console.error('[getGameDetail] fatal:', err)
    return { code: 50001, message: err && err.message ? err.message : 'internal', data: null }
  }
}
