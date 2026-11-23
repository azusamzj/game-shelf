// searchGames - 简化版：本地查 → RAWG 回源 → upsert
// 暂时移除所有云存储调用，只做数据库 + HTTP
const cloud = require('wx-server-sdk')
const https = require('https')
const http = require('http')
const url = require('url')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
var db = cloud.database()
var gamesCol = db.collection('games')

var RAWG_API_BASE = 'https://api.rawg.io/api'

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

function normalizeRawgGame(raw) {
  return {
    rawg_id: raw.id,
    slug: raw.slug,
    name: raw.name,
    summary: raw.description_raw || '',
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

async function upsertGame(doc) {
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
    console.log('[searchGames] event:', JSON.stringify(event))
    var keyword = event.keyword || ''
    var genre = event.genre
    var pageSize = event.pageSize || 20

    var localQuery = {}
    if (keyword) {
      localQuery.name = db.RegExp({ regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' })
    }
    if (genre) localQuery.genres = genre

    console.log('[searchGames] local query:', JSON.stringify(localQuery))
    var localRes = await gamesCol.where(localQuery).orderBy('updated_at', 'desc').limit(pageSize).get()
    var list = localRes.data
    console.log('[searchGames] local count:', list.length)

    if (list.length === 0) {
      try {
        var rawgQuery = { page_size: pageSize, ordering: '-added' }
        if (keyword) rawgQuery.search = keyword
        if (genre) rawgQuery.genres = genre
        console.log('[searchGames] RAWG query:', JSON.stringify(rawgQuery))
        var rawgRes = await rawgGet('/games', rawgQuery)

        if (rawgRes.status === 200 && rawgRes.body && rawgRes.body.results) {
          console.log('[searchGames] RAWG returned:', rawgRes.body.results.length, 'results')
          for (var i = 0; i < rawgRes.body.results.length; i++) {
            var raw = rawgRes.body.results[i]
            var doc = normalizeRawgGame(raw)
            var saved = await upsertGame(doc)
            if (saved) list.push(saved)
          }
        } else {
          console.warn('[searchGames] RAWG bad response:', rawgRes.status)
        }
      } catch (rawgErr) {
        console.warn('[searchGames] RAWG fail:', rawgErr.message)
      }
    }

    console.log('[searchGames] done, returning', list.length, 'items')
    return { code: 0, message: 'ok', data: { list: list, nextCursor: undefined } }
  } catch (err) {
    console.error('[searchGames] fatal:', err && err.stack ? err.stack : err)
    return { code: 50001, message: err && err.message ? err.message : 'internal', data: null }
  }
}
