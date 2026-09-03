/**
 * حارس بوت واتساب — الحل الجذري لألّا يتوقّف صامتاً (أمر الدكتور ٢٠٢٦-٠٧-٢٤).
 *
 * مستقلٌّ عن البوت: يعمل كل ٣ دقائق عبر launchd. يفحص صحّة البوت من نبضةٍ يكتبها
 * البوت في قاعدته كل ٣٠ ثانية (bridge.heartbeat). ثلاث طبقات حماية:
 *   1) launchd KeepAlive يعيد الإقلاع عند الانهيار (قائم).
 *   2) شفاءُ البوت الذاتي عند عدم الجاهزية ٥ دقائق (قائم).
 *   3) هذا الحارس: يلتقط «التجمّد» (العملية حيّة والنبضة متوقّفة) الذي تفوته الطبقتان،
 *      يعيد التشغيل بمهلةٍ تمنع العواصف، ويُنبّه الدكتور فوراً — فلا يُفاجأ بتوقّفٍ صامت.
 *
 * لا يمسّ قاعدة البيانات إلا قراءةً (readonly) فلا يزاحم البوت، ولا يعمل من مجلد
 * المشروع (الذي يُفرَّغ)، بل من الدار المقيمة المستقرّة.
 */
import { execSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'

const HOME = process.env.HOME
const RES = `${HOME}/Library/Application Support/DrAhmadWhatsAppAgent`
const LABEL = 'com.dr-alfailakawi.whatsapp-agent'
const DB = `${RES}/agent.sqlite`
const OUT = `${RES}/agent.out.log`
const WLOG = `${RES}/watchdog.log`
const STATE = `${RES}/watchdog-state.json`
const STALE_MS = 4 * 60 * 1000       // نبضةٌ أقدم من ٤ دقائق = تجمّد
const COOLDOWN_MS = 8 * 60 * 1000    // لا تُعِد التشغيل أكثر من مرّة كل ٨ دقائق

const uid = process.getuid()
const wlog = (m) => { try { appendFileSync(WLOG, `${new Date().toISOString()} ${m}\n`) } catch { /* noop */ } }
const sh = (cmd) => { try { return execSync(cmd, { encoding: 'utf8', timeout: 15000 }) } catch { return '' } }
const notify = (m) => sh(`osascript -e 'display notification "${String(m).replace(/["\\]/g, '')}" with title "بوت واتساب د. أحمد"'`)
const readState = () => { try { return JSON.parse(readFileSync(STATE, 'utf8')) } catch { return { lastRestartAt: 0, fails: 0, wasHealthy: true } } }
const saveState = (s) => { try { writeFileSync(STATE, JSON.stringify(s)) } catch { /* noop */ } }

const now = Date.now()
const st = readState()

// 1) هل للخدمة PID؟
const list = sh(`launchctl list ${LABEL}`)
const pidMatch = list.match(/"PID"\s*=\s*(\d+)/)
const pid = pidMatch ? Number(pidMatch[1]) : 0

// 2) طزاجة النبضة (قراءةٌ فقط، آمنة مع WAL)
let hbAge = Infinity
try {
  const raw = sh(`sqlite3 -readonly "${DB}" "SELECT value FROM settings WHERE key='bridge.heartbeat'"`).trim()
  const hb = raw ? JSON.parse(raw) : null
  if (hb && hb.at) hbAge = now - new Date(hb.at).getTime()
} catch { /* تُعامَل كمتقادمة */ }

// 3) حالاتٌ قاتلة لا تُصلَح آلياً (خروجٌ يتطلّب QR)
const tail = sh(`tail -c 30000 "${OUT}"`)
const loggedOut = /logged out|loggedOut|Client logged out|restart required.*401/i.test(tail)

const restart = (why) => { wlog(`RESTART (${why}) pid=${pid} hbAge=${Math.round(hbAge / 1000)}s`); sh(`launchctl kickstart -k gui/${uid}/${LABEL}`) }
const healthy = !loggedOut && pid > 0 && hbAge <= STALE_MS

if (healthy) {
  if (!st.wasHealthy) { notify('البوت رجع سليمًا يعمل ✓'); wlog('recovered → healthy') }
  else wlog(`healthy pid=${pid} hbAge=${Math.round(hbAge / 1000)}s`)
  saveState({ lastRestartAt: st.lastRestartAt || 0, fails: 0, wasHealthy: true })
} else if (loggedOut) {
  if (st.wasHealthy) notify('⚠ البوت سُجّل خروجه من واتساب — يحتاج مسح QR من اللوحة')
  wlog('UNHEALTHY: logged-out (needs QR — no auto-fix)')
  saveState({ lastRestartAt: st.lastRestartAt || 0, fails: (st.fails || 0) + 1, wasHealthy: false })
} else if (now - (st.lastRestartAt || 0) < COOLDOWN_MS) {
  wlog(`UNHEALTHY (${!pid ? 'no-pid' : 'hb-stale'}) — ضمن مهلة التهدئة، أنتظر`)
  saveState({ lastRestartAt: st.lastRestartAt || 0, fails: st.fails || 0, wasHealthy: false })
} else {
  const why = !pid ? 'no-pid' : `hb-stale-${Math.round(hbAge / 1000)}s`
  restart(why)
  const fails = (st.fails || 0) + 1
  if (st.wasHealthy) notify('البوت تعثّر — أعاده الحارس تلقائيًا ✓')
  else if (fails >= 3) notify('⚠ البوت يفشل بالإقلاع مرارًا — قد يحتاج تدخّلك')
  saveState({ lastRestartAt: now, fails, wasHealthy: false })
}
