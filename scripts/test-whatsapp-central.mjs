import assert from 'node:assert/strict'
import {
  decideGroundedResponse,
  findRuleMatch,
  buildWhatsAppDiagnostics,
  normalizeArabicMessage,
  isWhatsAppWakePhrase,
  isInvalidBridgeRegression,
  stripArabicGreetings,
  whatsappPolicy,
} from '../src/server/whatsapp-controller.mjs'

assert.equal(normalizeArabicMessage('إلى مدرسةٍ ١٢ — جميلة'), 'الي مدرسه 12 جميله')
assert.equal(stripArabicGreetings('السلام عليكم ورحمة الله وبركاته، أبي الذكاء الاصطناعي'), 'ابي الذكاء الاصطناعي')
assert.equal(whatsappPolicy.manualTakeoverMinutes, null)
assert.equal(whatsappPolicy.manualTakeoverAutoResume, false)
assert.equal(whatsappPolicy.defaultReplyMode, 'always-on')
assert.equal(whatsappPolicy.resumeMode, 'manual-takeover-wake-only')
assert.equal(whatsappPolicy.zeroHallucination, true)
assert.equal(whatsappPolicy.paidAiApis, false)
assert.equal(isWhatsAppWakePhrase('موقع د. أحمد'), true)
assert.equal(isWhatsAppWakePhrase('مَوْقِع د. الفيلكاوي؟'), true)
for (const phrase of ['السلام عليكم', 'آخر مقالة', 'اسأل الدكتور', 'موقع أحمد', 'لا تفتح موقع د أحمد']) {
  assert.equal(isWhatsAppWakePhrase(phrase), false, `${phrase} must not wake the bot`)
}
assert.equal(isInvalidBridgeRegression({ instanceId: 'one', connected: true, status: 'connected' }, 'one', 'syncing'), true)
assert.equal(isInvalidBridgeRegression({ instanceId: 'one', connected: true, status: 'connected' }, 'two', 'syncing'), false)

const controllerSource = await import('node:fs').then(({ readFileSync }) => readFileSync(new URL('../src/server/whatsapp-controller.mjs', import.meta.url), 'utf8'))
assert.match(controllerSource, /runtime-resume/)
assert.match(controllerSource, /\\d\{5,30\}.*s\\\.whatsapp\\\.net/)
assert.doesNotMatch(controllerSource, /resumedAutomaticallyAt/)
assert.match(controllerSource, /mode: 'silent', wakeActive: false, wakeVersion: 1/)
assert.match(controllerSource, /resumes: 'wake-phrase-only'/)
assert.match(controllerSource, /reason: 'owner-private-chat'/)
assert.match(controllerSource, /reason: 'duplicate-delivery'/)
assert.match(controllerSource, /path === '\/recover'/)

const now = Date.parse('2026-07-29T18:30:00.000Z')
const healthyDiagnostics = buildWhatsAppDiagnostics({
  now,
  status: {
    status: 'connected',
    bridgeOnline: true,
    heartbeatAgeMs: 4_000,
    indexed: 196,
    runtimePaused: false,
    health: { ready: true, needsAuthScan: false, why: '' },
  },
  conversations: [{ lastInboundAt: '2026-07-29T18:29:50.000Z', lastReplyAt: '2026-07-29T18:29:52.000Z' }],
  commands: [],
})
assert.equal(healthyDiagnostics.code, 'healthy')
assert.equal(healthyDiagnostics.level, 'healthy')
assert.equal(healthyDiagnostics.checks.length, 5)
assert.equal(healthyDiagnostics.queue.staleLeased, 0)

const offlineDiagnostics = buildWhatsAppDiagnostics({
  now,
  status: { status: 'disconnected', bridgeOnline: false, indexed: 196, health: { ready: false, needsAuthScan: false, why: 'لا توجد نبضة' } },
})
assert.equal(offlineDiagnostics.code, 'resident-offline')
assert.equal(offlineDiagnostics.level, 'critical')

const pausedDiagnostics = buildWhatsAppDiagnostics({
  now,
  status: { status: 'connected', bridgeOnline: true, indexed: 196, runtimePaused: true, health: { ready: true, needsAuthScan: false } },
})
assert.equal(pausedDiagnostics.code, 'replies-paused')

const stalledDiagnostics = buildWhatsAppDiagnostics({
  now,
  status: { status: 'connected', bridgeOnline: true, indexed: 196, runtimePaused: false, health: { ready: true, needsAuthScan: false } },
  commands: [{ status: 'leased', leasedAt: '2026-07-29T18:20:00.000Z' }],
})
assert.equal(stalledDiagnostics.code, 'queue-stalled')
assert.equal(stalledDiagnostics.queue.staleLeased, 1)

const panelSource = await import('node:fs').then(({ readFileSync }) => readFileSync(new URL('../src/components/admin/WhatsAppAgentPanel.tsx', import.meta.url), 'utf8'))
assert.match(panelSource, /data-whatsapp-recovery-center="true"/)
assert.match(panelSource, /\/admin\/recover/)
assert.match(panelSource, /مركز التشخيص والإحياء/)

const rules = [{
  id: 'hours',
  name: 'الدوام',
  keywords: ['مواعيد الدوام'],
  priority: 100,
  matchType: 'any',
  actionType: 'text',
  responseText: 'المواعيد المعتمدة هي: الأحد إلى الخميس.',
  enabled: true,
}]

assert.equal(findRuleMatch('هلا، مواعيد الدوم شنو؟', rules)?.id, 'hours')
assert.match(decideGroundedResponse({ text: 'مواعيد الدوام', rules }).reply, /المواعيد المعتمدة هي: الأحد إلى الخميس/)
assert.match(decideGroundedResponse({ text: 'مواعيد الدوام', rules }).reply, /رد آلي من موقع/)

const media = decideGroundedResponse({ text: 'شوف الملف', hasMedia: true })
assert.equal(media.kind, 'escalate')
assert.equal(media.reason, 'media')
assert.match(media.reply, /تأكيداً بشرياً/)

const human = decideGroundedResponse({ text: 'أبي أكلم موظف' })
assert.equal(human.kind, 'escalate')
assert.equal(human.reason, 'human-request')

const price = decideGroundedResponse({ text: 'أبي قائمة الأسعار' })
assert.equal(price.kind, 'reply')
assert.match(price.reply, /dr-alfailakawi\.com/)
assert.doesNotMatch(price.reply, /\d+\s*(?:د\.ك|دينار)/)

const unknown = decideGroundedResponse({ text: 'شنو طقس كوكب نبتون باچر؟' })
assert.equal(unknown.kind, 'reply')
assert.ok(['active-clarify', 'no-grounded-answer'].includes(unknown.reason))
assert.match(unknown.reply, /اكتب الفكرة|كلمة أقرب/)

const archive = decideGroundedResponse({ text: 'الذكاء الاصطناعي في التعليم' })
assert.equal(archive.kind, 'reply')
assert.match(archive.reply, /https:\/\/dr-alfailakawi\.com\//)
assert.match(archive.reply, /لخّص الأولى|عطني غيرها/)
assert.match(archive.reply, /رد آلي من موقع/)

console.log('WhatsApp central policy: passed')
