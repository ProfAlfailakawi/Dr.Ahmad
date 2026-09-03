import { spawn, execFileSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)))
const bridgeFile = existsSync(join(root, 'bridge.mjs')) ? join(root, 'bridge.mjs') : join(root, 'index.mjs')

const deviceId = String(process.env.WHATSAPP_BRIDGE_DEVICE_ID || process.env.WHATSAPP_CLIENT_ID || 'primary')
  .replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'primary'

const sessionDir = resolve(String(process.env.WHATSAPP_SESSION_DIR || './session'))
const targetSessionFolder = join(sessionDir, `session-${deviceId}`)
const pidFile = join(sessionDir, `bridge-${deviceId}.pid`)

let child = null
let stopping = false
let failures = 0

function out(level, message, fields = {}) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), level, runner: true, deviceId, message, ...fields })}\n`)
}

function checkAndAcquireLock() {
  mkdirSync(sessionDir, { recursive: true, mode: 0o700 })
  if (existsSync(pidFile)) {
    try {
      const existingPid = Number(readFileSync(pidFile, 'utf8').trim())
      if (existingPid && existingPid !== process.pid) {
        process.kill(existingPid, 0)
        out('warn', 'bridge_already_running', { existingPid })
        console.log(`\n======================================================`)
        console.log(`[!] WhatsApp Bridge is already running (PID: ${existingPid}).`)
        console.log(`    To restart cleanly, use the admin panel or kill PID ${existingPid}.`)
        console.log(`======================================================\n`)
        process.exit(0)
      }
    } catch {
      // Stale PID file, ignore and overwrite
    }
  }
  writeFileSync(pidFile, String(process.pid), { encoding: 'utf8', mode: 0o600 })
}

function releaseLock() {
  try {
    if (existsSync(pidFile)) rmSync(pidFile, { force: true })
  } catch {
    /* ignore */
  }
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
    try { process.kill(pid, 'SIGTERM') } catch { /* process ended */ }
  }
  if (pids.length) await new Promise((res) => setTimeout(res, 1_500))
  for (const pid of pids) {
    try { process.kill(pid, 0); process.kill(pid, 'SIGKILL') } catch { /* process ended */ }
  }
  if (pids.length) out('warn', 'orphan_chrome_cleaned', { count: pids.length })
}

function cleanSingletonFiles(directory, depth = 0) {
  if (!existsSync(directory) || depth > 4) return 0
  let removed = 0
  try {
    const entries = readdirSync(directory, { withFileTypes: true })
    for (const entry of entries) {
      const target = join(directory, entry.name)
      if (['SingletonLock', 'SingletonCookie', 'SingletonSocket'].includes(basename(target))) {
        rmSync(target, { recursive: true, force: true })
        removed += 1
      } else if (entry.isDirectory()) {
        removed += cleanSingletonFiles(target, depth + 1)
      }
    }
  } catch {
    /* ignore */
  }
  return removed
}

async function wipeSessionForRepair() {
  await killOrphanChrome()
  if (existsSync(targetSessionFolder)) {
    try {
      rmSync(targetSessionFolder, { recursive: true, force: true })
      out('info', 'session_directory_wiped', { targetSessionFolder })
    } catch (e) {
      out('error', 'session_wipe_failed', { error: String(e?.message || e) })
    }
  }
}

async function boot() {
  await killOrphanChrome()
  cleanSingletonFiles(sessionDir)

  const startedAt = Date.now()
  child = spawn(process.execPath, [bridgeFile], {
    cwd: root,
    env: { ...process.env, WHATSAPP_BRIDGE_DEVICE_ID: deviceId },
    stdio: 'inherit',
  })
  
  out('info', 'bridge_spawned', { pid: child.pid })

  child.once('exit', async (code, signal) => {
    child = null
    if (stopping) {
      releaseLock()
      return
    }

    const livedMs = Date.now() - startedAt
    out('info', 'bridge_exited', { code, signal, livedMs })

    if (code === 76) {
      out('warn', 'repair_session_requested', { code })
      await wipeSessionForRepair()
      failures = 0
      setTimeout(() => void boot(), 2000)
      return
    }

    if (code === 75) {
      out('info', 'restart_requested', { code })
      failures = 0
      setTimeout(() => void boot(), 1000)
      return
    }

    failures = livedMs > 10 * 60_000 ? 0 : failures + 1
    const delayMs = Math.min(30_000, 1_000 * 2 ** Math.min(failures, 5))
    out('warn', 'auto_restarting_bridge', { code, signal, restartInMs: delayMs })
    setTimeout(() => void boot(), delayMs)
  })
}

function stop(signal) {
  if (stopping) return
  stopping = true
  out('info', 'runner_stopping', { signal })
  releaseLock()
  if (!child) process.exit(0)
  child.kill('SIGTERM')
  setTimeout(() => {
    try { child?.kill('SIGKILL') } catch { /* ended */ }
    process.exit(0)
  }, 5_000).unref()
}

process.on('SIGTERM', () => stop('SIGTERM'))
process.on('SIGINT', () => stop('SIGINT'))

checkAndAcquireLock()
await boot()
