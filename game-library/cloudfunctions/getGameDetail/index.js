// getGameDetail - 简化版：纯数据库 + HTTP，移除云存储调用
const cloud = require('wx-server-sdk')
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

exports.main = async function (event) {
  try {
    console.log('[getGameDetail] event:', JSON.stringify(event))
    var slug = event.slug
    var gameId = event.gameId
    var now = Math.floor(Date.now() / 1000)

    var game = null
    if (slug) {
      var r1 = await gamesCol.where({ slug: slug }).limit(1).get()
      game = r1.data[0] || null
    } else if (gameId) {
      var r2 = await gamesCol.where({ _id: gameId }).limit(1).get()
      game = r2.data[0] || null
    }

    if (game && game.source_updated_at && now - game.source_updated_at < CACHE_TTL) {
      return { code: 0, message: 'ok', data: Object.assign({}, game, { stale: false }) }
    }

    var rawgSlug = slug || (game && game.slug)
    if (rawgSlug) {
      var rawgRes = await rawgGet('/games/' + encodeURIComponent(rawgSlug)).catch(function () { return null })
      if (rawgRes && rawgRes.status === 200 && rawgRes.body) {
        var doc = normalizeDetail(rawgRes.body)
        var saved = await upsertDetail(doc)
        return { code: 0, message: 'ok', data: Object.assign({}, saved, { stale: false }) }
      }
    }

    if (game) {
      return { code: 50002, message: 'cached', data: Object.assign({}, game, { stale: true }) }
    }

    return { code: 404, message: 'not found', data: null }
  } catch (err) {
    console.error('[getGameDetail] fatal:', err && err.stack ? err.stack : err)
    return { code: 50001, message: err && err.message ? err.message : 'internal', data: null }
  }
}
