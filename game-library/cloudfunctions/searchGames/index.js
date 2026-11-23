// searchGames - 极简版：移除所有可能的 API 兼容问题
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
var db = cloud.database()

function buildQuery(obj) {
  var parts = []
  for (var k in obj) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(obj[k])))
    }
  }
  return parts.join('&')
}

function rawgGet(path, queryObj) {
  return new Promise(function (resolve, reject) {
    var key = process.env.RAWG_API_KEY
    if (!key) return reject(new Error('RAWG_API_KEY missing'))
    var qs = buildQuery(Object.assign({ key: key }, queryObj || {}))
    var fullPath = path + '?' + qs

    var req = https.request({
      hostname: 'api.rawg.io',
      path: fullPath,
      method: 'GET',
      headers: { 'User-Agent': 'game-library-miniapp/1.0' },
      timeout: 10000
    }, function (res) {
      var data = ''
      res.on('data', function (c) { data += c })
      res.on('end', function () {
        var json = null
        try { json = JSON.parse(data) } catch (e) {}
        resolve({ status: res.statusCode, body: json, raw: data.substring(0, 300) })
      })
    })
    req.on('error', reject)
    req.on('timeout', function () { req.destroy(new Error('RAWG timeout')) })
    req.end()
  })
}

function normalizeRawgGame(raw) {
  if (!raw || !raw.id) return null
  return {
    rawg_id: raw.id,
    slug: raw.slug || '',
    name: raw.name || '',
    summary: raw.description_raw || raw.description || '',
    first_release_date: raw.released ? Math.floor(new Date(raw.released).getTime() / 1000) : null,
    genres: (raw.genres || []).map(function (g) { return g.name }).filter(Boolean),
    platforms: (raw.platforms || []).map(function (p) { return p.platform && p.platform.name }).filter(Boolean),
    developers: (raw.developers || []).map(function (d) { return d.name }).filter(Boolean),
    publishers: (raw.publishers || []).map(function (p) { return p.name }).filter(Boolean),
    metacritic_score: raw.metacritic || null,
    rating: raw.rating || null,
    status: raw.tba ? 'upcoming' : 'released',
    source_updated_at: Math.floor(Date.now() / 1000)
  }
}

async function upsertGame(doc) {
  if (!doc || !doc.slug) return null
  var existing = await db.collection('games').where({ slug: doc.slug }).limit(1).get()
  var now = Math.floor(Date.now() / 1000)
  if (existing.data.length > 0) {
    var id = existing.data[0]._id
    try {
      await db.collection('games').doc(id).update({ data: Object.assign({}, doc, { updated_at: now }) })
      return Object.assign({ _id: id }, doc, { updated_at: now })
    } catch (e) {
      return Object.assign({ _id: id }, existing.data[0])
    }
  } else {
    var res = await db.collection('games').add({ data: Object.assign({}, doc, { created_at: now, updated_at: now }) })
    return Object.assign({ _id: res._id }, doc, { created_at: now, updated_at: now })
  }
}

exports.main = async function (event) {
  var keyword = (event && event.keyword) || ''
  var pageSize = event && event.pageSize || 20
  var debug = { keyword: keyword, pageSize: pageSize }

  try {
    // 1. 先查本地
    var localQuery = {}
    if (keyword) {
      try {
        localQuery.name = db.RegExp({ regexp: keyword, options: 'i' })
      } catch (e) {
        localQuery.name = keyword
      }
    }
    var localRes = await db.collection('games').where(localQuery).orderBy('updated_at', 'desc').limit(pageSize).get()
    var list = localRes.data || []
    debug.localCount = list.length

    // 2. 本地空就回源 RAWG
    if (list.length === 0) {
      debug.needRawg = true
      var rawgQuery = { page_size: pageSize, ordering: '-added' }
      if (keyword) rawgQuery.search = keyword

      var rawgRes = await rawgGet('/games', rawgQuery)
      debug.rawgStatus = rawgRes.status

      if (rawgRes.status === 200 && rawgRes.body && rawgRes.body.results) {
        debug.rawgCount = rawgRes.body.count
        debug.rawgResultsLen = rawgRes.body.results.length

        for (var i = 0; i < rawgRes.body.results.length; i++) {
          var doc = normalizeRawgGame(rawgRes.body.results[i])
          if (doc) {
            var saved = await upsertGame(doc)
            if (saved) list.push(saved)
          }
        }
      } else {
        debug.rawgRaw = rawgRes.raw
      }
    }

    return { code: 0, message: 'ok', data: { list: list, debug: debug } }
  } catch (err) {
    debug.error = err && err.stack ? err.stack : String(err)
    return { code: 50001, message: err && err.message ? err.message : 'internal', data: { debug: debug } }
  }
}
