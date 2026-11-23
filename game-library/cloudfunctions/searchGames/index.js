// searchGames - 游戏搜索与列表
// M1 简化版：本地查 → RAWG 回源 → 归一化 upsert，封面先跳过存储
const { cloud } = require('wx-server-sdk')
const https = require('https')
const http = require('http')
const url = require('url')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const gamesCol = db.collection('games')

const RAWG_API_BASE = 'https://api.rawg.io/api'

// RAWG HTTP 请求
function rawgGet(path, query) {
  query = query || {}
  return new Promise((resolve, reject) => {
    const key = process.env.RAWG_API_KEY
    if (!key) {
      return reject(new Error('RAWG_API_KEY missing'))
    }
    const qs = new URLSearchParams(Object.assign({ key: key }, query)).toString()
    const fullUrl = RAWG_API_BASE + path + '?' + qs
    const parsed = url.parse(fullUrl)
    const mod = parsed.protocol === 'https:' ? https : http
    const req = mod.request({
      hostname: parsed.hostname,
      path: parsed.path + (parsed.search || ''),
      method: 'GET',
      headers: { 'User-Agent': 'game-library-miniapp/1.0' },
      timeout: 8000
    }, function (res) {
      var data = ''
      res.on('data', function (chunk) { data += chunk })
      res.on('end', function () {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch (e) {
          reject(new Error('RAWG parse fail'))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', function () { req.destroy(new Error('RAWG timeout')) })
    req.end()
  })
}

// RAWG → 本地文档
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
    cover_url: raw.background_image || null,
    status: raw.tba ? 'upcoming' : 'released',
    source_updated_at: Math.floor(Date.now() / 1000)
  }
}

// upsert
async function upsertGame(doc) {
  if (!doc.slug) return null
  var existing = await gamesCol.where({ slug: doc.slug }).limit(1).get()
  var now = Math.floor(Date.now() / 1000)
  if (existing.data.length > 0) {
    var id = existing.data[0]._id
    delete doc._id
    await gamesCol.doc(id).update({ data: Object.assign({}, doc, { updated_at: now }) })
    return Object.assign({ _id: id }, doc, { updated_at: now })
  } else {
    var res = await gamesCol.add({ data: Object.assign({}, doc, { created_at: now, updated_at: now }) })
    return Object.assign({ _id: res._id }, doc, { created_at: now, updated_at: now })
  }
}

// 封面下载存云存储
async function saveCover(rawUrl, slug) {
  if (!rawUrl || !slug) return null
  try {
    var fileRes = await new Promise(function (resolve, reject) {
      https.get(rawUrl, function (r) {
        var chunks = []
        r.on('data', function (c) { chunks.push(c) })
        r.on('end', function () { resolve(Buffer.concat(chunks)) })
        r.on('error', reject)
      }).on('error', reject)
    })
    var upload = await cloud.uploadFile({ cloudPath: 'covers/' + slug + '.jpg', fileContent: fileRes })
    return upload.fileID
  } catch (e) {
    console.warn('[saveCover] fail:', e.message)
    return null
  }
}

exports.main = async function (event) {
  try {
    var keyword = event.keyword || ''
    var genre = event.genre
    var pageSize = event.pageSize || 20

    // 1. 本地查询
    var localQuery = {}
    if (keyword) {
      localQuery.name = db.RegExp({ regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' })
    }
    if (genre) localQuery.genres = genre

    var localRes = await gamesCol.where(localQuery).orderBy('updated_at', 'desc').limit(pageSize).get()
    var list = localRes.data

    // 2. 本地空 → 回源 RAWG
    if (list.length === 0) {
      try {
        var rawgQuery = { page_size: pageSize, ordering: '-added' }
        if (keyword) rawgQuery.search = keyword
        if (genre) rawgQuery.genres = genre
        var rawgRes = await rawgGet('/games', rawgQuery)

        if (rawgRes.status === 200 && rawgRes.body && rawgRes.body.results) {
          for (var i = 0; i < rawgRes.body.results.length; i++) {
            var raw = rawgRes.body.results[i]
            var doc = normalizeRawgGame(raw)
            var saved = await upsertGame(doc)
            if (saved) list.push(saved)
            // 异步存封面
            saveCover(doc.cover_url, doc.slug).then(function (fileID) {
              if (fileID && saved) {
                gamesCol.doc(saved._id).update({ data: { cover_file_id: fileID } }).catch(function () {})
              }
            }).catch(function () {})
          }
        }
      } catch (rawgErr) {
        console.warn('[searchGames] RAWG fail:', rawgErr.message)
      }
    }

    return { code: 0, message: 'ok', data: { list: list, nextCursor: undefined } }
  } catch (err) {
    console.error('[searchGames] fatal:', err)
    return { code: 50001, message: err && err.message ? err.message : 'internal', data: null }
  }
}
