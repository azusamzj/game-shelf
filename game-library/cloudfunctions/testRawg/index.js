// testRawg - 单独测试 RAWG API 连通性，不做任何数据库操作
const cloud = require('wx-server-sdk')
const https = require('https')
const url = require('url')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async function (event) {
  var key = process.env.RAWG_API_KEY
  var keyword = event.keyword || 'mario'

  var result = {
    hasKey: !!key,
    keyLength: key ? key.length : 0,
    keyword: keyword,
    steps: []
  }

  if (!key) {
    return { code: 1, message: 'RAWG_API_KEY not set in env', data: result }
  }

  try {
    var qs = 'key=' + encodeURIComponent(key) + '&search=' + encodeURIComponent(keyword) + '&page_size=3'
    var fullUrl = 'https://api.rawg.io/api/games?' + qs
    result.fullUrl = fullUrl
    result.steps.push('准备请求')

    var body = await new Promise(function (resolve, reject) {
      var parsed = url.parse(fullUrl)
      var req = https.request({
        hostname: parsed.hostname,
        path: parsed.path + parsed.search,
        method: 'GET',
        headers: { 'User-Agent': 'game-library-miniapp/1.0' },
        timeout: 10000
      }, function (res) {
        var data = ''
        res.on('data', function (c) { data += c })
        res.on('end', function () { resolve({ status: res.statusCode, body: data }) })
      })
      req.on('error', reject)
      req.on('timeout', function () { req.destroy(new Error('timeout')) })
      req.end()
    })

    result.status = body.status
    result.rawBody = body.body.substring(0, 500)

    if (body.status === 200) {
      try {
        var json = JSON.parse(body.body)
        result.count = json.count
        result.resultsLen = (json.results || []).length
        result.firstResult = json.results && json.results[0] ? {
          id: json.results[0].id,
          name: json.results[0].name,
          slug: json.results[0].slug
        } : null
        result.steps.push('RAWG 返回正常')
      } catch (e) {
        result.steps.push('RAWG 返回非 JSON')
      }
    } else {
      result.steps.push('RAWG 返回非 200')
    }
  } catch (err) {
    result.steps.push('请求异常: ' + (err && err.message ? err.message : err))
    result.error = err && err.stack ? err.stack : String(err)
  }

  return { code: result.status === 200 ? 0 : 2, message: 'see steps', data: result }
}
