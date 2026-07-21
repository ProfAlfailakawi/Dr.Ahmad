import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import { timingSafeEqual } from 'node:crypto'
import { BRIDGE_PORT, BRIDGE_TLS_CERT, BRIDGE_TLS_KEY } from './config.mjs'

const MAX_BODY_BYTES = 128 * 1024
const PAIRING_SECRET_MIN_LENGTH = 64

function bearer(req) {
  const header = String(req.headers.authorization || '')
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
}

function requestSecret(req) {
  return String(req.headers['x-whatsapp-agent-secret'] || bearer(req) || '').trim()
}

function requestPairingSecret(req) {
  return String(req.headers['x-whatsapp-agent-pairing-secret'] || '').trim()
}

function secretsEqual(candidate, expected) {
  const left = Buffer.from(String(candidate || ''), 'utf8')
  const right = Buffer.from(String(expected || ''), 'utf8')
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right)
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
  const configuredOrigins = String(process.env.WHATSAPP_AGENT_ALLOWED_ORIGIN || '').split(',').map((item) => item.trim()).filter(Boolean)
  const allowedOrigins = new Set(configuredOrigins.length ? configuredOrigins : ['http://127.0.0.1:5173', 'http://localhost:5173', 'https://dr-alfailakawi.com', 'https://www.dr-alfailakawi.com'])
  const secret = agent.bridgeSecret()
  const pairingBootstrapSecret = String(process.env.WHATSAPP_AGENT_PAIRING_SECRET || '').trim()
  if (pairingBootstrapSecret && pairingBootstrapSecret.length < PAIRING_SECRET_MIN_LENGTH) {
    throw new Error(`WHATSAPP_AGENT_PAIRING_SECRET must be at least ${PAIRING_SECRET_MIN_LENGTH} characters.`)
  }
  let pairingBootstrapAvailable = Boolean(pairingBootstrapSecret)
  const handler = async (req, res) => {
    const origin = req.headers.origin || ''
    if (origin && !allowedOrigins.has(origin)) { res.writeHead(403); res.end('forbidden'); return }
    if (origin && allowedOrigins.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-WhatsApp-Agent-Secret, X-WhatsApp-Agent-Pairing-Secret')
      res.writeHead(204); res.end(); return
    }
    /* نبضة عامة بلا سر: تُثبت للوحة أن الجسر حيّ فتقول «ألصق السر» بدل «غير مرتبط»
       المضلِّلة. لا تكشف شيئاً: لا حالة ولا رقم ولا رسالة — كلمة واحدة فقط. */
    const pingUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`)
    if (req.method === 'GET' && pingUrl.pathname === '/ping') {
      writeJson(res, 200, { bridge: 'alive', requiresSecret: true })
      return
    }

    /* الاقتران لا يثق في Origin وحده: أي XSS داخل نطاقٍ مسموح كان يستطيع سابقاً
       طلب /pair وسرقة سر الإدارة من الجسر المحلي. لا يُسلَّم السر الآن إلا لمن
       يثبت امتلاك سر الجسر أصلاً، أو سر Bootstrap محلي مستقل لا يقل عن 64 خانة.
       سر Bootstrap يُستهلك مرة واحدة في عمر العملية؛ وعند غيابه يبقى النسخ
       اليدوي من CLI هو المسار الآمن والمتوافق مع اللوحة الحالية. */
    if (req.method === 'POST' && pingUrl.pathname === '/pair') {
      if (!origin) { writeJson(res, 403, { error: 'origin-required' }); return }
      const authenticatedWithBridgeSecret = secretsEqual(requestSecret(req), secret)
      const authenticatedWithBootstrap = pairingBootstrapAvailable && secretsEqual(requestPairingSecret(req), pairingBootstrapSecret)
      if (!authenticatedWithBridgeSecret && !authenticatedWithBootstrap) {
        agent.db?.addAudit?.('bridge-secret-pair-rejected', 'local', `origin=${origin}`)
        writeJson(res, 401, { error: 'pairing-secret-required' })
        return
      }
      if (authenticatedWithBootstrap) pairingBootstrapAvailable = false
      agent.db?.addAudit?.('bridge-secret-paired', 'local', `origin=${origin}; bootstrap=${authenticatedWithBootstrap}`)
      writeJson(res, 200, { secret })
      return
    }

    if (requestSecret(req) !== secret) { writeJson(res, 401, { error: 'unauthorized' }); return }

    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
    try {
      if (req.method === 'GET' && url.pathname === '/health') { writeJson(res, 200, { ok: true, status: await agent.status() }); return }
      if (req.method === 'GET' && url.pathname === '/status') { writeJson(res, 200, await agent.status()); return }
      if (req.method === 'GET' && url.pathname === '/campaigns') { writeJson(res, 200, agent.listCampaigns()); return }
      if (req.method === 'GET' && url.pathname === '/admin/groups') { writeJson(res, 200, await agent.discoverGroups()); return }
      if (req.method === 'GET' && url.pathname === '/admin/groups/cached') { writeJson(res, 200, { groups: agent.listBroadcastGroups(), refreshed: false }); return }
      if (req.method === 'POST' && url.pathname === '/admin/send-self-preview') {
        const body = await readJson(req)
        writeJson(res, 200, await agent.sendSelf(body.message || body.text || ''))
        return
      }
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
      const quietSend = route(req.method, url.pathname, { method: 'POST', regex: /^\/campaigns\/(?<id>[^/]+)\/send-quiet$/ })
      if (quietSend) {
        const body = await readJson(req)
        writeJson(res, 202, agent.sendQuietCampaign(decodeURIComponent(quietSend.id), { confirm: body.confirm === true, confirmAgain: body.confirmAgain === true, intervalSeconds: body.intervalSeconds }))
        return
      }
      const stopCampaign = route(req.method, url.pathname, { method: 'POST', regex: /^\/campaigns\/(?<id>[^/]+)\/stop$/ })
      if (stopCampaign) {
        writeJson(res, 200, { id: agent.stopCampaign(decodeURIComponent(stopCampaign.id)), state: 'stopped' })
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
      /* إعادةٌ شاملة بضغطة: الدكتور لا يعرف أرقام JID ولا ينبغي أن يبحث عنها
         حين يصمت البوت. زرٌّ واحد يُعيده في كل المحادثات. */
      if (req.method === 'POST' && url.pathname === '/admin/bot-return-all') {
        writeJson(res, 200, agent.returnAllToBot())
        return
      }
      if (req.method === 'POST' && url.pathname === '/admin/agent/pause') {
        writeJson(res, 200, agent.pauseAutoReplies())
        return
      }
      if (req.method === 'POST' && url.pathname === '/admin/agent/resume') {
        writeJson(res, 200, agent.resumeAutoReplies())
        return
      }
      /* إعادة ربطٍ بضغطة — تُمسح الجلسة ويُقلع العميل فيظهر QR في اللوحة */
      if (req.method === 'POST' && url.pathname === '/admin/repair') {
        const body = await readJson(req)
        if (body.confirm !== true) { writeJson(res, 400, { error: 'confirm-required' }); return }
        writeJson(res, 202, await agent.repair())
        return
      }
      if (req.method === 'GET' && url.pathname === '/admin/silence') {
        writeJson(res, 200, agent.silenceState())
        return
      }
      if (req.method === 'POST' && url.pathname === '/admin/bot-return') {
        const body = await readJson(req)
        writeJson(res, 200, agent.returnToBot(body.jid))
        return
      }
      /* ═══ الجمهور: دفتر الأسماء وقوائم البث التي يبنيها الدكتور ═══ */
      if (req.method === 'GET' && url.pathname === '/admin/audience/contacts') {
        writeJson(res, 200, agent.audience.contactsPage({
          search: url.searchParams.get('q') || '',
          offset: Number(url.searchParams.get('offset') || 0),
          limit: Number(url.searchParams.get('limit') || 500),
        })); return
      }
      if (req.method === 'POST' && url.pathname === '/admin/audience/contacts') {
        const body = await readJson(req)
        writeJson(res, 200, agent.audience.addContact(body.phone, body.nickname)); return
      }
      if (req.method === 'POST' && url.pathname === '/admin/audience/import') {
        const body = await readJson(req)
        writeJson(res, 200, agent.audience.import(body.text || '', { listId: body.listId || '' })); return
      }
      if (req.method === 'POST' && url.pathname === '/admin/audience/nickname') {
        const body = await readJson(req)
        writeJson(res, 200, agent.audience.setNickname(body.contactId, body.nickname)); return
      }
      if (req.method === 'GET' && url.pathname === '/admin/audience/lists') {
        writeJson(res, 200, { lists: agent.audience.lists() }); return
      }
      if (req.method === 'POST' && url.pathname === '/admin/audience/lists') {
        const body = await readJson(req)
        if (body.action === 'rename') { writeJson(res, 200, agent.audience.renameList(body.id, body.name, body.note)); return }
        if (body.action === 'delete') { writeJson(res, 200, agent.audience.deleteList(body.id)); return }
        writeJson(res, 200, agent.audience.createList(body.name, body.note)); return
      }
      if (req.method === 'GET' && url.pathname === '/admin/audience/members') {
        writeJson(res, 200, { members: agent.audience.members(url.searchParams.get('list') || '') }); return
      }
      if (req.method === 'POST' && url.pathname === '/admin/audience/members') {
        const body = await readJson(req)
        if (body.action === 'remove') { writeJson(res, 200, agent.audience.removeMember(body.listId, body.contactId)); return }
        writeJson(res, 200, agent.audience.addMembers(body.listId, body.contactIds || [])); return
      }
      if (req.method === 'POST' && url.pathname === '/admin/audience/preview') {
        const body = await readJson(req)
        const resolved = agent.audience.resolve(body.listId)
        writeJson(res, 200, {
          samples: agent.audience.preview(body.listId, body.text || ''),
          willSend: resolved.send.length,
          suppressed: resolved.suppressed.length,
        }); return
      }
      if (req.method === 'POST' && url.pathname === '/admin/audience/draft') {
        const body = await readJson(req)
        writeJson(res, 200, agent.audience.draftFromList(body.listId, body.name, body.message || '')); return
      }
      if (req.method === 'GET' && url.pathname === '/admin/learning') { writeJson(res, 200, agent.learningState({ limit: Number(url.searchParams.get('limit') || 80) })); return }
      const learningStatus = route(req.method, url.pathname, { method: 'POST', regex: /^\/admin\/learning\/(?<id>[^/]+)\/(?<status>observing|ignored)$/ })
      if (learningStatus) { writeJson(res, 200, agent.setLearningPatternStatus(decodeURIComponent(learningStatus.id), learningStatus.status)); return }
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
