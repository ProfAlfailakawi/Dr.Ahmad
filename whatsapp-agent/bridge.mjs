import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import { BRIDGE_PORT, BRIDGE_TLS_CERT, BRIDGE_TLS_KEY } from './config.mjs'

const MAX_BODY_BYTES = 128 * 1024

function bearer(req) {
  const header = String(req.headers.authorization || '')
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

function requestSecret(req) {
  return String(req.headers['x-whatsapp-agent-secret'] || bearer(req) || '').trim()
}

function writeJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

async function readJson(req) {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new Error('body-too-large')
  }
  if (!raw.trim()) return {}
  return JSON.parse(raw)
}

function route(method, pathname, pattern) {
  if (method !== pattern.method) return null
  const match = pattern.regex.exec(pathname)
  return match ? match.groups || {} : null
}

export function startLocalBridge(agent, { port = BRIDGE_PORT } = {}) {
  const allowedOrigin = process.env.WHATSAPP_AGENT_ALLOWED_ORIGIN || ''
  const secret = agent.bridgeSecret()
  const handler = async (req, res) => {
    const origin = req.headers.origin || ''
    if (allowedOrigin && origin !== allowedOrigin) { res.writeHead(403); res.end('forbidden'); return }
    if (origin && allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Vary', 'Origin')
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-WhatsApp-Agent-Secret')
      res.writeHead(204); res.end(); return
    }
    if (requestSecret(req) !== secret) { writeJson(res, 401, { error: 'unauthorized' }); return }

    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
    try {
      if (req.method === 'GET' && url.pathname === '/health') { writeJson(res, 200, { ok: true, status: agent.status() }); return }
      if (req.method === 'GET' && url.pathname === '/status') { writeJson(res, 200, agent.status()); return }
      if (req.method === 'GET' && url.pathname === '/campaigns') { writeJson(res, 200, agent.listCampaigns()); return }
      if (req.method === 'POST' && url.pathname === '/campaigns/draft') {
        const id = agent.queueCampaign(await readJson(req))
        writeJson(res, 200, { id, state: 'draft' })
        return
      }
      const approval = route(req.method, url.pathname, { method: 'POST', regex: /^\/campaigns\/(?<id>[^/]+)\/approve$/ })
      if (approval) {
        const body = await readJson(req)
        const id = agent.approveCampaign(decodeURIComponent(approval.id), { confirm: body.confirm === true })
        writeJson(res, 200, { id, state: 'approved' })
        return
      }
      if (req.method === 'POST' && url.pathname === '/admin/restart') {
        const result = agent.requestRestart()
        writeJson(res, 202, { ...result, message: 'جارٍ إعادة التشغيل. إذا كان الماك مطفأً أو بلا إنترنت فلن يصل الطلب.' })
        setTimeout(async () => {
          try { await agent.stop() } finally { process.exit(0) }
        }, 350)
        return
      }
      if (req.method === 'POST' && url.pathname === '/admin/manual-takeover') {
        const body = await readJson(req)
        writeJson(res, 200, agent.manualTakeover(body.jid, body.minutes))
        return
      }
      if (req.method === 'POST' && url.pathname === '/admin/bot-return') {
        const body = await readJson(req)
        writeJson(res, 200, agent.returnToBot(body.jid))
        return
      }
      if (req.method === 'GET' && url.pathname === '/admin/rules') { writeJson(res, 200, agent.listReplyRules()); return }
      if (['POST', 'PUT', 'PATCH'].includes(req.method || '') && url.pathname === '/admin/rules') {
        writeJson(res, 200, agent.saveReplyRule(await readJson(req)))
        return
      }
      const deleteRule = route(req.method, url.pathname, { method: 'DELETE', regex: /^\/admin\/rules\/(?<id>[^/]+)$/ })
      if (deleteRule) { writeJson(res, 200, agent.deleteReplyRule(decodeURIComponent(deleteRule.id))); return }
      const versions = route(req.method, url.pathname, { method: 'GET', regex: /^\/admin\/rules\/(?<id>[^/]+)\/versions$/ })
      if (versions) { writeJson(res, 200, agent.replyRuleVersions(decodeURIComponent(versions.id))); return }
      const rollback = route(req.method, url.pathname, { method: 'POST', regex: /^\/admin\/rules\/(?<id>[^/]+)\/rollback\/(?<versionId>[^/]+)$/ })
      if (rollback) { writeJson(res, 200, agent.rollbackReplyRule(decodeURIComponent(rollback.id), decodeURIComponent(rollback.versionId))); return }
      if (req.method === 'POST' && url.pathname === '/admin/simulate') {
        writeJson(res, 200, agent.simulateReply(await readJson(req)))
        return
      }
      writeJson(res, 404, { error: 'not-found' })
    } catch (error) {
      writeJson(res, 400, { error: String(error?.message || error) })
    }
  }

  const useTls = Boolean(BRIDGE_TLS_CERT && BRIDGE_TLS_KEY)
  const server = useTls
    ? https.createServer({ cert: fs.readFileSync(BRIDGE_TLS_CERT), key: fs.readFileSync(BRIDGE_TLS_KEY) }, handler)
    : http.createServer(handler)
  server.listen(port, '127.0.0.1')
  return server
}
