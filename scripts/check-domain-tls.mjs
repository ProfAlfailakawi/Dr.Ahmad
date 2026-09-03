#!/usr/bin/env node
import tls from 'node:tls'
import { lookup } from 'node:dns/promises'

const DEFAULT_HOSTS = ['dr-alfailakawi.com', 'tebyan.dr-alfailakawi.com', 'schedule.dr-alfailakawi.com']
const hosts = String(process.env.MONITORED_HOSTS || DEFAULT_HOSTS.join(','))
  .split(',').map((host) => host.trim().toLowerCase()).filter(Boolean)
const warnDays = Number(process.env.TLS_WARN_DAYS || 30)
const failDays = Number(process.env.TLS_FAIL_DAYS || 14)

const daysUntil = (date, now = Date.now()) => Math.floor((new Date(date).getTime() - now) / 86_400_000)

if (process.argv.includes('--self-test')) {
  const fixed = Date.UTC(2026, 7, 1)
  if (daysUntil('2026-08-31T00:00:00Z', fixed) !== 30) throw new Error('حساب مهلة الشهادة غير صحيح')
  if (!hosts.includes('dr-alfailakawi.com')) throw new Error('النطاق الرئيسي غير مراقب')
  console.log('✓ Domain/TLS watcher self-test passed')
  process.exit(0)
}

async function certificate(host) {
  return await new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: true, timeout: 15_000 })
    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate()
      const protocol = socket.getProtocol() || ''
      socket.end()
      resolve({ expires: cert.valid_to, issuer: cert.issuer?.O || cert.issuer?.CN || 'unknown', protocol })
    })
    socket.once('timeout', () => socket.destroy(new Error('TLS timeout')))
    socket.once('error', reject)
  })
}

async function inspect(host) {
  const addresses = await lookup(host, { all: true })
  if (!addresses.length) throw new Error('DNS بلا عنوان')
  const cert = await certificate(host)
  const remaining = daysUntil(cert.expires)
  if (!Number.isFinite(remaining)) throw new Error('تعذّر قراءة انتهاء الشهادة')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  let response
  try {
    response = await fetch(`https://${host}/`, { redirect: 'manual', signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
  if (response.status < 200 || response.status >= 400) throw new Error(`HTTPS ${response.status}`)
  return { host, addresses: addresses.map((item) => item.address), ...cert, remaining, status: response.status }
}

const failures = []
for (const host of hosts) {
  try {
    const row = await inspect(host)
    const line = `${row.host}: HTTPS ${row.status} · ${row.protocol} · الشهادة ${row.remaining} يوماً · ${row.issuer}`
    if (row.remaining < failDays) failures.push(`${line} (أقل من حد الخطر ${failDays})`)
    else if (row.remaining < warnDays) console.warn(`::warning::${line}`)
    else console.log(`✓ ${line}`)
  } catch (error) {
    failures.push(`${host}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`::error::${message}`))
  process.exit(1)
}
