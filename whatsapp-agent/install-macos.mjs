import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DATA_DIR, LAUNCH_AGENT_LABEL } from './config.mjs'

const home = os.homedir()
const launchDir = path.join(home, 'Library', 'LaunchAgents')
const plistPath = path.join(launchDir, `${LAUNCH_AGENT_LABEL}.plist`)
const entry = fileURLToPath(new URL('./cli.mjs', import.meta.url))

function xml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]))
}

/* إعدادات الخدمة القائمة أمانة: إعادة التثبيت كانت تعيد الافتراضات «المطفأة»
   فتُخرس بوتاً كان يرد — نقرأ قيم plist الحالي ونرثها ما لم يفرض المشغّل غيرها. */
function currentPlistValue(key) {
  try {
    const current = fs.readFileSync(plistPath, 'utf8')
    const match = current.match(new RegExp(`<key>${key}</key><string>([^<]*)</string>`))
    return match ? match[1] : undefined
  } catch { return undefined }
}

function launchEnvironment() {
  const inherit = (key, fallback) => process.env[key] || currentPlistValue(key) || fallback
  /* الافتراضات هي تشغيلة الدكتور المعتمدة (البوت يرد ويرسل، الخاص والتذكيرات
     مطفآن) — تثبيتٌ سابق كان يفترض «الكل مطفأ» فيُخرس البوت مع كل npm install. */
  const values = {
    WHATSAPP_AGENT_BRIDGE: inherit('WHATSAPP_AGENT_BRIDGE', 'true'),
    WHATSAPP_SEND_ENABLED: process.env.WHATSAPP_SEND_ENABLED || 'true',
    WHATSAPP_AUTO_REPLY_ENABLED: process.env.WHATSAPP_AUTO_REPLY_ENABLED || 'true',
    WHATSAPP_PRIVATE_AUTO_REPLY_ENABLED: inherit('WHATSAPP_PRIVATE_AUTO_REPLY_ENABLED', 'false'),
    WHATSAPP_REMINDERS_ENABLED: inherit('WHATSAPP_REMINDERS_ENABLED', 'false'),
    WHATSAPP_AGENT_BRIDGE_PORT: inherit('WHATSAPP_AGENT_BRIDGE_PORT', '34321'),
    SITE_URL: inherit('SITE_URL', 'https://dr-alfailakawi.com'),
  }
  return Object.entries(values).map(([key, value]) => `<key>${xml(key)}</key><string>${xml(value)}</string>`).join('')
}

/* ═══ البوت المقيم — استقلال كامل عن مجلد المشروع ═══
 *
 * كانت خدمة النظام تشير إلى مجلد المشروع نفسه، فإذا استبدله الدكتور أو حذفه
 * مات البوت بصمت. القاعدة الجديدة: التثبيت يُوطِّن البوت في بيت بياناته
 * (~/Library/Application Support/DrAhmadWhatsAppAgent/app) مع اعتمادياته
 * ونسخةٍ من مصادر فهرسه — ثم يعمل من هناك إلى الأبد. احذف مجلد الموقع كله
 * متى شئت؛ البوت لا يشعر. وكل تثبيتٍ جديد يجدد النسخة المقيمة تلقائياً.
 */
const sourceDir = path.dirname(entry)                       // whatsapp-agent في مجلد المشروع
const sourceRoot = path.dirname(sourceDir)                  // جذر المشروع
const residentRoot = DATA_DIR                               // بيت البوت الدائم
const residentApp = path.join(residentRoot, 'app')
const residentEntry = path.join(residentApp, 'cli.mjs')

/* ملفات المشروع التي يقرأها فهرس المحتوى — تُنسخ ليعمل الفهرس بلا المجلد الأصلي */
const CONTENT_SNAPSHOT = [
  'src/data.ts',
  'src/data-curated.ts',
  'src/data/research-papers.ts',
  'src/data/bodies.json',
  'src/data/audio.json',
  'src/data/audio-meta.json',
  'src/data/podcast-admin.json',
]

function copyRecursive(from, to) {
  fs.rmSync(to, { recursive: true, force: true })
  fs.cpSync(from, to, { recursive: true })
}

function stageResidentApp() {
  fs.mkdirSync(residentApp, { recursive: true, mode: 0o700 })
  /* شيفرة البوت: كل ملفات .mjs + حزمة npm وقفلها */
  for (const name of fs.readdirSync(sourceDir)) {
    if (name === 'node_modules' || name === '.env') continue
    const from = path.join(sourceDir, name)
    if (fs.statSync(from).isDirectory()) continue
    fs.copyFileSync(from, path.join(residentApp, name))
  }
  /* أسرار البيئة إن وُجدت تُنسخ بصلاحيات مالكها وحده */
  const envFile = path.join(sourceDir, '.env')
  if (fs.existsSync(envFile)) {
    fs.copyFileSync(envFile, path.join(residentApp, '.env'))
    fs.chmodSync(path.join(residentApp, '.env'), 0o600)
  }
  /* الاعتماديات: ننسخها جاهزةً إن وُجدت (بلا شبكة)، وإلا نثبّتها في البيت */
  const sourceModules = path.join(sourceDir, 'node_modules')
  const residentModules = path.join(residentApp, 'node_modules')
  if (fs.existsSync(path.join(sourceModules, '@whiskeysockets', 'baileys'))) {
    copyRecursive(sourceModules, residentModules)
  } else if (!fs.existsSync(path.join(residentModules, '@whiskeysockets', 'baileys'))) {
    execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: residentApp, stdio: 'ignore', timeout: 300000 })
  }
  /* لقطة مصادر الفهرس: يقرأها البوت من جذر بيته (والد app) كما كان يقرأ من جذر المشروع */
  for (const relative of CONTENT_SNAPSHOT) {
    const from = path.join(sourceRoot, relative)
    if (!fs.existsSync(from)) continue
    const to = path.join(residentRoot, relative)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
  }
  fs.writeFileSync(path.join(residentRoot, 'resident-install.json'), JSON.stringify({
    schemaVersion: 1,
    stagedAt: new Date().toISOString(),
    stagedFrom: sourceRoot,
  }, null, 2))
}

export function install() {
  if (process.platform !== 'darwin') throw new Error('التثبيت التلقائي متاح على macOS فقط.')
  fs.mkdirSync(launchDir, { recursive: true, mode: 0o700 })
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 })
  stageResidentApp()
  const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${LAUNCH_AGENT_LABEL}</string><key>EnvironmentVariables</key><dict>${launchEnvironment()}</dict><key>ProgramArguments</key><array><string>/usr/bin/caffeinate</string><string>-dimsu</string><string>${process.execPath}</string><string>${residentEntry}</string><string>start</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer><key>WorkingDirectory</key><string>${residentRoot}</string><key>StandardOutPath</key><string>${path.join(DATA_DIR, 'agent.out.log')}</string><key>StandardErrorPath</key><string>${path.join(DATA_DIR, 'agent.err.log')}</string></dict></plist>`
  fs.writeFileSync(plistPath, plist, { mode: 0o600 })
  try { execFileSync('launchctl', ['load', plistPath], { stdio: 'ignore' }) } catch { /* loaded on next login */ }
  return plistPath
}

export function uninstall() {
  if (process.platform === 'darwin') { try { execFileSync('launchctl', ['unload', plistPath], { stdio: 'ignore' }) } catch { /* noop */ } }
  try { fs.unlinkSync(plistPath) } catch { /* noop */ }
  return plistPath
}
