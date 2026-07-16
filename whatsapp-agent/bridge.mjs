import http from 'node:http'
import { BRIDGE_PORT, flags } from './config.mjs'

export function startLocalBridge(agent, { port = BRIDGE_PORT } = {}) {
  const allowedOrigin = process.env.WHATSAPP_AGENT_ALLOWED_ORIGIN || ''
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin || ''
    if (allowedOrigin && origin !== allowedOrigin) { res.writeHead(403); res.end('forbidden'); return }
    if (origin && allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    res.setHeader('Cache-Control', 'no-store')
    if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.writeHead(204); res.end(); return }
    if (req.method === 'GET' && req.url === '/health') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true })); return }
    if (req.method === 'GET' && req.url === '/status') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(agent.status())); return }
    if (req.method === 'GET' && req.url === '/campaigns') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(agent.listCampaigns())); return }
    if (req.method === 'POST' && req.url === '/campaigns/draft') {
      let raw = ''; for await (const chunk of req) raw += chunk; let body
      try { body = JSON.parse(raw) } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'invalid-json' })); return }
      try { const id = agent.queueCampaign(body); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ id, state: 'draft' })) } catch (error) { res.writeHead(400); res.end(JSON.stringify({ error: String(error.message || error) })) }
      return
    }
    const approval = req.method === 'POST' && /^\/campaigns\/[^/]+\/approve$/.test(req.url || '')
    if (approval) {
      const id = decodeURIComponent(String(req.url).split('/')[2]); let raw = ''
      for await (const chunk of req) raw += chunk
      let body = {}; try { body = raw ? JSON.parse(raw) : {} } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'invalid-json' })); return }
      try { const approved = agent.approveCampaign(id, { confirm: body.confirm === true }); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ id: approved, state: 'approved' })) } catch (error) { res.writeHead(400); res.end(JSON.stringify({ error: String(error.message || error) })) }
      return
    }
    res.writeHead(404); res.end('not found')
  })
  server.listen(port, '127.0.0.1')
  return server
}
