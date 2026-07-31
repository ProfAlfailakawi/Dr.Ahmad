import assert from 'node:assert/strict'
import {
  decideGroundedResponse,
  findRuleMatch,
  returningReaderLine,
  buildWhatsAppDiagnostics,
  normalizeArabicMessage,
  isWhatsAppWakePhrase,
  isDuplicateInboundDelivery,
  isInvalidBridgeRegression,
  isStaleInboundMessage,
  stripArabicGreetings,
  whatsappPolicy,
} from '../src/server/whatsapp-controller.mjs'

assert.equal(normalizeArabicMessage('إلى مدرسةٍ ١٢ — جميلة'), 'الي مدرسه 12 جميله')
assert.equal(stripArabicGreetings('السلام عليكم ورحمة الله وبركاته، أبي الذكاء الاصطناعي'), 'ابي الذكاء الاصطناعي')
assert.equal(whatsappPolicy.manualTakeoverMinutes, null)
assert.equal(whatsappPolicy.manualTakeoverAutoResume, false)
/* قاعدة الدكتور المطلقة بعد كارثة ٣٠ يوليو (ردّ آلي على بثّ مدرسة إعلاني):
   لا ردّ لأحد إطلاقاً إلا بجملة الإيقاظ، ونسخة الإيقاظ المعتمدة هي ٢ —
   فكل جلسةٍ فتحها وضع «دائم التفاعل» القديم دون الجملة لاغية. */
assert.equal(whatsappPolicy.defaultReplyMode, 'wake-phrase-only')
assert.equal(whatsappPolicy.wakeEpoch, 2)
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
assert.equal(isStaleInboundMessage({
  timestamp: Date.parse('2026-07-30T18:00:00.000Z') / 1000,
  bridgeReadyAt: '2026-07-30T18:10:00.000Z',
  now: Date.parse('2026-07-30T18:10:05.000Z'),
}), true, 'messages from before this bridge runtime must never wake/reply after sync')
assert.equal(isStaleInboundMessage({
  timestamp: Date.parse('2026-07-30T18:09:30.000Z') / 1000,
  bridgeReadyAt: '2026-07-30T18:10:00.000Z',
  now: Date.parse('2026-07-30T18:10:05.000Z'),
}), true, 'even a message only 30 seconds before ready belongs to downtime and must be quarantined')
assert.equal(isStaleInboundMessage({
  timestamp: Date.parse('2026-07-30T18:09:59.000Z') / 1000,
  bridgeReadyAt: '2026-07-30T18:10:00.000Z',
  now: Date.parse('2026-07-30T18:10:05.000Z'),
}), false, 'only the bounded clock/timestamp grace may cross the ready cutover')

const controllerSource = await import('node:fs').then(({ readFileSync }) => readFileSync(new URL('../src/server/whatsapp-controller.mjs', import.meta.url), 'utf8'))
assert.match(controllerSource, /runtime-resume/)
assert.match(controllerSource, /\\d\{5,30\}.*s\\\.whatsapp\\\.net/)
assert.doesNotMatch(controllerSource, /resumedAutomaticallyAt/)
assert.match(controllerSource, /mode: 'silent', wakeActive: false, wakeVersion: 1/)
assert.match(controllerSource, /resumes: 'wake-phrase-only'/)
assert.match(controllerSource, /reason: 'owner-private-chat'/)
assert.match(controllerSource, /reason: 'duplicate-delivery'/)
assert.match(controllerSource, /reason: 'duplicate-delivery-replay'/)
assert.match(controllerSource, /recentInboundResponses/)
assert.doesNotMatch(controllerSource, /احتاجت متابعة بشرية|سيكمل معك الفريق|سيكمل معك الدكتور أو أحد الفريق/)
assert.match(controllerSource, /path === '\/recover'/)
assert.match(controllerSource, /path === '\/simulate-sequence'/)
assert.match(controllerSource, /الوضع الطبيعي تُقابل بالصمت التام/)
assert.match(controllerSource, /reason: 'awaiting-wake-phrase'/)
assert.match(controllerSource, /Number\(data\.wakeVersion \|\| 0\) >= 2/)
assert.match(controllerSource, /reason: 'stale-after-bridge-start'/)
assert.match(controllerSource, /media-burst-suppressed/)
assert.match(controllerSource, /cleanAudienceName/)
assert.doesNotMatch(controllerSource, /wakeActive: true,\s*\n\s*wakeVersion: 1,/, 'لا فتح جلسات بنسخة الإيقاظ الملغاة')

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
assert.equal(healthyDiagnostics.checks.length, 6)
assert.equal(healthyDiagnostics.checks.some((check) => check.id === 'missed-message-recovery'), true)
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
assert.match(panelSource, /data-whatsapp-catchup-status="true"/)

const bridgeSource = await import('node:fs').then(({ readFileSync }) => readFileSync(new URL('../whatsapp-web-bridge/index.mjs', import.meta.url), 'utf8'))
assert.match(bridgeSource, /catchUpMissedMessages/)
assert.match(bridgeSource, /inbound-checkpoint\.json/)
assert.match(bridgeSource, /setInterval\(\(\) => void catchUpMissedMessages\(\), 5 \* 60_000\)/)
assert.match(bridgeSource, /retries: 2, timeoutMs: 8_000/)
assert.match(bridgeSource, /sanitizeServerReply/)
assert.match(bridgeSource, /legacy_duplicate_decision_retrying_as_distinct_turn/)
assert.match(bridgeSource, /SAFE_CLARIFY_REPLY/)

/* ═══ عقد البصمة: نصفان لا يفترقان ═══
   الخادم يرفض إقرار النجاح الذي لا تصحبه بصمةُ المستلَم
   (`recipient-delivery-verification-failed`). فإن نُشر نصفُ الخادم وحده
   **عُدّت كلُّ رسالةٍ وصلت فاشلةً في لوحة الحملات** — وهو ما وقع فعلاً.
   يُقفل النصفان هنا معاً: الصيغة واحدة، وكلّ إقرار نجاحٍ يحمل بصمته. */
assert.match(controllerSource, /recipientFingerprint/, 'الخادم يفحص بصمة المستلَم')
assert.match(bridgeSource, /delivery: \{ recipientFingerprint:/, 'الجسر يرسل البصمة مع كل إقرار نجاح')
assert.match(bridgeSource, /wa-recipient:\$\{digits\}/, 'صيغة البصمة في الجسر تطابق الخادم')
assert.match(controllerSource, /`wa-recipient:\$\{digits\}`/, 'صيغة البصمة في الخادم تطابق الجسر')
/* كل مسارات إقرار النجاح الثلاثة (إرسال، ذاتية، إقرار متأخّر) تحمل البصمة */
assert.equal(
  (bridgeSource.match(/ok: true, delivery: \{ recipientFingerprint:/g) || []).length,
  3,
  'المسارات الثلاثة لإقرار النجاح تحمل البصمة — وإلا حُسبت رسائل واصلة فاشلة',
)

const cloudBridgeSource = await import('node:fs').then(({ readFileSync }) => readFileSync(new URL('../whatsapp-bridge/bridge.mjs', import.meta.url), 'utf8'))
assert.match(cloudBridgeSource, /backfilled_message_quarantined/)
assert.match(cloudBridgeSource, /bridgeReadyAt: runtime\.readyAt/)
assert.match(cloudBridgeSource, /client\.getNumberId\(digits\)/)
assert.match(cloudBridgeSource, /command\.type === 'send-self-message'/)
assert.match(cloudBridgeSource, /await acknowledgeCommand\(command\.id, true\)/)
assert.match(cloudBridgeSource, /delivery-checkpoints\.json/, 'successful sends must survive bridge restart without resend')
assert.match(cloudBridgeSource, /outbound_delivery_checkpoint_replayed/)
assert.match(cloudBridgeSource, /recipient-fingerprint-mismatch/)
assert.match(cloudBridgeSource, /recipient-resolution-mismatch/)
assert.match(cloudBridgeSource, /inboundReplyCheckpoints/)
assert.match(cloudBridgeSource, /inboundInFlight/)
assert.doesNotMatch(cloudBridgeSource, /join\(config\.sessionDir[^\n]*delivery-checkpoints/, 'delivery state must remain outside the live WhatsApp session directory')
assert.doesNotMatch(cloudBridgeSource, /\.getChat\(/, 'broadcast delivery must not depend on an undefined chat object')

assert.match(controllerSource, /idempotencyKey: `broadcast:\$\{ref\.id\}:\$\{cursor\}:\$\{recipientFingerprint\}`/)
assert.match(controllerSource, /campaignAccountedAt/, 'campaign counts must be idempotent across duplicate ACKs')
assert.match(controllerSource, /reconcileBroadcastState/, 'active campaigns must reconcile after restart')
assert.match(controllerSource, /broadcastReconcileDelayMs/, 'restart repair must preserve the quiet-send interval instead of bursting')
assert.match(controllerSource, /recipient-delivery-verification-failed/, 'server must independently verify exact broadcast recipient')
assert.match(controllerSource, /outboundRecipientFingerprint/, 'broadcast recipients must use a non-reversible fingerprint')
assert.match(controllerSource, /const seenRecipients = new Set\(\)/, 'campaign target construction must suppress duplicate numbers without deleting saved contacts')
assert.match(controllerSource, /campaignAccountedAt: null/, 'retry-failed must open a fresh accounting cycle instead of reusing the old failure count')
assert.match(controllerSource, /accountingVersion: 2/, 'new commands must opt into atomic campaign accounting explicitly')
assert.match(controllerSource, /legacy-retry-accounting-unknown/, 'legacy retries must never be double-counted during reconciliation')
assert.match(controllerSource, /legacyAccountingInferred/, 'legacy normal sends use safe count inference instead of blind re-accounting')
assert.match(controllerSource, /تم إصلاح مؤشر إرسال مفقود/, 'reconciliation must repair orphaned pending pointers')

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
assert.equal(media.kind, 'reply')
assert.equal(media.reason, 'media-description-needed')
assert.match(media.reply, /اكتب المطلوب بجملة واحدة/)
assert.doesNotMatch(media.reply, /متابعة بشرية|الفريق/)
/* رشقة الصور (ترقية ٣١ يوليو): الصمت التام كان يبدو عطلاً. الصورة الثانية
   في النافذة تُقابَل باعترافٍ واحد، وما بعدها يصمت فعلاً — لا فيضان ولا تجاهل. */
const mediaBurst = decideGroundedResponse({ text: '', hasMedia: true, conversation: { lastMediaReplyAt: new Date().toISOString() } })
assert.equal(mediaBurst.kind, 'reply')
assert.equal(mediaBurst.reason, 'media-burst-acknowledged')
assert.match(mediaBurst.reply, /وصلتني بقية الصور/)
const mediaBurstTail = decideGroundedResponse({ text: '', hasMedia: true, conversation: { lastMediaReplyAt: new Date().toISOString(), mediaBurstCount: 2 } })
assert.equal(mediaBurstTail.kind, 'no-reply')
assert.equal(mediaBurstTail.reason, 'media-burst-suppressed')

const human = decideGroundedResponse({ text: 'أبي أكلم موظف' })
assert.equal(human.kind, 'escalate')
assert.equal(human.reason, 'human-request')
assert.doesNotMatch(human.reply, /سيكمل معك الفريق|سيرد عليك الدكتور/)

assert.equal(isDuplicateInboundDelivery({
  messageIdHash: 'message-b',
  recentMessageIds: ['message-a'],
  incomingHash: 'same-text',
  previousIncomingHash: 'same-text',
  previousInboundAt: '2026-07-29T20:10:00.000Z',
  now: Date.parse('2026-07-29T20:10:03.000Z'),
}), false, 'same text in a new WhatsApp message is a new conversation turn')
assert.equal(isDuplicateInboundDelivery({
  messageIdHash: 'message-a',
  recentMessageIds: ['message-a'],
}), true, 'the exact WhatsApp delivery id is deduplicated')

const price = decideGroundedResponse({ text: 'أبي قائمة الأسعار' })
assert.equal(price.kind, 'reply')
assert.match(price.reply, /dr-alfailakawi\.com/)
assert.doesNotMatch(price.reply, /\d+\s*(?:د\.ك|دينار)/)

const unknown = decideGroundedResponse({ text: 'شنو طقس كوكب نبتون باچر؟' })
assert.equal(unknown.kind, 'reply')
assert.ok(['active-clarify', 'no-grounded-answer'].includes(unknown.reason))
assert.match(unknown.reply, /اكتب الفكرة|اكتب الموضوع|كلمة أقرب/)

const archive = decideGroundedResponse({ text: 'الذكاء الاصطناعي في التعليم' })
assert.equal(archive.kind, 'reply')
assert.match(archive.reply, /https:\/\/dr-alfailakawi\.com\//)
assert.match(archive.reply, /لخّصها|لخّص الأولى|غيرها/)
assert.match(archive.reply, /رد آلي من موقع/)

/* محادثة واحدة لا ثلاثة اختبارات منفصلة: يفتح مادة، يتذكرها عند «لخصها»،
   ثم ينتقل إلى مادة أخرى من دون أن يسكت بعد الرد الأول. */
let continuousConversation = {}
const continuousInputs = ['آخر مقالة', 'لخصها', 'عطني غيرها']
const continuousTurns = []
const continuousStartedAt = Date.now()
for (const text of continuousInputs) {
  const decision = decideGroundedResponse({ text, conversation: continuousConversation })
  continuousTurns.push(decision)
  assert.equal(decision.kind === 'reply' || decision.kind === 'escalate', true, `${text} must receive a reply`)
  assert.ok(String(decision.reply || '').length > 20, `${text} reply must not be empty`)
  continuousConversation = {
    ...continuousConversation,
    mode: 'bot',
    wakeActive: true,
    lastReplyHash: 'test',
    lastDecisionReason: decision.reason,
    ...(Array.isArray(decision.contextItemIds) ? { contextItemIds: decision.contextItemIds } : {}),
    ...(Number.isInteger(decision.contextIndex) ? { contextIndex: decision.contextIndex } : {}),
    ...(decision.lastTopic ? { lastTopic: decision.lastTopic } : {}),
    ...(Array.isArray(decision.evidence) ? { seenContentIds: [...new Set([...(continuousConversation.seenContentIds || []), ...decision.evidence])] } : {}),
  }
}
assert.equal(continuousTurns.length, 3)
assert.equal(continuousTurns[1].reason, 'context-summary')
assert.equal(['more-like-this', 'no-more-results'].includes(continuousTurns[2].reason), true)
assert.ok(Date.now() - continuousStartedAt < 5_000, 'three-turn local reasoning must remain fast')
assert.match(decideGroundedResponse({ text: 'من هو الدكتور أحمد؟' }).reply, /ماذا تريد بعدها|شنو تحب أسوي بعدها/)

/* التسلسل الظاهر في صور الدكتور: اختيار ٣٠ ثانية ثم طلب أحدث المقالات
   مرتين. كل ضغطة/رسالة مستقلة يجب أن تحصل على رد، ولا تتحول إلى duplicate
   نصي أو وعد بمتابعة بشرية. */
let screenshotConversation = {}
for (const text of ['آخر مقالة', '٣٠ ثانية', 'آخر المقالات', 'آخر المقالات']) {
  const decision = decideGroundedResponse({ text, conversation: screenshotConversation })
  assert.equal(decision.kind, 'reply', `${text} must receive a useful reply`)
  assert.ok(String(decision.reply || '').length > 20)
  assert.doesNotMatch(decision.reply, /متابعة بشرية|سيكمل معك الفريق|سيرد عليك الدكتور/)
  screenshotConversation = {
    ...screenshotConversation,
    ...(Array.isArray(decision.contextItemIds) ? { contextItemIds: decision.contextItemIds } : {}),
    ...(Number.isInteger(decision.contextIndex) ? { contextIndex: decision.contextIndex } : {}),
    ...(decision.lastTopic ? { lastTopic: decision.lastTopic } : {}),
    ...(Array.isArray(decision.evidence) ? { seenContentIds: [...new Set([...(screenshotConversation.seenContentIds || []), ...decision.evidence])] } : {}),
  }
}

let navigationConversation = {}
const navigationReasons = []
for (const text of ['آخر مقالاته', 'الثانية', 'لخصها', 'المصدر', 'عطني غيرها']) {
  const decision = decideGroundedResponse({ text, conversation: navigationConversation })
  navigationReasons.push(decision.reason)
  assert.ok(decision.reply, `${text} must keep the five-turn conversation alive`)
  navigationConversation = {
    ...navigationConversation,
    ...(Array.isArray(decision.contextItemIds) ? { contextItemIds: decision.contextItemIds } : {}),
    ...(Number.isInteger(decision.contextIndex) ? { contextIndex: decision.contextIndex } : {}),
    ...(decision.lastTopic ? { lastTopic: decision.lastTopic } : {}),
    ...(Array.isArray(decision.evidence) ? { seenContentIds: [...new Set([...(navigationConversation.seenContentIds || []), ...decision.evidence])] } : {}),
  }
}
assert.deepEqual(navigationReasons.slice(0, 4), ['latest-content', 'context-reference', 'context-summary', 'context-source'])
assert.ok(['more-like-this', 'no-more-results'].includes(navigationReasons[4]))

/* ─── الذكاء الموسّع (٣٠ يوليو): مجاملات، تحكم بالرسائل، تحدي، رف، تصحيح، مقارنة، صدق الحدود ─── */
const thanks = decideGroundedResponse({ text: 'مشكور وايد' })
assert.equal(thanks.reason, 'thanks')
assert.doesNotMatch(thanks.reply, /ما لقيت|ما فهمت/)
assert.equal(decideGroundedResponse({ text: 'مع السلامة' }).reason, 'farewell')
assert.equal(decideGroundedResponse({ text: 'منو انت؟' }).reason, 'who-are-you')
assert.equal(decideGroundedResponse({ text: 'تمام' }).reason, 'acknowledged')

/* «أوقف الرسائل» محذوفة نهائياً بأمر الدكتور: لا وسم إيقاف، ولا تأكيد إيقاف،
   والرسالة تُعامل كأي نص عادي. مسح التفضيلات (خصوصية) باقٍ. */
const stop = decideGroundedResponse({ text: 'أوقف الرسائل' })
assert.notEqual(stop.reason, 'stop-messages')
assert.equal(stop.audienceSuppressed, undefined)
assert.doesNotMatch(String(stop.reply), /لن تصلك رسائل/)
assert.equal(decideGroundedResponse({ text: 'رجع الرسائل' }).audienceSuppressed, undefined)
assert.equal(decideGroundedResponse({ text: 'امسح بياناتي' }).reason, 'delete-preferences')

let quizConversation = {}
const quiz = decideGroundedResponse({ text: 'اختبرني', conversation: quizConversation })
assert.equal(quiz.reason, 'challenge-question')
assert.equal(quiz.patch.challenge.itemIds.length, 3)
assert.match(quiz.reply, /«/)
quizConversation = { challenge: quiz.patch.challenge }
const graded = decideGroundedResponse({ text: '٢', conversation: quizConversation })
assert.ok(['challenge-correct', 'challenge-missed'].includes(graded.reason), 'الرقم بعد تحدٍّ معلق يُحكم إجابةً لا تنقلاً')
assert.equal(graded.patch.challenge, null)
assert.match(graded.reply, /dr-alfailakawi\.com/)

assert.equal(decideGroundedResponse({ text: 'قارن بين المعلم والتقنية' }).reason, 'compare-topics')
assert.equal(decideGroundedResponse({ text: 'الفرق بين الحفظ والفهم' }).reason, 'compare-topics')

const corrected = decideGroundedResponse({ text: 'مو صح قصدي الذكاء الاصطناعي', conversation: { lastTopic: 'الحفظ' } })
assert.ok(['correction-retry', 'correction-clarify'].includes(corrected.reason))

const counted = decideGroundedResponse({ text: 'عطني ٤ مقالات' })
assert.equal(counted.reason, 'latest-content')
assert.ok((counted.reply.match(/dr-alfailakawi\.com/g) || []).length >= 4, 'أربع مواد كما طلب')

const honest = decideGroundedResponse({ text: 'أكثر مقالة مشاهدة' })
assert.equal(honest.reason, 'most-viewed-honest')
assert.match(honest.reply, /لا أخترع/)

assert.equal(decideGroundedResponse({ text: 'عطني اقتباس' }).reason, 'curated-quote')
assert.equal(decideGroundedResponse({ text: 'احفظها' }).reason, 'save-context-missing')
assert.equal(decideGroundedResponse({ text: 'ذكرني بكرة' }).reason, 'reminder-honest')
assert.equal(decideGroundedResponse({ text: 'أنا اليوم متضايق' }).reason, 'mood-match')

/* ─── عقلٌ يفهم ويحلّل لا يطابق أنماطاً (أول أغسطس ٢٠٢٦) ─── */

/* ١) «لخّص» يجب أن يقصّر فعلاً: كان يعيد أوّل ٤٢ كلمة — وهي بعينها فاتحة
   المادة التي عُرضت قبل سطرين — فبدا أنه أعاد المادة نفسها بدل تلخيصها. */
let distillConversation = {}
const opened = decideGroundedResponse({ text: 'آخر مقالة', conversation: distillConversation })
distillConversation = { contextItemIds: opened.contextItemIds, contextIndex: 0, seenContentIds: opened.evidence || [] }
const distilled = decideGroundedResponse({ text: 'لخصها', conversation: distillConversation })
assert.equal(distilled.reason, 'context-summary')
const openingRun = String(opened.reply).replace(/[*«»]/g, '').split(/\s+/).slice(3, 13).join(' ')
assert.ok(openingRun.length > 10, 'the opened card must carry a quotable opening')
assert.ok(
  !String(distilled.reply).includes(openingRun),
  'التلخيص لا يجوز أن يكون فاتحة المادة نفسها — هذا هو العطب الذي شكا منه الدكتور',
)

/* ٢) المضمر: إيماءةٌ قصيرة على مادةٍ حاضرة تُقرأ طلباً لا بحثاً عن عنوان. */
assert.equal(decideGroundedResponse({ text: 'ما فهمت', conversation: distillConversation }).reason, 'implied-simplify')
assert.equal(decideGroundedResponse({ text: 'زدني', conversation: distillConversation }).reason, 'implied-deepen')
/* وبلا مادةٍ حاضرة لا تُقرأ إيماءةً — فلا تبتلع كلاماً ليس لها. */
assert.notEqual(decideGroundedResponse({ text: 'ما فهمت' }).reason, 'implied-simplify')

/* ٣) طلبان في نفَسٍ واحد: الفاصلة تُقرأ من النصّ الخام (المطبَّع يمسح الترقيم). */
const twoAsks = decideGroundedResponse({ text: 'عطني شي عن التقويم، وعن الذكاء الاصطناعي' })
assert.equal(twoAsks.reason, 'compound-two-asks')
assert.ok((twoAsks.reply.match(/dr-alfailakawi\.com/g) || []).length >= 2, 'الطلبان يُجابان معاً')

/* ٤) الشكّ يُسأل عنه — وبمقدار: كلمةٌ يحملها عنوانان اثنان لا ثالثَ لهما.
   والكلمة الواسعة ليست شكّاً: الأرشيف غنيٌّ بها، والقائمة أصدق من سؤال. */
assert.equal(decideGroundedResponse({ text: 'النجاح' }).reason, 'doubt-clarify')
for (const broad of ['الحفظ', 'الخوف', 'الوقت', 'التقويم']) {
  assert.notEqual(decideGroundedResponse({ text: broad }).reason, 'doubt-clarify', `«${broad}» سعةٌ لا التباس`)
}
/* وجواب الشكّ يمشي على مسار التنقّل المثبت لا على رقمٍ مجرّد (الرقم لغةُ التحدّي) */
const doubtTurn = decideGroundedResponse({ text: 'النجاح' })
assert.match(doubtTurn.reply, /الأولى|الثانية/)
assert.doesNotMatch(doubtTurn.reply, /اكتب ١ أو ٢/)
assert.equal(
  decideGroundedResponse({ text: 'الثانية', conversation: { contextItemIds: doubtTurn.contextItemIds, contextIndex: 0 } }).reason,
  'context-reference',
)

/* ٥) ذاكرةٌ تتراكم عبر الجلسات — بلا اسمٍ ولا رقم، ومحدودةُ السقف،
   ومصفوفةً لا خريطة (merge:true يدمج الخرائط فلا يُنقصها أبداً). */
let memoryConversation = {}
for (const ask of ['الذكاء الاصطناعي', 'الذكاء الاصطناعي في التعليم']) {
  const step = decideGroundedResponse({ text: ask, conversation: memoryConversation })
  memoryConversation = { ...memoryConversation, ...(step.patch || {}) }
}
assert.ok(Array.isArray(memoryConversation.topicMemory), 'الذاكرة مصفوفة تُستبدل لا خريطة تتضخّم')
const remembered = returningReaderLine({ ...memoryConversation, lastInboundAt: new Date(Date.now() - 3 * 86_400_000).toISOString() })
assert.match(remembered, /أهلاً بعودتك/)
assert.match(remembered, /الذكاء/)
/* ولا يتكرّر الاهتمام الواحد بصورتين («الذكاء وذكاء») */
assert.doesNotMatch(remembered, /الذكاء وذكاء/)
/* ومسح البيانات يمسحها فعلاً — خصوصيةٌ لا تُستثنى */
assert.deepEqual(decideGroundedResponse({ text: 'امسح بياناتي' }).patch.topicMemory, [])

/* ٦) تحليلٌ لا استرجاع: المقارنة تقول ما يجمع الطرفين وما ينفرد به كلٌّ منهما */
const analysed = decideGroundedResponse({ text: 'قارن بين المعلم والتقنية' })
assert.equal(analysed.reason, 'compare-topics')
assert.match(analysed.reply, /الخيط الجامع|ينفرد به/)
assert.match(analysed.reply, /لا أنسب للدكتور رأياً لم يكتبه/)

/* ٧) مبادرةٌ منضبطة: تُعرض مرّةً ثم تسكت في مهلتها — لا تتحوّل ثرثرة */
const offered = decideGroundedResponse({ text: 'التقويم' })
if (/أفتحها لك؟/.test(offered.reply)) {
  assert.ok(offered.patch?.lastInitiativeAt, 'المبادرة تُؤرَّخ لتنضبط')
  const again = decideGroundedResponse({ text: 'التقويم', conversation: { lastInitiativeAt: offered.patch.lastInitiativeAt } })
  assert.doesNotMatch(again.reply, /أفتحها لك؟/, 'لا تتكرّر المبادرة داخل مهلتها')
}

/* ٨) القراءة الصوتية: «قراءة صوتية للمقالة ما يعمل» (شكوى ١ أغسطس).
   الجذر أن الصيغة كانت تشترط أداة التعريف، فتسقط «قراءه صوتيه» — وهي ما
   يكتبه الناس وما يظهر في الموقع — إلى بحثٍ أعمى بلا صوت. */
const { classifyIntent: classify, INTENTS: I } = await import('../whatsapp-agent/intent-engine.mjs')
for (const ask of ['قراءة صوتية', 'القراءة الصوتية', 'قراءة صوتية للمقالة', 'اقرأ لي المقالة',
  'اقرأ لي', 'سمعني', 'اسمعها', 'ابي اسمعها', 'شغلها', 'استماع', 'اقرأها لي', 'ابغى قراءة صوتية']) {
  assert.equal(classify(ask).intent, I.LISTEN_FAHED, `«${ask}» يجب أن تُفهم طلبَ قراءةٍ صوتية`)
}
/* ولا تخطف ما ليس طلبَ صوت */
assert.notEqual(classify('عندك شي عن القراءة').intent, I.LISTEN_FAHED)
assert.notEqual(classify('لخصها').intent, I.LISTEN_FAHED)
assert.equal(classify('الحوار').intent, I.LISTEN_DIALOGUE, 'الحوار يبقى للحوار')

/* القوالب الحية: تحرير اللوحة يجب أن يصل الردود (كان مسبوكاً عند التحميل) */
const controllerNow = controllerSource
assert.match(controllerNow, /getBotMessages/)
assert.match(controllerNow, /refreshBotMessages/)
assert.doesNotMatch(controllerNow, /^const WELCOME = /m)

console.log('WhatsApp central policy: passed')
