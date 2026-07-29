import { spawn, execFileSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync, readFileSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)))
const bridgeFile = existsSync(join(root, 'index.mjs')) ? join(root, 'index.mjs') : join(root, 'bridge.mjs')

const deviceId = String(process.env.WHATSAPP_BRIDGE_DEVICE_ID || process.env.WHATSAPP_CLIENT_ID || 'primary')
  .replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'primary'

const sessionDir = resolve(String(process.env.WHATSAPP_SESSION_DIR || './session'))
const targetSessionFolder = join(sessionDir, `session-${deviceId}`)
const pidFile = join(sessionDir, `bridge-${deviceId}.pid`)
const dependencyMarker = join(root, 'node_modules', 'whatsapp-web.js', 'package.json')
const secretProject = String(process.env.WHATSAPP_SECRET_PROJECT || 'gen-lang-client-0200723670').trim()
const secretName = String(process.env.WHATSAPP_SECRET_NAME || 'whatsapp-bridge-secret').trim()
const keychainService = 'com.alturath.whatsapp-bridge.secret'
const keychainAccount = `${deviceId}:${secretProject}:${secretName}`

let child = null
let stopping = false
let failures = 0

function out(level, message, fields = {}) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), level, runner: true, deviceId, message, ...fields })}\n`)
}

function findExecutable(explicit, candidates) {
  if (explicit && existsSync(explicit)) return explicit
  return candidates.find((candidate) => existsSync(candidate)) || ''
}

/*
 * الخدمة المقيمة لا تعتمد على ملف .env داخل مجلد مشروع قابل للاستبدال.
 * السر يُقرأ من البيئة أو macOS Keychain، ثم Secret Manager عند الحاجة فقط.
 * لا يُطبع ولا يُحفظ في ملف. نسخة Keychain المشفّرة تمنع تأخر gcloud العابر من
 * إبقاء الجسر متوقفاً بعد إعادة تشغيل الجهاز أو launchd.
 */
function readKeychainSecret() {
  const security = '/usr/bin/security'
  if (!existsSync(security)) return ''
  try {
    const secret = execFileSync(security, [
      'find-generic-password',
      '-s', keychainService,
      '-a', keychainAccount,
      '-w',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5_000 }).trim()
    return secret.length >= 24 ? secret : ''
  } catch {
    return ''
  }
}

function cacheKeychainSecret(secret) {
  const security = '/usr/bin/security'
  if (!existsSync(security) || String(secret || '').length < 24) return false
  try {
    execFileSync(security, [
      'add-generic-password',
      '-U',
      '-T', security,
      '-s', keychainService,
      '-a', keychainAccount,
      '-w', secret,
    ], { stdio: 'ignore', timeout: 5_000 })
    return true
  } catch {
    return false
  }
}

function loadBridgeSecret() {
  const existing = String(process.env.WHATSAPP_BRIDGE_SECRET || '').trim()
  if (existing.length >= 24) {
    cacheKeychainSecret(existing)
    return existing
  }
  const cached = readKeychainSecret()
  if (cached) {
    process.env.WHATSAPP_BRIDGE_SECRET = cached
    out('info', 'bridge_secret_loaded_from_keychain')
    return cached
  }
  const gcloud = findExecutable(process.env.GCLOUD_BIN, [
    '/opt/homebrew/share/google-cloud-sdk/bin/gcloud',
    '/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin/gcloud',
    '/usr/local/bin/gcloud',
  ])
  if (!gcloud) throw new Error('gcloud-not-found')
  const secret = execFileSync(gcloud, [
    'secrets', 'versions', 'access', 'latest',
    `--secret=${secretName}`,
    `--project=${secretProject}`,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000 }).trim()
  if (secret.length < 24) throw new Error('bridge-secret-missing')
  process.env.WHATSAPP_BRIDGE_SECRET = secret
  cacheKeychainSecret(secret)
  out('info', 'bridge_secret_loaded_from_secret_manager')
  return secret
}

/*
 * تحديث مجلد المصدر كان يمحو node_modules، فينهار launchd كل عشر ثوانٍ.
 * المقيم يفحص اعتمادياته ويعيدها من package-lock ذاتياً قبل تشغيل Chrome.
 */
function ensureDependencies() {
  if (existsSync(dependencyMarker)) return
  const npm = findExecutable(process.env.NPM_BIN, ['/usr/local/bin/npm', '/opt/homebrew/bin/npm'])
  if (!npm) throw new Error('npm-not-found')
  out('warn', 'dependencies_missing_self_heal')
  execFileSync(npm, ['ci', '--omit=dev', '--no-audit', '--no-fund'], {
    cwd: root,
    stdio: 'ignore',
    timeout: 10 * 60_000,
  })
  if (!existsSync(dependencyMarker)) throw new Error('dependency-self-heal-incomplete')
  out('info', 'dependencies_restored')
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
      const quarantineDir = join(sessionDir, 'quarantine')
      mkdirSync(quarantineDir, { recursive: true, mode: 0o700 })
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const quarantined = join(quarantineDir, `${basename(targetSessionFolder)}-${stamp}`)
      renameSync(targetSessionFolder, quarantined)
      out('info', 'session_quarantined_for_repair', { quarantined })
    } catch (e) {
      out('error', 'session_quarantine_failed', { error: String(e?.message || e) })
    }
  }
}

async function boot() {
  try {
    loadBridgeSecret()
    ensureDependencies()
  } catch (error) {
    failures += 1
    const delayMs = Math.min(5 * 60_000, 30_000 * Math.max(1, failures))
    out('error', 'resident_prerequisite_unavailable', {
      error: String(error?.message || error),
      retryInMs: delayMs,
    })
    setTimeout(() => void boot(), delayMs)
    return
  }
  await killOrphanChrome()
  cleanSingletonFiles(sessionDir)

  const startedAt = Date.now()
  child = spawn(process.execPath, [bridgeFile], {
    cwd: root,
    env: {
      ...process.env,
      WHATSAPP_BRIDGE_DEVICE_ID: deviceId,
      WHATSAPP_SESSION_DIR: sessionDir,
    },
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

    // Any other exit (including exit 0 or crash): auto restart child with backoff
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
