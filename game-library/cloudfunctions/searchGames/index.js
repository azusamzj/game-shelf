// searchGames - 游戏搜索与列表
// M1 实现：先查本地 games，空时回源 RAWG，归一化后 upsert，返回投影字段
const { cloud } = require('wx-server-sdk')
const https = require('https')
const http = require('http')
const url = require('url')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const gamesCol = db.collection('games')

const RAWG_API_BASE = 'https://api.rawg.io/api'
const PROJECTION = {
  _id: true,
  name: true,
  slug: true,
  summary: true,
  first_release_date: true,
  genres: true,
  metacritic_score: true,
  rating: true,
  cover_file_id: true
}

// ========== RAWG HTTP 请求 ==========
function rawgGet(path, query = {}) {
  return new Promise((resolve, reject) => {
    const key = process.env.RAWG_API_KEY
    if (!key) {
      return reject(new Error('RAWG_API_KEY env missing'))
    }
    const qs = new URLSearchParams({ key, ...query }).toString()
    const fullUrl = `${RAWG_API_BASE}${path}?${qs}`
    const parsed = url.parse(fullUrl)
    const options = {
      hostname: parsed.hostname,
      path: parsed.path + (parsed.search || ''),
      method: 'GET',
      headers: { 'User-Agent': 'game-library-miniapp/1.0' },
      timeout: 8000
    }
    const mod = parsed.protocol === 'https:' ? https : http
    const req = mod.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch (e) {
          reject(new Error('RAWG response parse fail: ' + data.slice(0, 200)))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('RAWG timeout')))
    req.end()
  })
}

// ========== RAWG → 本地游戏文档 ==========
function normalizeRawgGame(raw) {
  const genres = (raw.genres || []).map((g) => g.name).filter(Boolean)
  const platforms = (raw.platforms || []).map((p) => p.platform && p.platform.name).filter(Boolean)
  const coverUrl = raw.background_image || null

  return {
    rawg_id: raw.id,
    slug: raw.slug,
    name: raw.name,
    summary: raw.description_raw || '',
    first_release_date: raw.released ? Math.floor(new Date(raw.released).getTime() / 1000) : undefined,
    genres,
    platforms,
    developers: (raw.developers || []).map((d) => d.name),
    publishers: (raw.publishers || []).map((p) => p.name),
    metacritic_score: raw.metacritic || undefined,
    rating: raw.rating || undefined,
    cover_url: coverUrl,
    status: raw.tba ? 'upcoming' : 'released',
    source_updated_at: Math.floor(Date.now() / 1000)
  }
}

// ========== upsert 到 games 集合（按 slug 唯一） ==========
async function upsertGame(doc) {
  if (!doc.slug) return null
  const existing = await gamesCol.where({ slug: doc.slug }).limit(1).get()
  const now = Math.floor(Date.now() / 1000)
  const base = { ...doc, updated_at: now }
  if (existing.data.length > 0) {
    const id = existing.data[0]._id
    delete base._id
    await gamesCol.doc(id).update({ data: base })
    return { _id: id, ...base }
  } else {
    base.created_at = now
    const res = await gamesCol.add({ data: base })
    return { _id: res._id, ...base }
  }
}

// ========== 封面从 RAWG URL 下载并转存云存储 ==========
async function saveCoverToStorage(rawgCoverUrl, slug) {
  if (!rawgCoverUrl || !slug) return null
  // 先查是否已有同 slug 的封面
  const existing = await db.collection('covers').where({ slug }).limit(1).get().catch(() => null)
  if (existing && existing.data.length > 0) {
    return existing.data[0].file_id
  }
  try {
    const res = await cloud.downloadFile({ fileID: `cloud://placeholder` }).catch(() => null)
    // 用 HTTP 下载
    const fileRes = await new Promise((resolve, reject) => {
      https.get(rawgCoverUrl, (r) => {
        const chunks = []
        r.on('data', (c) => chunks.push(c))
        r.on('end', () => resolve(Buffer.concat(chunks)))
        r.on('error', reject)
      }).on('error', reject)
    })
    const upload = await cloud.uploadFile({
      cloudPath: `covers/${slug}.jpg`,
      fileContent: fileRes
    })
    return upload.fileID
  } catch (e) {
    console.warn('[saveCoverToStorage] failed:', e.message)
    return null
  }
}

// ========== 主入口 ==========
exports.main = async (event) => {
  const { keyword = '', genre, platform, sort, pageSize = 20, cursor } = event

  try {
    // 1. 本地查询
    const localQuery: any = {}
    if (keyword) {
      localQuery.name = db.RegExp({ regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' })
    }
    if (genre) localQuery.genres = genre
    if (platform) localQuery.platforms = platform

    let localRes
    if (cursor) {
      const after = JSON.parse(cursor)
      localRes = await gamesCol
        .where(localQuery)
        .orderBy('updated_at', 'desc')
        .orderBy('_id', 'asc')
        .where(_.or([
          _.and([{ updated_at: _.lt(after.updated_at) }]),
          _.and([{ updated_at: _.eq(after.updated_at) }, { _id: _.gt(after._id) }])
        ]))
        .limit(pageSize)
        .get()
    } else {
      localRes = await gamesCol.where(localQuery).orderBy('updated_at', 'desc').limit(pageSize).get()
    }

    let list = localRes.data

    // 2. 本地不足 → 回源 RAWG
    if (list.length === 0 || list.length < pageSize) {
      try {
        const rawgQuery: any = { page_size: pageSize, ordering: sort === 'popular' ? '-rating' : '-added' }
        if (keyword) rawgQuery.search = keyword
        if (genre) rawgQuery.genres = genre
        if (platform) rawgQuery.platforms = platform
        const rawgRes = await rawgGet('/games', rawgQuery)

        if (rawgRes.status === 200 && rawgRes.body.results) {
          const upserted = []
          for (const raw of rawgRes.body.results) {
            const doc = normalizeRawgGame(raw)
            // 异步存封面，不阻塞
            saveCoverToStorage(doc.cover_url, doc.slug).then((fileID) => {
              if (fileID) {
                gamesCol.where({ slug: doc.slug }).get().then((r) => {
                  if (r.data[0]) gamesCol.doc(r.data[0]._id).update({ data: { cover_file_id: fileID } })
                }).catch(() => {})
              }
            }).catch(() => {})
            const saved = await upsertGame(doc)
            if (saved) upserted.push({ _id: saved._id, name: saved.name, slug: saved.slug, genres: saved.genres, metacritic_score: saved.metacritic_score, cover_file_id: saved.cover_file_id })
          }
          if (list.length === 0) list = upserted
          else list = [...list, ...upserted].slice(0, pageSize)
        }
      } catch (rawgErr) {
        console.warn('[searchGames] RAWG fallback failed:', rawgErr.message)
      }
    }

    // 3. 游标
    const nextCursor = list.length >= pageSize
      ? JSON.stringify({ updated_at: list[list.length - 1].updated_at || 0, _id: list[list.length - 1]._id })
      : undefined

    return { code: 0, message: 'ok', data: { list, nextCursor } }
  } catch (err) {
    console.error('[searchGames] fatal:', err)
    return { code: 50001, message: err.message || 'internal error', data: null }
  }
}
