// getGameDetail - 游戏详情
// M1 实现：本地查 → 缓存 7 天内直接返回 → 过期回源 RAWG 归一化 → 返回（含封面临时 URL）
const { cloud } = require('wx-server-sdk')
const https = require('https')
const http = require('http')
const url = require('url')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const gamesCol = db.collection('games')

const RAWG_API_BASE = 'https://api.rawg.io/api'
const CACHE_TTL = 7 * 24 * 3600 // 7 天

function rawgGet(path, query = {}) {
  return new Promise((resolve, reject) => {
    const key = process.env.RAWG_API_KEY
    if (!key) return reject(new Error('RAWG_API_KEY env missing'))
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
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch (e) { reject(new Error('RAWG parse fail')) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('RAWG timeout')))
    req.end()
  })
}

function normalizeDetail(raw) {
  return {
    rawg_id: raw.id,
    slug: raw.slug,
    name: raw.name,
    summary: raw.description_raw || raw.description || '',
    first_release_date: raw.released ? Math.floor(new Date(raw.released).getTime() / 1000) : undefined,
    genres: (raw.genres || []).map((g) => g.name),
    platforms: (raw.platforms || []).map((p) => p.platform && p.platform.name).filter(Boolean),
    developers: (raw.developers || []).map((d) => d.name),
    publishers: (raw.publishers || []).map((p) => p.name),
    metacritic_score: raw.metacritic || undefined,
    rating: raw.rating || undefined,
    cover_url: raw.background_image || null,
    tags: (raw.tags || []).slice(0, 10).map((t) => t.name),
    status: raw.tba ? 'upcoming' : 'released',
    source_updated_at: Math.floor(Date.now() / 1000)
  }
}

async function upsertDetail(doc) {
  if (!doc.slug) return null
  const existing = await gamesCol.where({ slug: doc.slug }).limit(1).get()
  const now = Math.floor(Date.now() / 1000)
  if (existing.data.length > 0) {
    const id = existing.data[0]._id
    delete doc._id
    await gamesCol.doc(id).update({ data: { ...doc, updated_at: now } })
    return { _id: id, ...doc }
  } else {
    const res = await gamesCol.add({ data: { ...doc, created_at: now, updated_at: now } })
    return { _id: res._id, ...doc }
  }
}

// 下载封面并存云存储
async function saveCover(rawgCoverUrl, slug) {
  if (!rawgCoverUrl || !slug) return null
  try {
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
    console.warn('[saveCover] failed:', e.message)
    return null
  }
}

// 云存储文件 → 临时下载 URL（因为存储权限是"所有用户不可读写"）
async function getTempUrl(fileID) {
  if (!fileID) return null
  try {
    const res = await cloud.getTempFileURL({ fileList: [fileID] })
    return res.fileList[0] && res.fileList[0].tempFileURL
  } catch (e) {
    console.warn('[getTempUrl] failed:', e.message)
    return null
  }
}

exports.main = async (event) => {
  const { gameId, slug } = event
  const targetId = slug || gameId

  if (!targetId) {
    return { code: 40001, message: 'gameId or slug required', data: null }
  }

  try {
    // 1. 本地查询
    let query = slug ? { slug } : { _id: gameId }
    const localRes = await gamesCol.where(query).limit(1).get()
    let game = localRes.data[0] || null
    const now = Math.floor(Date.now() / 1000)

    // 2. 缓存新鲜（7 天内）→ 直接返回
    if (game && game.source_updated_at && now - game.source_updated_at < CACHE_TTL) {
      const coverTempUrl = await getTempUrl(game.cover_file_id)
      return { code: 0, message: 'ok', data: { ...game, cover_url: coverTempUrl, stale: false } }
    }

    // 3. 回源 RAWG
    const rawgPath = slug ? `/games/${encodeURIComponent(slug)}` : `/games/${game.rawg_id || gameId}`
    const rawgRes = await rawgGet(rawgPath).catch(() => null)

    if (rawgRes && rawgRes.status === 200 && rawgRes.body) {
      const doc = normalizeDetail(rawgRes.body)
      const saved = await upsertDetail(doc)
      // 存封面
      if (doc.cover_url) {
        const fileID = await saveCover(doc.cover_url, doc.slug)
        if (fileID && saved) {
          await gamesCol.doc(saved._id).update({ data: { cover_file_id: fileID } })
          saved.cover_file_id = fileID
        }
      }
      const coverTempUrl = await getTempUrl(saved && saved.cover_file_id)
      return { code: 0, message: 'ok', data: { ...saved, cover_url: coverTempUrl, stale: false } }
    }

    // 4. RAWG 失败，有旧缓存就降级返回
    if (game) {
      const coverTempUrl = await getTempUrl(game.cover_file_id)
      return { code: 50002, message: 'RAWG unavailable, cached data', data: { ...game, cover_url: coverTempUrl, stale: true } }
    }

    return { code: 404, message: 'game not found', data: null }
  } catch (err) {
    console.error('[getGameDetail] fatal:', err)
    return { code: 50001, message: err.message || 'internal error', data: null }
  }
}
