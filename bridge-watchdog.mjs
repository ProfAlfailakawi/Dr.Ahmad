/**
 * حارس جسر واتساب الحيّ (whatsapp-web-bridge) — أمر الدكتور ٢٠٢٦-٠٧-٢٨.
 *
 * يغلق الثغرة الوحيدة الباقية: «التجمّد الصامت» — العملية حيّة لكن الجسر
 * متوقّف — التي تفوتها launchd KeepAlive (تلتقط الموت فقط) وتفوتها إصلاحية
 * الإطار المنفصل (تُطلق عند أمر إرسال فقط).
 *
 * مستقلٌّ تماماً عن الجسر ومجلد المشروع: يعمل كل ٣ دقائق عبر launchd، ويقرأ
 * نبضة الجسر الموجودة أصلاً من نقطة الصحة المحلية (لا قاعدة بيانات، لا اقتران).
 * ثلاث حالات غير صحّية تستدعي إعادة تشغيل ناعمة (kickstart) مع تهدئة وتنبيه:
 *   1) نقطة الصحة غير قابلة للوصول (تجمّد صلب).
 *   2) connected=false مستمرّ.
 *   3) آخر نبضة (lastWebhookAt) أقدم من ٤ دقائق (خيط النبض توقّف).
 */
import { execSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'

const HOME = process.env.HOME
const RES = `${HOME}/Library/Application Support/DrAhmadWhatsAppBridge`
const LABEL = 'com.alturath.whatsapp-bridge'
const PORT = Number(process.env.WHATSAPP_BRIDGE_HEALTH_PORT || 34322)
const HEALTH_URL = `http://127.0.0.1:${PORT}/health`
const WLOG = `${RES}/logs/bridge-watchdog.log`
const STATE = `${RES}/logs/bridge-watchdog-state.json`
const STALE_MS = 4 * 60 * 1000       // نبضةٌ أقدم من ٤ دقائق = تجمّد
const COOLDOWN_MS = 8 * 60 * 1000    // لا تُعِد التشغيل أكثر من مرّة كل ٨ دقائق
const GRACE_MS = 90 * 1000           // مهلة إقلاعٍ: لا تُعاقب جسراً بدأ للتوّ

const uid = process.getuid()
const now = Date.now()
const wlog = (m) => { try { appendFileSync(WLOG, `${new Date().toISOString()} ${m}\n`) } catch { /* noop */ } }
const sh = (cmd) => { try { return execSync(cmd, { encoding: 'utf8', timeout: 15000 }) } catch { return '' } }
const notify = (m) => sh(`osascript -e 'display notification "${String(m).replace(/["\\]/g, '')}" with title "حارس بوت واتساب"'`)
const readState = () => { try { return JSON.parse(readFileSync(STATE, 'utf8')) } catch { return { lastRestartAt: 0, wasHealthy: true } } }
const saveState = (s) => { try { writeFileSync(STATE, JSON.stringify(s)) } catch { /* noop */ } }

const st = readState()

async function fetchHealth() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(HEALTH_URL, { signal: controller.signal })
    if (!res.ok) return { reachable: true, ok: false }
    const body = await res.json()
    return { reachable: true, ok: true, body }
  } catch {
    return { reachable: false, ok: false }
  } finally {
    clearTimeout(timer)
  }
}

const health = await fetchHealth()

/* حالة رابعة غير صحية — «الإطار المنفصل» المزمن: الجسر متصل ونبضه أخضر لكن
   استرجاع الرسائل يفشل بخطأ الإطار المنفصل جولةً بعد جولة، أي أن صفحة واتساب
   داخله انفصلت وقد لا تصل الردود. الجسر نفسه يعالجها الآن ذاتياً؛ هذا الحارس
   شبكة الأمان الخارجية: رصدُها في فحصين متتاليين (≈ ٦ دقائق) يعيد التشغيل. */
const DETACHED_CONTEXT = /detached\s*Frame|Execution context (?:was )?destroyed|Target closed|webjs-reinjection-timeout|Cannot find context with specified id/i
const detachedSeen = Boolean(health.ok && health.body && DETACHED_CONTEXT.test(String(health.body.lastCatchupError || '')))

let reason = null
if (!health.reachable) {
  reason = 'health-unreachable'
} else if (!health.ok || !health.body) {
  reason = 'health-not-ok'
} else {
  const b = health.body
  const startedAt = b.startedAt ? new Date(b.startedAt).getTime() : 0
  const withinGrace = startedAt && (now - startedAt) < GRACE_MS
  if (!withinGrace) {
    if (b.connected !== true) {
      reason = `not-connected:${b.status || 'unknown'}`
    } else if (detachedSeen && st.detachedSeen) {
      reason = 'detached-catchup-persistent'
    } else if (b.lastWebhookAt) {
      const hbAge = now - new Date(b.lastWebhookAt).getTime()
      if (hbAge > STALE_MS) reason = `stale-heartbeat:${Math.round(hbAge / 1000)}s`
    }
  }
}

const healthy = reason === null

if (healthy) {
  if (!st.wasHealthy) { notify('البوت رجع سليمًا يعمل ✓'); wlog('recovered → healthy') }
  else wlog(`healthy connected=${health.body?.connected} sync=${health.body?.syncPercent}${detachedSeen ? ' detached-catchup=observing' : ''}`)
  saveState({ ...st, wasHealthy: true, detachedSeen })
} else {
  const sinceRestart = now - Number(st.lastRestartAt || 0)
  if (sinceRestart < COOLDOWN_MS) {
    wlog(`unhealthy (${reason}) — in cooldown ${Math.round((COOLDOWN_MS - sinceRestart) / 1000)}s, skip`)
    saveState({ ...st, wasHealthy: false, detachedSeen })
  } else {
    wlog(`RESTART (${reason}) → kickstart ${LABEL}`)
    sh(`launchctl kickstart -k gui/${uid}/${LABEL}`)
    notify(`أعدت تشغيل البوت تلقائيًا (${reason})`)
    saveState({ lastRestartAt: now, wasHealthy: false, detachedSeen: false })
  }
}
