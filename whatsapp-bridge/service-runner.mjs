import { spawn, execFileSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)))
const bridgeFile = join(root, 'bridge.mjs')
const sessionDir = resolve(String(process.env.WHATSAPP_SESSION_DIR || '/var/lib/whatsapp-bridge/session'))
let child = null
let stopping = false
let failures = 0

function out(level, message, fields = {}) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), level, runner: true, message, ...fields })}\n`)
}

function chromePidsForSession() {
  let rows = ''
  try {
    rows = execFileSync('ps', ['-eo', 'pid=,command='], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  } catch {
    return []
  }
  return rows.split('\n').map((line) => {
    const match = /^\s*(\d+)\s+(.+)$/.exec(line)
    return match ? { pid: Number(match[1]), command: match[2] } : null
  }).filter((row) => row
    && row.pid !== process.pid
    && row.command.includes(sessionDir)
    && /(?:chrome|chromium)/i.test(row.command))
    .map((row) => row.pid)
}

async function killOrphanChrome() {
  const pids = chromePidsForSession()
  for (const pid of pids) {
    try { process.kill(pid, 'SIGTERM') } catch { /* انتهت قبل الإشارة */ }
  }
  if (pids.length) await new Promise((resolveWait) => setTimeout(resolveWait, 1_500))
  for (const pid of pids) {
    try { process.kill(pid, 0); process.kill(pid, 'SIGKILL') } catch { /* انتهت بنظافة */ }
  }
  if (pids.length) out('warn', 'orphan-chrome-cleaned', { count: pids.length })
}

function cleanSingletonFiles(directory, depth = 0) {
  if (!existsSync(directory) || depth > 4) return 0
  let removed = 0
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name)
    if (!target.startsWith(`${sessionDir}/`)) continue
    if (['SingletonLock', 'SingletonCookie', 'SingletonSocket'].includes(basename(target))) {
      rmSync(target, { recursive: true, force: true })
      removed += 1
    } else if (entry.isDirectory()) {
      removed += cleanSingletonFiles(target, depth + 1)
    }
  }
  return removed
}

async function cleanBeforeBoot() {
  await killOrphanChrome()
  const removed = cleanSingletonFiles(sessionDir)
  if (removed) out('warn', 'singleton-locks-cleaned', { count: removed })
}

async function boot() {
  await cleanBeforeBoot()
  const startedAt = Date.now()
  child = spawn(process.execPath, [bridgeFile], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  })
  out('info', 'bridge-spawned', { pid: child.pid })
  child.once('exit', async (code, signal) => {
    child = null
    if (stopping) return
    const livedMs = Date.now() - startedAt
    failures = livedMs > 10 * 60_000 ? 0 : failures + 1
    const delayMs = Math.min(60_000, 1_000 * 2 ** Math.min(failures, 6))
    out('warn', 'bridge-exited', { code, signal, livedMs, restartInMs: delayMs })
    setTimeout(() => void boot(), delayMs)
  })
}

function stop(signal) {
  if (stopping) return
  stopping = true
  out('info', 'runner-stopping', { signal })
  if (!child) process.exit(0)
  child.kill('SIGTERM')
  setTimeout(() => {
    try { child?.kill('SIGKILL') } catch { /* انتهى */ }
    process.exit(0)
  }, 10_000).unref()
}

process.on('SIGTERM', () => stop('SIGTERM'))
process.on('SIGINT', () => stop('SIGINT'))

await boot()
