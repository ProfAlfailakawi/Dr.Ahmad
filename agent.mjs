import fs from 'node:fs'
import path from 'node:path'
import { AUDIO_PUBLIC_BASE_URL, BRIDGE_PORT, BRIDGE_SECRET_MIN_LENGTH, BROADCAST_DEFAULT_INTERVAL_SECONDS, BROADCAST_MIN_INTERVAL_SECONDS, HEARTBEAT_INTERVAL_MS, HEARTBEAT_STALE_MS, MANUAL_TAKEOVER_MINUTES, MAX_CAMPAIGN_TARGETS, MAX_MESSAGE_CHARS, SITE_URL, TIME_ZONE, flags, projectRoot, redactError } from './config.mjs'
import { openDatabase } from './db.mjs'
import { syncContentIndex } from './content-index.mjs'
import { INTENTS, classifyIntent, classifyIntentWithLearning, groundedRescue, handleIncoming, handleIntent, isPrivateChat, isSuppressed, markManualTakeover, matchReplyRule, setSuppression, shouldRespondToMessage } from './intent-engine.mjs'
import { MockTransport, createWhatsAppTransport } from './transport.mjs'
import { randomToken } from './crypto.mjs'
import { createReminder } from './reminders.mjs'
import { startLocalBridge } from './bridge.mjs'
import { addContactByPhone, addMembers, absorbContacts, importContacts, listContactsPage, createList, deleteList, ensureAudienceSchema, jidOf, listContacts, listLists, listMembers, personalize, previewFor, removeMember, renameList, resolveAudience, setNickname, vocativeOf } from './audience.mjs'
import { ensureBotRulesSchema, releaseContentReservation, rememberSent, reserveContent, sign } from './bot-rules.mjs'
import { refreshBotMessages } from './bot-messages.mjs'

function safeText(text) { return String(text || '').slice(0, MAX_MESSAGE_CHARS).trim() }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/* ═══ جدار المصدر قبل أن يخرج حرفٌ إلى واتساب ═══
 *
 * محرك النيات حتميّ، لكن الدفاع الأخير لا يثق حتى بالمخرجات الداخلية: قد
 * يضيف قالبٌ جديد رابطاً خارج الموقع، أو يحيل إلى معرّف حُذف من الفهرس، أو
 * يغيّر حرفاً في اقتباس. نجمع كل سطحٍ قد يراه المستخدم ونُسقط الرد كله عند
 * أول مخالفة؛ لا نحاول «تنظيفه» جزئياً لأن الباقي قد يعتمد على الجزء المرفوض.
 */
const LINK_TOKEN = /(?:https?|ftp):\/\/[^\s<>"'`«»]+|(?:mailto|tel):[^\s<>"'`«»]+|[\p{L}\p{N}._%+-]+@(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:[\p{L}]{2,63}|xn--[a-z0-9-]{2,59})|(?:www\.)?(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:[\p{L}]{2,63}|xn--[a-z0-9-]{2,59})(?::\d{1,5})?(?:[/?#][^\s<>"'`«»]*)?|(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:[/?#][^\s<>"'`«»]*)?/giu
const CONTENT_ID_KEYS = new Set(['contentId', 'answerContentId'])
const CONTENT_IDS_KEYS = new Set(['contentIds', 'contextItems', 'seenContentIds', 'optionIds'])

function cleanUrlToken(value) {
  return String(value || '').replace(/[\])}>.,،؛;!?؟'"»]+$/u, '')
}

function isBelowConfiguredBase(value, configuredBase) {
  try {
    const raw = cleanUrlToken(value)
    /* صيغة www ليست رابطاً مضبوطاً من إعداداتنا؛ لا نخمن لها بروتوكولاً. */
    if (!/^https?:\/\//i.test(raw)) return false
    const candidate = new URL(raw)
    const base = new URL(configuredBase)
    if (candidate.username || candidate.password || candidate.origin !== base.origin) return false
    const basePath = base.pathname.replace(/\/+$/, '')
    return !basePath || basePath === '/' || candidate.pathname === basePath || candidate.pathname.startsWith(`${basePath}/`)
  } catch { return false }
}

function collectReferencedContentIds(value, output = new Set(), visited = new Set()) {
  if (!value || typeof value !== 'object' || visited.has(value)) return output
  visited.add(value)
  for (const [key, entry] of Object.entries(value)) {
    if (CONTENT_ID_KEYS.has(key) && typeof entry === 'string' && entry) output.add(entry)
    else if (CONTENT_IDS_KEYS.has(key) && Array.isArray(entry)) {
      for (const id of entry) if (typeof id === 'string' && id) output.add(id)
    } else if (entry && typeof entry === 'object') collectReferencedContentIds(entry, output, visited)
  }
  return output
}

function outboundStrings(response) {
  const values = [response?.text]
  if (Array.isArray(response?.actions)) values.push(...response.actions)
  return values.filter((value) => typeof value === 'string' && value)
}

/** أي رابط وارد — ولو بلا https أو بنطاقٍ جديد — يذهب للدكتور بصمت. */
export function containsInboundLink(value) {
  LINK_TOKEN.lastIndex = 0
  const found = LINK_TOKEN.test(String(value || ''))
  LINK_TOKEN.lastIndex = 0
  return found
}

/**
 * حارسٌ نقيّ قابل للاختبار. الردود الإجرائية الثابتة (ومنها الخصوصية) لا
 * تحتاج مراجع؛ لكن ما يعلن مرجعاً أو اقتباساً يجب أن يثبت وجوده حرفياً.
 */
export function validateGroundedResponse(db, response, { siteUrl = SITE_URL, audioBaseUrl = AUDIO_PUBLIC_BASE_URL } = {}) {
  if (response?.shouldRespond === false || !outboundStrings(response).length) return { allowed: true, code: 'not-outbound' }

  const references = [...collectReferencedContentIds(response)]
  const rows = new Map()
  for (const id of references) {
    const item = db.get('SELECT id,body,excerpt,url FROM content_items WHERE id=?', id)
    if (!item) return { allowed: false, code: 'missing-content-reference' }
    rows.set(id, item)
  }

  const quotes = [...new Set([
    ...(Array.isArray(response.evidenceQuotes) ? response.evidenceQuotes : []),
    ...(typeof response.quote === 'string' && response.quote ? [response.quote] : []),
  ].map((quote) => String(quote || '')).filter(Boolean))]
  if (quotes.length && !rows.size) return { allowed: false, code: 'quote-without-content-reference' }
  for (const quote of quotes) {
    const exact = [...rows.values()].some((item) => [item.body, item.excerpt].some((source) => String(source || '').includes(quote)))
    if (!exact) return { allowed: false, code: 'unverified-evidence-quote' }
  }

  for (const text of outboundStrings(response)) {
    LINK_TOKEN.lastIndex = 0
    for (const match of text.matchAll(LINK_TOKEN)) {
      const url = cleanUrlToken(match[0])
      if (!isBelowConfiguredBase(url, siteUrl) && !isBelowConfiguredBase(url, audioBaseUrl)) {
        return { allowed: false, code: 'unapproved-outbound-url' }
      }
    }
    LINK_TOKEN.lastIndex = 0
  }
  return { allowed: true, code: 'grounded', references: references.length, quotes: quotes.length }
}

export function createAgent({ db = openDatabase(), transport, root = projectRoot, mock = false } = {}) {
  const state = { db, transport: transport || null, root, timers: new Set(), started: false, stopping: false, bridge: null, activeCampaigns: new Set(), groundingSequence: 0 }
  /* واجهة الوكيل العامة تُعلن هنا وتُملأ عند الإرجاع: الجسر كان يستقبل `state`
     الخام فينهار على `agent.bridgeSecret is not a function` قبل أن يفتح المنفذ،
     فتظهر اللوحة «غير مرتبط» بينما واتساب متصل فعلاً. */
  const api = {}
  ensureAudienceSchema(db)
  ensureBotRulesSchema(db)
  const index = () => syncContentIndex(db, root, SITE_URL)

  /* ═══ الجمهور: دفتر الأسماء وقوائم الدكتور ═══
     واتساب لا يصدّر قوائم البث لجهازٍ مرتبط (لا دالة لها في baileys)، لكنه
     يزامن جهات الاتصال بأسمائها — فمنها يبني الدكتور قوائمه، ونرسل رسائل
     فردية مخصّصة بدل بثٍّ أعمى: تصل لمن لم يحفظ رقمه، وتناديه باسمه. */
  const onContacts = (contacts) => absorbContacts(db, contacts)
  const audience = {
    contacts: (options) => listContacts(db, options),
    contactsPage: (options) => listContactsPage(db, options),
    addContact: (phone, nickname) => addContactByPhone(db, phone, nickname),
    import: (text, options) => importContacts(db, text, options),
    setNickname: (contactId, nickname) => setNickname(db, contactId, nickname),
    lists: () => listLists(db),
    createList: (name, note) => createList(db, name, note),
    renameList: (id, name, note) => renameList(db, id, name, note),
    deleteList: (id) => deleteList(db, id),
    members: (listId) => listMembers(db, listId),
    addMembers: (listId, ids) => addMembers(db, listId, ids),
    removeMember: (listId, id) => removeMember(db, listId, id),
    preview: (listId, text) => previewFor(db, listId, text),
    /* من قائمةٍ إلى مسوّدة حملة: يحوّل الأعضاء إلى جهات، ويترك الاعتماد
       والإرسال بيد الدكتور كما هما — لا تخرج رسالة بغير أمره. */
    draftFromList(listId, name, message) {
      const list = db.get('SELECT * FROM broadcast_lists WHERE id=?', listId)
      if (!list) throw new Error('القائمة غير موجودة')
      const { send } = resolveAudience(db, listId)
      if (!send.length) throw new Error('لا أحد في هذه القائمة (أو كلهم طلبوا الإيقاف).')
      const targets = send.map((member) => {
        const row = db.get('SELECT * FROM contacts WHERE id=?', member.id)
        return { id: member.id, jid: jidOf(db, row), kind: 'contact' }
      }).filter((target) => target.jid)
      const id = queueCampaign({ name: name || `${list.name} — ${new Date().toLocaleDateString('en-GB')}`, message, targets })
      db.addAudit('campaign-from-list', listId, `targets=${targets.length}`)
      return { id, targets: targets.length }
    },
    resolve: (listId) => resolveAudience(db, listId),
    personalize,
  }
  const decryptJidSafe = (value) => {
    try { return value ? db.decryptJid(value) : '' } catch { return String(value || '') }
  }
  const campaignInterval = (seconds) => Math.max(BROADCAST_MIN_INTERVAL_SECONDS, Number(seconds || BROADCAST_DEFAULT_INTERVAL_SECONDS))
  const resolveCampaignTarget = (target) => {
    if (target.kind === 'self' || target.target_id === 'self') return 'self@s.whatsapp.net'
    if (target.encrypted_jid) return decryptJidSafe(target.encrypted_jid)
    return ''
  }
  const campaignTargets = (id) => db.all('SELECT ct.*, c.jid AS encrypted_jid, c.suppressed AS contact_suppressed FROM campaign_targets ct LEFT JOIN contacts c ON c.id=ct.target_id WHERE ct.campaign_id=? ORDER BY ct.target_id', id)
  const heartbeat = () => db.setSetting('bridge.heartbeat', { at: new Date().toISOString(), pid: process.pid })
  const bridgeSecret = () => {
    const configured = String(process.env.WHATSAPP_AGENT_BRIDGE_SECRET || '').trim()
    if (configured && configured.length < BRIDGE_SECRET_MIN_LENGTH) throw new Error(`WHATSAPP_AGENT_BRIDGE_SECRET يجب ألا يقل عن ${BRIDGE_SECRET_MIN_LENGTH} خانة.`)
    if (configured) return configured
    const existing = db.getSetting('bridge.secret', '')
    if (typeof existing === 'string' && existing.length >= BRIDGE_SECRET_MIN_LENGTH) return existing
    const generated = randomToken(48)
    db.setSetting('bridge.secret', generated)
    db.addAudit('bridge-secret-created', 'local', `length=${generated.length}`)
    return generated
  }
  /* ★ العَلَم يصل من المستوى الأعلى: الناقل يرسل onMessage({ jid, text, message,
     media }) — انظر transport.mjs. وكان هذا التوقيع يُسقط `media` عند التفكيك
     ثم يبحث عنه في `message.media` حيث لا وجود له، فلم يعمل الحارس ولا مرّة:
     كلُّ بصمةٍ صوتية وصورةٍ تُعامَل نصّاً، فإن حملت جملة الإيقاظ ردّ عليها
     البوت. وهذا نقضٌ لقاعدة الدكتور المطلقة: لا يردّ على صوتٍ ولا صورة.

     ونقرأ الموضعين معاً فلا يعود التوقيع يكسر الحارس، ونُمرّر hasMedia إلى
     المحرك أيضاً — خطُّ دفاعٍ ثانٍ إن أخطأ الأول. */
  /**
   * ★ هل هذه الرسالة ردٌّ على البوت حقاً؟
   *
   * كان الشرط `Boolean(contextInfo.quotedMessage)` — أي «هل فيها اقتباسٌ لأيّ
   * رسالة؟» لا «هل المقتبَس من كلام البوت؟». والاسم يَعِد بالثاني والكودُ يفعل
   * الأول. فمن اقتبس رسالةَ نفسه — وهو أكثر ما يفعله الناس في واتساب — فُتح له
   * الباب بلا جملة إيقاظ، وردّ عليه البوت. وهذا نقضٌ للقاعدة المطلقة.
   *
   * والتحقّق ممكنٌ بيقين: البوت يسجّل معرّف كل رسالةٍ يرسلها في outbox_messages
   * (transport.mjs). فنطابق معرّف المقتبَس بها — فلا يفتح البابَ إلا اقتباسُ
   * كلامِ البوت نفسه، ولا يُفتح باقتباس كلام الناس بعضهم بعضاً.
   */
  const isReplyToBot = (message, jid) => {
    const context = message?.message?.extendedTextMessage?.contextInfo
    if (!context?.quotedMessage) return false
    const quotedId = String(context.stanzaId || context.id || '')
    if (!quotedId) return false
    return Boolean(db.get('SELECT message_id FROM outbox_messages WHERE message_id=? AND jid=?', quotedId, db.jidKey(jid)))
  }

  const rejectUngrounded = (jid, response, verdict, incomingText = '') => {
    /* بدل الصمت التام: إن كان السؤالُ عن موضوعٍ منشور، ننقذه بأقرب موادّ
       الدكتور الحقيقية (روابط لا تُؤلَّف). والصمتُ يبقى لِما هو شخصيٌّ أو خارج
       النطاق حيث لا رابطَ يليق. الإنقاذ مسنَدٌ بذاته فلا يُعاد فحصه. */
    const rescue = groundedRescue(db, incomingText)
    if (rescue) {
      db.addAudit('grounding-rescue', db.jidKey(jid), `reason=${verdict.code}`)
      return {
        ...response,
        ...rescue,
        actions: [],
        evidenceQuotes: [],
        shouldRespond: true,
        silent: false,
        needsHuman: false,
        reason: 'grounding-rescue',
      }
    }
    if (isPrivateChat(jid)) markManualTakeover(db, jid)
    db.addAudit('grounding-firewall-blocked', db.jidKey(jid), `reason=${verdict.code}`)
    return {
      ...response,
      text: '',
      actions: [],
      contentId: null,
      contextItems: [],
      seenContentIds: [],
      evidenceQuotes: [],
      shouldRespond: false,
      silent: true,
      needsHuman: true,
      reason: 'grounding-firewall',
      groundingFailure: verdict.code,
    }
  }

  /**
   * نجعل كتابات المحرك مؤقتة داخل SAVEPOINT حتى ينجح حارس المصدر. بهذا لا
   * يُحفظ سياقٌ ولا استشهادٌ ولا تذكيرٌ لردّ رُفض ولم يخرج. أوامر الخصوصية
   * وحدها تنفّذ معاملتها الداخلية مباشرةً؛ نصوصها إجرائية ثابتة ويمرّرها
   * الحارس أيضاً قبل أن يُسمح بإرسالها.
   */
  const handleGroundedIncoming = (args, { privacyCommand = false } = {}) => {
    const execute = () => {
      const response = handleIncoming(args)
      return { response, verdict: validateGroundedResponse(db, response) }
    }
    if (privacyCommand || !db.db?.exec) {
      const { response, verdict } = execute()
      return verdict.allowed ? response : rejectUngrounded(args.jid, response, verdict, args.text)
    }

    const savepoint = `grounding_${++state.groundingSequence}`
    let open = false
    const rollback = () => {
      if (!open) return
      try { db.db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`) } finally {
        db.db.exec(`RELEASE SAVEPOINT ${savepoint}`)
        open = false
      }
    }
    try {
      db.db.exec(`SAVEPOINT ${savepoint}`)
      open = true
      const { response, verdict } = execute()
      if (!verdict.allowed) {
        rollback()
        return rejectUngrounded(args.jid, response, verdict, args.text)
      }
      db.db.exec(`RELEASE SAVEPOINT ${savepoint}`)
      open = false
      return response
    } catch (error) {
      try { rollback() } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'فشل حارس المصدر وتنظيف معاملته.')
      }
      throw error
    }
  }

  /* 🔔 جرس التصعيد (المُقتبَس من مواصفة صديق الدكتور): حين يتنحى البوت عن
     محادثةٍ تحتاج بشراً لا يكفي الصمت الداخلي — يصل الدكتورَ نداءٌ فوري في
     محادثته الذاتية باسم السائل وخلاصة سؤاله. مهلة ٣٠ دقيقة لكل محادثة
     كي لا ينقلب الجرسُ إزعاجاً، والجرس لا يُسقط الرد أبداً إن تعطل. */
  const BELL_COOLDOWN_MS = 30 * 60 * 1000
  const ringOwnerBell = (jid, incomingText, cause) => {
    try {
      if (!flags.send || !state.transport || !isPrivateChat(jid)) return
      const bellKey = `escalation-bell:${db.jidKey(jid)}`
      const lastRing = Number(db.getSetting(bellKey, 0))
      if (Date.now() - lastRing < BELL_COOLDOWN_MS) return
      db.setSetting(bellKey, Date.now())
      const phone = String(jid).split('@')[0].split(':')[0]
      const snippet = safeText(incomingText).slice(0, 140)
      const reasonLine = cause === 'media'
        ? 'أرسل وسائط أو رابطاً — والبوت لا يفتحها بقاعدتك.'
        : cause === 'answered'
          ? 'أجبتُه جواباً محايداً وأُشعر أنه يحتاج ردّك البشري.'
          : 'لم أجد له جواباً صادقاً من الأرشيف فتنحّيتُ وأسكتُّ المحادثة.'
      const lines = [
        '🔔 محادثة تحتاجك يا دكتور',
        `من: ‎+${phone}`,
        snippet ? `قال: «${snippet}»` : '',
        reasonLine,
        'ردُّك عليه بخط يدك يُبقي البوت متنحياً ٣٠ دقيقة تتجدد مع كل رد.',
      ]
      void Promise.resolve(sendSelf(lines.filter(Boolean).join('\n'))).catch(() => {})
      db.addAudit('escalation-bell', db.jidKey(jid), cause)
    } catch { /* جرسٌ معطوب لا يعطل البوت */ }
  }

  const onMessage = ({ jid, text, message, media, at }) => {
    const hasMedia = Boolean(media || message?.media)
    const incomingText = safeText(text)
    const incomingIntent = classifyIntent(incomingText).intent
    const privacyCommand = [INTENTS.STOP_MESSAGES, INTENTS.RESUME_MESSAGES, INTENTS.DELETE_PREFERENCES].includes(incomingIntent)
    const runtimePaused = Boolean(db.getSetting('agent.runtimePaused', false))
    if (runtimePaused && !privacyCommand) {
      db.addAudit('auto-reply-skipped', db.jidKey(jid), 'runtime-paused-by-owner')
      return { shouldRespond: false, reason: 'runtime-paused-by-owner' }
    }
    const hasLink = containsInboundLink(text)
    if (!privacyCommand && (hasMedia || hasLink)) {
      if (isPrivateChat(jid)) markManualTakeover(db, jid)
      db.addAudit('needs-human-media-or-link', db.jidKey(jid), hasMedia ? 'media' : 'link')
      ringOwnerBell(jid, incomingText, 'media')
      return { shouldRespond: false, reason: 'media-or-link-human' }
    }
    const response = handleGroundedIncoming(
      { db, jid, text: incomingText, hasMedia, isReplyToAgent: isReplyToBot(message, jid), at: at || new Date() },
      { privacyCommand },
    )
    /* مفتاح الطوارئ يوقف الكلام لا حقوق الخصوصية: نطبّق الأمر ثم نصمت. */
    if (runtimePaused && privacyCommand) {
      db.addAudit('privacy-command-applied', '', `${response.intent || incomingIntent};silent=true;runtime-paused=true`)
      return { ...response, text: '', shouldRespond: false, privacyApplied: true, reason: 'runtime-paused-privacy' }
    }
    /* ★ ما لا جواب له لا يُجاب. حين يُعلن المحرك أنه لا يملك ردّاً (silent)
       نصمت ونُسكت المحادثة ونترك الأمر للدكتور — بدل إبلاغ السائل بفشل بحث. */
    if (response.silent) {
      if (response.groundingFailure) {
        ringOwnerBell(jid, incomingText, 'silent')
        return response
      }
      markManualTakeover(db, jid)
      db.addAudit('needs-human-silent', db.jidKey(jid), response.intent || 'no-match')
      ringOwnerBell(jid, incomingText, 'silent')
      return { ...response, shouldRespond: false, reason: 'needs-human-silent' }
    }
    if (response.privacyApplied) db.addAudit('privacy-command-applied', '', `${response.intent || 'privacy'};silent=${!response.shouldRespond}`)
    else if (!response.shouldRespond) db.addAudit('auto-reply-skipped', db.jidKey(jid), response.reason || 'blocked')
    if (!response.shouldRespond || !flags.autoReply || !flags.send) return response
    if (response.needsHuman) ringOwnerBell(jid, incomingText, 'answered')
    if (response.text && state.transport?.sendText) {
      /* حارس التكرار (من مواصفة صديق الدكتور): السؤال المعاد الذي أنتج
         الجواب الحرفي نفسه خلال عشر دقائق لا يستحق نسخه — إشارةٌ مختصرة
         للأعلى تكفي أدباً، ولا صمت. الأجوبة المتجددة (فاجئني ونحوها)
         تختلف نصاً كل مرة فلا يمسها الحارس أصلاً. */
      const repeatKey = `repeat-guard:${db.jidKey(jid)}`
      const priorReply = db.getSetting(repeatKey, null)
      const repeatedVerbatim = Boolean(
        priorReply && priorReply.text === response.text
        && Date.now() - Number(priorReply.at) < 10 * 60 * 1000,
      )
      const outgoingText = repeatedVerbatim
        ? 'أرسلتُ لك هذا الجواب قبل قليل ⬆️ — وإن كنتَ تقصد شيئاً آخر فوضّح لي أكثر.'
        : response.text
      /* الحجز يمنع سباق «اختيارٍ جديد» فقط. الطلب الصريح لأحدث مقالة أو
         تلخيص مادة بعينها يجوز أن يكررها عمداً، فلا نرفضه لمجرد أن إرسالاً
         آخر للمادة نفسها ما زال في الطريق. */
      const enforceNoRepeat = Boolean(response.enforceNoRepeat) || [
        INTENTS.WELCOME,
        INTENTS.SURPRISE_ME,
        INTENTS.CHALLENGE,
        INTENTS.CONTENT_BY_MOOD,
      ].includes(response.intent)
      const seen = [...new Set(
        Array.isArray(response.seenContentIds) && response.seenContentIds.length
          ? response.seenContentIds
          : response.contentId
            ? [response.contentId]
            : enforceNoRepeat && Array.isArray(response.contextItems) ? response.contextItems : [],
      )]
      const reserved = []
      if (enforceNoRepeat && !repeatedVerbatim) {
        for (const contentId of seen) {
          if (reserveContent(db, jid, contentId)) reserved.push(contentId)
          else {
            for (const acquired of reserved) releaseContentReservation(db, jid, acquired)
            db.addAudit('auto-reply-skipped-reservation', db.jidKey(jid), 'content-already-in-flight')
            return { ...response, text: '', shouldRespond: false, silent: true, reason: 'content-already-in-flight' }
          }
        }
      }
      const release = () => { for (const contentId of reserved) releaseContentReservation(db, jid, contentId) }
      try {
        void Promise.resolve(state.transport.sendText(jid, outgoingText)).then(() => {
          if (!repeatedVerbatim) {
            for (const contentId of seen) rememberSent(db, jid, contentId)
            db.setSetting(repeatKey, { text: response.text, at: Date.now() })
          }
          db.addAudit('auto-reply-sent', db.jidKey(jid), repeatedVerbatim ? 'repeat-guard-brief' : response.reason || '')
        }).catch((error) => {
          release()
          db.addAudit('auto-reply-failed', db.jidKey(jid), redactError(error))
        })
      } catch (error) {
        release()
        db.addAudit('auto-reply-failed', db.jidKey(jid), redactError(error))
      }
    }
    return response
  }
  const start = async ({ phoneNumber } = {}) => {
    if (!flags.agent) { db.setState({ status: 'paused', last_error: 'WHATSAPP_AGENT_ENABLED=false' }); return { status: 'paused' } }
    if (state.started) return db.state()
    state.stopping = false
    index()
    db.purgeExpired()
    if (!state.transport) state.transport = mock ? new MockTransport() : await createWhatsAppTransport({ db, onMessage, onContacts })
    /* حين يكتب الدكتور بيده، يصمت البوت فوراً في تلك المحادثة ويعود بعد
       المدة المحددة. كان الحدث يُطلَق من واتساب ولا أحد يستمع له — فيتكلم
       البوت فوق كلام الدكتور. هذا هو المستمع الغائب. */
    if (!state.takeoverBound && state.transport?.events?.on) {
      state.transport.events.on('manual-takeover', (jid) => {
        try { manualTakeover(jid) } catch (error) { db.addAudit('manual-takeover-failed', '', redactError(error)) }
      })
      state.takeoverBound = true
    }
    const transportEvents = state.transport.events || state.transport
    transportEvents?.on?.('status', (payload) => db.setState(typeof payload === 'string' ? { status: payload } : payload))
    /* رمز الاقتران يُحفظ ليراه الدكتور في لوحته. كان هذان المستمعان يمحوانه
       (qr: null) بعد أن يحفظه transport مباشرةً، فلا يظهر في اللوحة أبداً —
       ويبقى مطبوعاً في سجلّ الطرفية وحده حيث لا يفتحه أحد.

       والحدّ الأمنيّ لم يُخترق: الرمز يعيش في قاعدةٍ محليّة على ماك الدكتور،
       ويصل لوحته عبر جسرٍ يستمع على 127.0.0.1 وحده بسرٍّ من أربعٍ وستين خانة.
       ولا يُرسَل إلى أيّ خدمةٍ خارجية — يُرسَم صورةً محليّاً. ويُمحى فور نجاح
       الاتصال (setStatus('connected', { qr: null })). */
    transportEvents?.on?.('qr', (code) => db.setState({ status: 'pairing', qr: code || null, pairing_code: null }))
    transportEvents?.on?.('pairing-code', (code) => db.setState({ status: 'pairing', qr: null, pairing_code: code || null }))
    await state.transport.connect({ phoneNumber })
    state.started = true
    if (process.env.WHATSAPP_AGENT_BRIDGE === 'true' && !state.bridge) state.bridge = startLocalBridge(api)
    heartbeat()
    /* مؤقتات التشغيل الدائم لا تُشغَّل في الاختبار الوهمي. كانت لقطة قاعدة
       البيانات المؤجلة تستيقظ بعد انتهاء self-test وإغلاق SQLite، فيرمي Node
       ERR_INVALID_STATE من callback السطر نفسه ويُسقط GitHub Actions. */
    if (!mock) {
      state.timers.add(setInterval(heartbeat, HEARTBEAT_INTERVAL_MS))
      /* الإنعاش الذاتي: يُقلع البوت نفسه إن تعثّر، فلا ينتظر الدكتور مستيقظاً.
         ولا يُقلع إن كان يطلب QR — إعادةٌ بلا فائدة، والحلّ إنسانٌ يمسح الرمز. */
      state.watchdogSince = Date.now()
      state.timers.add(setInterval(() => selfHeal(), 60_000))
      if (flags.reminders) state.timers.add(setInterval(() => void dispatchDueReminders(state), 30000))
      /* تقرير الجمعة (أمر الدكتور ٢٠٢٦-٠٧-٢٣): سير عمل أسبوعي يؤلف أرقام الأسبوع
         وينشرها JSON في R2 — والبوت يلتقطها هنا ويسلمها للدكتور في محادثته
         الذاتية مرة واحدة لكل تقرير (منع التكرار بمعرّف التقرير في الإعدادات). */
      state.timers.add(setInterval(() => void deliverWeeklyReport(), 3 * 60 * 60 * 1000))
      state.timers.add(setTimeout(() => void deliverWeeklyReport(), 90_000))
      /* لقطة قاعدة البيانات: فحص يومي، تنفيذ أسبوعي */
      state.timers.add(setInterval(() => void maybeSnapshotDatabase(), 24 * 60 * 60 * 1000))
      state.timers.add(setTimeout(() => void maybeSnapshotDatabase(), 150_000))
      /* قوالب رسائل البوت (أمر الدكتور): تُجلب من Firestore أول الإقلاع ثم كل ٥
         دقائق، مع بدائلَ مضمّنةٍ تحمي من أي انقطاع. لا تُجلب في الاختبار الوهمي. */
      void refreshBotMessages({ force: true })
      state.timers.add(setInterval(() => void refreshBotMessages(), 5 * 60 * 1000))
    }
    return db.state()
  }

  /* درع بيانات البوت (أمر الدكتور ٢٠٢٦-٠٧-٢٣): لقطة أسبوعية ذاتية لقاعدة sqlite
     عبر VACUUM INTO (نسخة متسقة حتى أثناء العمل)، والاحتفاظ بآخر ٨ لقطات —
     فمحفوظاته وقواعده وتعلم البوت لا تضيع مهما جرى للملف الحي. */
  async function maybeSnapshotDatabase() {
    try {
      if (!state.started || state.stopping) return
      const last = db.getSetting('db-snapshot-last')
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait' }).format(new Date())
      if (last && (Date.now() - new Date(String(last)).getTime()) < 6.5 * 86_400_000) return
      const { mkdirSync, readdirSync, unlinkSync } = await import('node:fs')
      const { join, dirname } = await import('node:path')
      const { DB_PATH } = await import('./config.mjs')
      const backupDir = join(dirname(DB_PATH), 'backups')
      mkdirSync(backupDir, { recursive: true })
      const target = join(backupDir, `agent-${today}.sqlite`)
      db.run(`VACUUM INTO '${target.replace(/'/g, "''")}'`)
      const snapshots = readdirSync(backupDir).filter((name) => /^agent-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name)).sort()
      for (const name of snapshots.slice(0, Math.max(0, snapshots.length - 8))) unlinkSync(join(backupDir, name))
      db.setSetting('db-snapshot-last', today)
      db.addAudit('db-snapshot', '', target)
    } catch (error) {
      /* قد يبدأ الإيقاف بينما اللقطة داخل await/import. لا نحاول الكتابة في
         قاعدة أُغلقت؛ فالـ catch القديم كان يعيد الخطأ نفسه من db.addAudit. */
      if (!state.stopping) {
        try { db.addAudit('db-snapshot-failed', '', redactError(error)) } catch { /* قاعدة مغلقة */ }
      }
    }
  }

  const REPORT_FEED_BASE = process.env.REPORT_FEED_BASE
    || 'https://pub-e2ce7a54469544ecab38d55cd80787aa.r2.dev/reports'

  /* قناة تقارير موحدة: الجمعة الأسبوعية + بريد المساء اليومي — كل تقرير
     يُسلَّم مرة واحدة بمعرّفه، والفارغ (count=0) لا يُرسل أصلاً */
  async function deliverReportFeed(fileName, settingKey) {
    try {
      if (!state.started || !state.transport) return
      const response = await fetch(`${REPORT_FEED_BASE}/${fileName}`, { cache: 'no-store' })
      if (!response.ok) return
      const report = await response.json()
      if (!report || typeof report.id !== 'string' || typeof report.text !== 'string' || !report.text.trim()) return
      if (report.empty === true) return
      if (db.getSetting(settingKey) === report.id) return
      await sendSelf(report.text.trim())
      db.setSetting(settingKey, report.id)
      db.addAudit('report-feed-delivered', '', `${settingKey}:${report.id}`)
    } catch { /* الشبكة غابت أو التقرير لم يُنشر بعد — تُعاد المحاولة في الدورة التالية */ }
  }

  async function deliverWeeklyReport() {
    await deliverReportFeed('weekly-latest.json', 'weekly-report-last')
    await deliverReportFeed('daily-inbox-latest.json', 'daily-inbox-last')
  }

  /* عتبات الإنعاش — بأرقام الدكتور */
  const READY_GRACE_MS = 5 * 60 * 1000    // خمس دقائق لتكتمل الجاهزية
  const POLL_FAIL_LIMIT = 20              // عشرون إخفاقاً متتالياً في الطابور

  /**
   * حارسٌ يمرّ كل دقيقة. لا يُصلح منطقاً — يُعيد التشغيل حين يثبت العطب، ويصمت
   * حين لا يُجدي. وكل قرارٍ يُسجَّل في سجلّ التدقيق كي يُراجَع لا كي يُخمَّن.
   */
  function selfHeal() {
    try {
      const health = healthState()

      if (health.needsAuthScan) {
        /* لا تُعد التشغيل: الجلسة انتهت، وإقلاعٌ جديد يُنتج رمزاً جديداً وحسب.
           نُنادي إنساناً — والإشعار محكومٌ بمرّةٍ كل ساعة كي لا يصير إزعاجاً. */
        const lastCall = Number(db.getSetting('bridge.qrAlertAt', 0) || 0)
        if (Date.now() - lastCall > 60 * 60 * 1000) {
          db.setSetting('bridge.qrAlertAt', Date.now())
          db.addAudit('health-needs-qr', '', 'البوت يطلب ربطاً بـ QR — إعادة التشغيل لا تنفع')
          console.error('⚠ البوت يحتاج مسح رمز QR من اللوحة. لن يردّ حتى تُعيد ربطه.')
        }
        return
      }

      if (!health.ready && Date.now() - (state.watchdogSince || 0) > READY_GRACE_MS) {
        db.addAudit('health-restart', '', 'لم تكتمل الجاهزية خلال خمس دقائق')
        console.error('⚠ لم تكتمل الجاهزية خلال خمس دقائق — أُعيد التشغيل.')
        void stop().finally(() => process.exit(0))   // launchd يُقلعه من جديد
        return
      }

      if (health.pollFailures >= POLL_FAIL_LIMIT) {
        db.setSetting('bridge.pollFailures', 0)
        db.addAudit('health-restart', '', `الطابور متعثّر: ${health.pollFailures} إخفاقاً متتالياً`)
        console.error('⚠ الطابور متعثّر — أُعيد التشغيل.')
        void stop().finally(() => process.exit(0))
        return
      }

      if (health.ready) state.watchdogSince = Date.now()   // صحيحٌ الآن: تُصفَّر المهلة
    } catch (error) {
      db.addAudit('health-check-failed', '', redactError(error))
    }
  }
  const stop = async () => {
    /* أغلق بوابة المهام أولاً، قبل أي await، حتى لا تدخل callback قديمة إلى
       SQLite في اللحظة التي يغلق فيها الاختبار أو الخدمة قاعدة البيانات. */
    state.stopping = true
    state.started = false
    for (const timer of state.timers) {
      clearTimeout(timer)
      clearInterval(timer)
    }
    state.timers.clear()
    await state.transport?.disconnect?.()
    await new Promise((resolve) => state.bridge ? state.bridge.close(resolve) : resolve())
    state.bridge = null
  }
  const sendSelf = async (text) => {
    if (!flags.send) throw new Error('الإرسال معطل افتراضيًا. فعّل WHATSAPP_SEND_ENABLED بعد اختبار Mock واعتمادك الصريح.')
    if (!state.transport) throw new Error('الوكيل غير مشغّل')
    const clean = safeText(text); if (!clean) throw new Error('النص فارغ')
    const result = state.transport.sendSelf ? await state.transport.sendSelf(clean) : await state.transport.sendText('self@s.whatsapp.net', clean)
    db.addAudit('send-self', 'self', `chars=${clean.length}`)
    return result
  }
  const queueCampaign = ({ name, message, targets = [], scheduledAt = null }) => {
    if (!name || !message) throw new Error('اسم الحملة ورسالتها مطلوبان')
    if (Number.isFinite(MAX_CAMPAIGN_TARGETS) && targets.length > MAX_CAMPAIGN_TARGETS) throw new Error(`الحد المضبوط للحملة ${MAX_CAMPAIGN_TARGETS} جهة.`)
    for (const target of targets) if (typeof target === 'string' && !target.includes('@') && target !== 'self') throw new Error('لا تحفظ رقمًا خامًا؛ استخدم الذات أو جهة معروفة بصيغة jid محليًا.')
    const id = randomToken(10); const now = new Date().toISOString()
    db.run('INSERT INTO campaigns(id,name,state,message,created_at,scheduled_at,updated_at) VALUES(?,?,?,?,?,?,?)', id, name, 'draft', safeText(message), now, scheduledAt, now)
    for (const target of targets) {
      const jid = target?.jid || (typeof target === 'string' && target.includes('@') ? target : null)
      if (jid && !isPrivateChat(jid)) throw new Error('الإرسال إلى القروبات والحالات والقنوات غير مسموح. الحملات لجهات فردية فقط.')
      const targetId = String(target?.id || (jid ? db.jidKey(jid) : target))
      if (db.get('SELECT 1 AS hit FROM privacy_tombstones WHERE jid=?', targetId)) throw new Error('إحدى الجهات طلبت حذف بياناتها؛ لا يمكن إضافتها إلى حملة.')
      const targetKind = target?.kind === 'self' ? 'self' : (jid ? 'contact' : 'self')
      if (jid) {
        const created = now
        db.run('INSERT INTO contacts(id,jid,display_name,phone,suppressed,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at', targetId, db.encryptJid(jid), target?.displayName ? db.encryptText(target.displayName) : null, target?.phone ? db.encryptText(target.phone) : null, target?.suppressed ? 1 : 0, created, created)
      }
      db.run('INSERT OR IGNORE INTO campaign_targets(campaign_id,target_id,kind,suppressed) VALUES(?,?,?,?)', id, targetId, targetKind, target.suppressed ? 1 : 0)
    }
    db.addAudit('campaign-draft', id, `targets=${targets.length}`)
    return id
  }
  const approveCampaign = (id, { confirm = false } = {}) => {
    if (!confirm) throw new Error('يلزم تأكيد صريح لاعتماد الإرسال')
    const campaign = db.get('SELECT * FROM campaigns WHERE id=?', id); if (!campaign) throw new Error('الحملة غير موجودة')
    db.run('UPDATE campaigns SET state=?,approved_at=?,updated_at=? WHERE id=?', 'approved', new Date().toISOString(), new Date().toISOString(), id); db.addAudit('campaign-approved', id); return id
  }
  const stopCampaign = (id) => {
    const campaign = db.get('SELECT * FROM campaigns WHERE id=?', id); if (!campaign) throw new Error('الحملة غير موجودة')
    db.run("UPDATE campaigns SET state='stopped',updated_at=? WHERE id=? AND state IN ('draft','approved','queued','sending')", new Date().toISOString(), id)
    db.addAudit('campaign-stopped', id)
    return id
  }
  const listCampaigns = () => db.all(`SELECT c.id,c.name,c.state,c.created_at,c.approved_at,c.scheduled_at,c.updated_at,
    (SELECT COUNT(*) FROM campaign_targets ct WHERE ct.campaign_id=c.id) AS target_count
    FROM campaigns c ORDER BY c.created_at DESC LIMIT 50`)
  const listBroadcastGroups = () => db.all('SELECT id,name,jid,member_count,members_readable,discovered_at FROM broadcast_lists ORDER BY name COLLATE NOCASE').map((row) => ({
    id: row.id,
    name: row.name || 'مجموعة واتساب',
    jid: decryptJidSafe(row.jid),
    memberCount: Number(row.member_count || 0),
    membersReadable: Boolean(row.members_readable),
    discoveredAt: row.discovered_at,
  }))
  /* سحب القروبات ملغى بأمر الدكتور: القروب يكشف أرقام الناس بعضهم لبعض،
     وردٌّ واحد فيه يزعج مئتين. والقوائم يبنيها هو بنفسه من دفتر الأسماء.
     أُبقيت الدالة لئلا ينكسر نداءٌ قديم، وصارت لا تفعل شيئاً. */
  const discoverGroups = async () => ({ groups: [], refreshed: false, reason: 'group-discovery-disabled' })
  const manualTakeover = (jid, minutes = MANUAL_TAKEOVER_MINUTES) => {
    markManualTakeover(db, jid, minutes)
    db.addAudit('manual-takeover', db.jidKey(jid), `minutes=${minutes}`)
    return { jid: db.jidKey(jid), manualUntil: db.get('SELECT manual_until FROM chat_sessions WHERE jid=?', db.jidKey(jid))?.manual_until || null }
  }
  /**
   * كم محادثةً يصمت فيها البوت الآن، ومتى ينتهي أطولها؟
   * الدكتور لا يعرف أرقام JID ولا يريدها — يريد أن يعرف: أصامتٌ هو أم لا.
   */
  const silenceState = () => {
    const now = new Date().toISOString()
    const rows = db.all('SELECT manual_until FROM chat_sessions WHERE manual_until > ?', now)
    const until = rows.map((r) => r.manual_until).sort().pop() || null
    return { silenced: rows.length, until }
  }

  /**
   * إعادةٌ شاملة: يُنهي صمت كل المحادثات دفعةً واحدة.
   *
   * كان الإرجاع يحتاج jid بعينه، والدكتور لا يعرفه ولا ينبغي أن يعرفه. وحين
   * يصمت البوت بلا سببٍ ظاهر — كما وقع اليوم بسبب صدى ردّه — يحتاج زراً واحداً
   * يُعيده حالاً، لا بحثاً عن رقمٍ في قاعدة بيانات.
   */
  /**
   * إعادة ربطٍ من اللوحة: تمسح الجلسة وتُقلع فيظهر QR جديد.
   *
   * كان هذا يحتاج طرفيّةً وأوامر SQL — والدكتور لا يفتحهما. وحين تنتهي الجلسة
   * (كما وقع) يبقى البوت صامتاً حتى يتدخّل غيره. زرٌّ واحد يكفي.
   * ولا تُمسّ الجهات ولا القوائم: جداولها منفصلة عن whatsapp_auth.
   */
  const repair = async () => {
    const before = db.get('SELECT COUNT(*) AS c FROM whatsapp_auth')?.c || 0
    db.deleteAuth()
    db.setState({ status: 'pairing', qr: null, pairing_code: null })
    db.addAudit('bridge-repair', '', `مُسحت الجلسة (${before} مفتاحاً) — يُنتظر مسح QR`)
    setTimeout(async () => { try { await stop() } finally { process.exit(0) } }, 350)
    return { cleared: before, message: 'مُسحت الجلسة. سيظهر رمز QR خلال نصف دقيقة — امسحه بجوالك.' }
  }

  const returnAllToBot = () => {
    const before = silenceState()
    const now = new Date().toISOString()
    db.run("UPDATE chat_sessions SET mode='suggest-only', manual_until=NULL, content_id=NULL, followup_json=NULL, context_json=NULL, opened_at=NULL, last_user_at=NULL, updated_at=? WHERE manual_until IS NOT NULL", now)
    db.addAudit('bot-wake-enabled-all', '', `أصبح الإيقاظ متاحاً في ${before.silenced} محادثة`)
    return { returned: before.silenced }
  }

  const returnToBot = (jid) => {
    const now = new Date().toISOString()
    db.run("UPDATE chat_sessions SET mode='suggest-only', manual_until=NULL, content_id=NULL, followup_json=NULL, context_json=NULL, opened_at=NULL, last_user_at=NULL, updated_at=? WHERE jid=?", now, db.jidKey(jid))
    db.addAudit('bot-wake-enabled', db.jidKey(jid))
    return { jid: db.jidKey(jid), returned: true }
  }
  const listReplyRules = () => db.all('SELECT * FROM reply_rules ORDER BY enabled DESC, priority DESC, updated_at DESC').map((row) => ({
    id: row.id,
    name: row.name,
    keywords: JSON.parse(row.keywords_json || '[]'),
    priority: Number(row.priority || 0),
    matchType: row.match_type,
    actionType: row.action_type,
    responseText: row.response_text || '',
    contentQuery: row.content_query || '',
    enabled: Boolean(row.enabled),
    updatedAt: row.updated_at,
  }))
  const saveReplyRule = (payload = {}) => {
    const now = new Date().toISOString()
    const id = String(payload.id || randomToken(8))
    const previous = db.get('SELECT * FROM reply_rules WHERE id=?', id)
    if (previous) db.run('INSERT INTO reply_rule_versions(rule_id,payload_json,created_at) VALUES(?,?,?)', id, JSON.stringify(previous), now)
    const keywords = Array.isArray(payload.keywords)
      ? payload.keywords.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 25)
      : String(payload.keywords || '').split(/[,،\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 25)
    if (!String(payload.name || '').trim()) throw new Error('اسم القاعدة مطلوب.')
    if (!keywords.length) throw new Error('أضف كلمة مفتاحية واحدة على الأقل.')
    const matchType = ['any', 'all', 'exact'].includes(payload.matchType) ? payload.matchType : 'any'
    const actionType = payload.actionType === 'site-content' ? 'site-content' : 'transfer'
    db.run(
      `INSERT INTO reply_rules(id,name,keywords_json,priority,match_type,action_type,response_text,content_query,enabled,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name,keywords_json=excluded.keywords_json,priority=excluded.priority,match_type=excluded.match_type,action_type=excluded.action_type,response_text=excluded.response_text,content_query=excluded.content_query,enabled=excluded.enabled,updated_at=excluded.updated_at`,
      id,
      String(payload.name).trim(),
      JSON.stringify(keywords),
      Number(payload.priority || 0),
      matchType,
      actionType,
      safeText(payload.responseText || ''),
      safeText(payload.contentQuery || ''),
      payload.enabled === false ? 0 : 1,
      previous?.created_at || now,
      now,
    )
    db.addAudit(previous ? 'reply-rule-updated' : 'reply-rule-created', id)
    return listReplyRules().find((rule) => rule.id === id)
  }
  const deleteReplyRule = (id) => {
    const row = db.get('SELECT * FROM reply_rules WHERE id=?', id)
    if (!row) throw new Error('القاعدة غير موجودة.')
    db.run('INSERT INTO reply_rule_versions(rule_id,payload_json,created_at) VALUES(?,?,?)', id, JSON.stringify(row), new Date().toISOString())
    db.run('DELETE FROM reply_rules WHERE id=?', id)
    db.addAudit('reply-rule-deleted', id)
    return { id, deleted: true }
  }
  const replyRuleVersions = (id) => db.all('SELECT id,rule_id,payload_json,created_at FROM reply_rule_versions WHERE rule_id=? ORDER BY id DESC LIMIT 20', id).map((row) => ({
    id: row.id,
    ruleId: row.rule_id,
    payload: JSON.parse(row.payload_json),
    createdAt: row.created_at,
  }))
  const rollbackReplyRule = (id, versionId) => {
    const version = db.get('SELECT * FROM reply_rule_versions WHERE rule_id=? AND id=?', id, Number(versionId))
    if (!version) throw new Error('النسخة غير موجودة.')
    const payload = JSON.parse(version.payload_json)
    return saveReplyRule({
      id,
      name: payload.name,
      keywords: JSON.parse(payload.keywords_json || '[]'),
      priority: payload.priority,
      matchType: payload.match_type,
      actionType: payload.action_type,
      responseText: payload.response_text,
      contentQuery: payload.content_query,
      enabled: Boolean(payload.enabled),
    })
  }
  /* المحاكاة كانت تعرض ما سيقوله البوت وتتجاهل السؤال الأهم: هل يتكلم أصلاً؟
     فأوهمت أن «دكتور» تجلب ثلاث مقالات، بينما البوابة تُسكته عليها. الآن
     تُستشار البوابة أولاً، ولا يُعرض نصُّ ردٍّ لن يخرج أبداً. */
  const REASONS = {
    'personal-chat-default': 'كلامٌ عابر — لا يفتح الباب',
    'private-safe-mode': 'كلامٌ عابر — لا يفتح الباب',
    'command-opens-door': 'أمرٌ معروف يفتح الباب',
    'content-session': 'داخل جلسةٍ مفتوحة',
    'content-session-grounded-search': 'بحثٌ داخل الموقع ضمن جلسةٍ مفتوحة',
    'privacy-command': 'أمر خصوصية — يُطاع دائماً',
    'allowlisted-contact': 'رقمٌ في قائمتك البيضاء',
    'assistant-trigger': 'نداءٌ صريح للمساعد',
    'suppressed': 'طلب إيقاف الرسائل',
    'manual-takeover': 'أنت تتحدث معه الآن',
  }
  let simulationSerial = 0
  const simulateReply = ({ text, jid = 'simulator@s.whatsapp.net', inSession = false, hasMedia = false, at = new Date() } = {}) => {
    const clean = safeText(text)
    /* التشغيل متاح طوال اليوم؛ المحاكي يختبر البوابة نفسها بلا نافذة زمنية. */
    const evaluationAt = at instanceof Date ? at : new Date(at)
    const gate = shouldRespondToMessage({ db, jid, text: clean, explicitContentSession: Boolean(inSession), hasMedia, at: evaluationAt })
    const classification = classifyIntentWithLearning(db, clean)
    /* المعاينة الإدارية تحتاج أن تُظهر قاعدة التحويل المطابقة حتى عندما تمنع
       بوابة الإيقاظ الإرسال فعلياً. نقرأ القاعدة بلا تنفيذ ولا فتح جلسة، ثم
       نبقي النتيجة صامتة: هذا يشرح للدكتور ما سيحدث ولا يخرق شرط الإيقاظ. */
    const configuredRule = matchReplyRule(db, clean)
    /* رفضُ البوابة قرارٌ نهائي: لا نُشغّل محرك النية خلفها، لأن المحرك
       يسجّل النوايا وقد يعدّل الجلسة أو الخصوصية. التصنيف وحده قراءةٌ بلا أثر. */
    if (!gate.allowed) {
      return {
        willReply: false,
        why: REASONS[gate.reason] || gate.reason,
        quietNow: false,
        intent: configuredRule ? 'CUSTOM_RULE' : classification.intent,
        confidence: configuredRule ? 0.99 : classification.confidence,
        needsHuman: Boolean(configuredRule || classification.needsHuman),
        ruleId: configuredRule?.id || null,
        ruleName: configuredRule?.name || null,
        preview: '',
      }
    }

    /* المعاينة يجب أن تمرّ بالمحرك الحقيقي، لكن داخل SAVEPOINT يُمحى
       بعده كلُّ ما كتبه: سجلّ النية، الكتم، الحفظ، التذكير، أو غيرها. ونحرّر
       النقطة حتى إن رمى المحرك خطأً، لئلا تبقى الوصلة داخل معاملةٍ معلّقة. */
    const savepoint = `simulate_reply_${++simulationSerial}`
    const sqlite = db.db
    /* بعض الأوامر (حذف التفضيلات مثلاً) تستخدم db.transaction داخلياً. وBEGIN
       داخل SAVEPOINT غير جائز في SQLite؛ في المعاينة تكفي نقطة الحفظ الخارجية
       نفسها. نمرّر واجهةً تقرأ القاعدة الأصلية، لكن تجعل المعاملة الداخلية
       دالةً عادية، من غير تبديل db المشترك أو ترك حالةٍ مؤقتة عليه. */
    const previewDb = new Proxy(db, {
      get(target, property) {
        if (property === 'transaction') return (fn) => fn()
        const value = Reflect.get(target, property, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    sqlite.exec(`SAVEPOINT ${savepoint}`)
    const rollbackAndRelease = () => {
      const cleanupErrors = []
      try { sqlite.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`) } catch (error) { cleanupErrors.push(error) }
      try { sqlite.exec(`RELEASE SAVEPOINT ${savepoint}`) } catch (error) { cleanupErrors.push(error) }
      if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'تعذّر إغلاق معاملة معاينة الرد.')
    }
    let response
    try {
      response = handleIntent({ db: previewDb, jid, input: clean, session: null, classification })
    } catch (error) {
      try { rollbackAndRelease() } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'فشلت معاينة الرد وتنظيف معاملتها.')
      }
      throw error
    }
    rollbackAndRelease()
    return {
      willReply: true,
      why: REASONS[gate.reason] || gate.reason,
      quietNow: false,
      intent: response.intent,
      confidence: response.confidence,
      needsHuman: Boolean(response.needsHuman),
      ruleId: response.ruleId || null,
      ruleName: response.ruleName || null,
      preview: response.text || '',
    }
  }
  const learningState = ({ limit = 40 } = {}) => {
    const rows = db.all(`SELECT * FROM learning_patterns ORDER BY
      CASE status WHEN 'learned' THEN 0 WHEN 'observing' THEN 1 ELSE 2 END,
      confirmations DESC,hits DESC,last_seen_at DESC LIMIT ?`, Math.max(1, Math.min(200, Number(limit || 40))))
    const items = rows.map((row) => {
      let phrase = ''
      try { phrase = db.decryptText(row.phrase) } catch { phrase = '' }
      const evidence = db.get(`SELECT COUNT(*) AS confirmations,COUNT(DISTINCT jid_hash) AS sources,
        COUNT(DISTINCT day_key) AS days FROM learning_evidence
        WHERE pattern_hash=? AND (?='' OR intent=?)`, row.pattern_hash, row.candidate_intent || '', row.candidate_intent || '') || {}
      return {
        id: row.id, phrase, hits: Number(row.hits || 0), intent: row.candidate_intent || '',
        confirmations: Number(evidence.confirmations || row.confirmations || 0),
        evidenceSources: Number(evidence.sources || 0), evidenceDays: Number(evidence.days || 0),
        status: row.status || 'observing',
        firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at, learnedAt: row.learned_at || null,
      }
    })
    const counts = db.get(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN status='learned' THEN 1 ELSE 0 END) AS learned,
      SUM(CASE WHEN status='observing' THEN 1 ELSE 0 END) AS observing,
      SUM(CASE WHEN status='ignored' THEN 1 ELSE 0 END) AS ignored
      FROM learning_patterns`) || {}
    return {
      total: Number(counts.total || 0), learned: Number(counts.learned || 0),
      observing: Number(counts.observing || 0), ignored: Number(counts.ignored || 0), items,
      policy: 'يتعلم النية فقط بعد ثلاث قرائن عالية الثقة؛ من مصدرين مستقلين أو عبر ثلاثة أيام. الجواب يبقى من فهرس الموقع ولا يتعلم معلومة من المستخدم.',
    }
  }
  const setLearningPatternStatus = (id, status) => {
    const allowed = new Set(['observing', 'ignored'])
    if (!allowed.has(status)) throw new Error('learning-status-not-allowed')
    const row = db.get('SELECT * FROM learning_patterns WHERE id=?', Number(id))
    if (!row) throw new Error('learning-pattern-not-found')
    db.transaction(() => {
      if (status === 'ignored') {
        db.run("UPDATE learning_patterns SET status='ignored',candidate_intent=NULL,confirmations=0,learned_at=NULL WHERE id=?", Number(id))
        db.run('DELETE FROM learning_votes WHERE pattern_hash=?', row.pattern_hash)
        db.run('DELETE FROM learning_evidence WHERE pattern_hash=?', row.pattern_hash)
        db.run('DELETE FROM learning_pending WHERE pattern_hash=?', row.pattern_hash)
      } else {
        db.run("UPDATE learning_patterns SET status='observing',candidate_intent=NULL,confirmations=0,learned_at=NULL WHERE id=?", Number(id))
        db.run('DELETE FROM learning_votes WHERE pattern_hash=?', row.pattern_hash)
        db.run('DELETE FROM learning_evidence WHERE pattern_hash=?', row.pattern_hash)
        db.run('DELETE FROM learning_pending WHERE pattern_hash=?', row.pattern_hash)
      }
    })
    db.addAudit('learning-pattern-status', String(id), status)
    return learningState({ limit: 80 })
  }

  const requestRestart = () => {
    const requestedAt = new Date().toISOString()
    db.setSetting('bridge.restartRequestedAt', requestedAt)
    db.setState({ status: 'restarting', last_error: null })
    db.addAudit('bridge-restart-requested', 'local')
    return { restartRequestedAt: requestedAt }
  }
  const sendCampaign = async (id, { confirm = false, confirmAgain = false } = {}) => {
    if (!confirm || !confirmAgain) throw new Error('إرسال الحملة يحتاج تأكيدين صريحين.')
    if (!flags.send) throw new Error('الإرسال معطّل افتراضيًا. فعّل WHATSAPP_SEND_ENABLED محليًا بعد الاختبار.')
    if (!state.transport || state.transport.getConnectionStatus?.() !== 'connected') throw new Error('اربط واتساب أولًا وتأكد أن الحالة متصل.')
    const campaign = db.get('SELECT * FROM campaigns WHERE id=?', id); if (!campaign) throw new Error('الحملة غير موجودة')
    if (campaign.state !== 'approved' && campaign.state !== 'queued') throw new Error('الحملة يجب أن تكون معتمدة قبل الإرسال.')
    const targets = campaignTargets(id)
    if (!targets.length) throw new Error('لا توجد جهات معروفة في الحملة.')
    const now = new Date().toISOString(); let sent = 0; let skipped = 0; let failed = 0
    db.run("UPDATE campaigns SET state='sending',updated_at=? WHERE id=?", now, id)
    for (const target of targets) {
      const currentSuppression = db.get('SELECT suppressed FROM contacts WHERE id=?', target.target_id)
      if (target.suppressed || currentSuppression?.suppressed) { skipped++; continue }
      const jid = resolveCampaignTarget(target)
      if (!jid) { skipped++; db.addAudit('campaign-target-skipped', id, 'unknown-target'); continue }
      if (!isPrivateChat(jid)) { skipped++; db.addAudit('campaign-target-skipped', id, 'non-private-target'); continue }
      const manual = db.get('SELECT manual_until FROM chat_sessions WHERE jid=?', db.jidKey(jid))
      if (manual?.manual_until && new Date(manual.manual_until) > new Date()) {
        skipped++; db.addAudit('campaign-target-skipped', id, 'manual-takeover'); continue
      }
      const jobId = randomToken(10); const created = new Date().toISOString()
      db.run('INSERT INTO message_jobs(id,campaign_id,jid,body,state,attempts,available_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', jobId, id, db.encryptJid(jid), campaign.message, 'sending', 1, created, created, created)
      try {
        await state.transport.sendText(jid, campaign.message)
        db.run('UPDATE message_jobs SET state=?,updated_at=? WHERE id=?', 'sent', new Date().toISOString(), jobId)
        db.run('INSERT INTO message_attempts(job_id,state,error,attempted_at) VALUES(?,?,?,?)', jobId, 'sent', null, new Date().toISOString()); sent++
      } catch (error) {
        db.run('UPDATE message_jobs SET state=?,updated_at=? WHERE id=?', 'failed', new Date().toISOString(), jobId)
        db.run('INSERT INTO message_attempts(job_id,state,error,attempted_at) VALUES(?,?,?,?)', jobId, 'failed', redactError(error), new Date().toISOString()); failed++; db.addAudit('campaign-send-failed', id, redactError(error))
      }
      const current = db.get("SELECT state FROM campaigns WHERE id=?", id); if (current?.state === 'stopped') break
    }
    const stateName = failed || skipped ? (sent ? 'partial' : 'stopped') : 'completed'
    db.run('UPDATE campaigns SET state=?,updated_at=? WHERE id=?', stateName, new Date().toISOString(), id)
    db.addAudit('campaign-sent', id, `sent=${sent};skipped=${skipped};failed=${failed}`)
    return { id, state: stateName, sent, skipped, failed }
  }
  const runQuietCampaign = async (id, { intervalSeconds }) => {
    const intervalMs = campaignInterval(intervalSeconds) * 1000
    const campaign = db.get('SELECT * FROM campaigns WHERE id=?', id)
    if (!campaign) throw new Error('الحملة غير موجودة')
    const targets = campaignTargets(id)
    let sent = 0; let skipped = 0; let failed = 0
    db.run("UPDATE campaigns SET state='sending',updated_at=? WHERE id=?", new Date().toISOString(), id)
    try {
      for (const [index, target] of targets.entries()) {
        const current = db.get('SELECT state FROM campaigns WHERE id=?', id)
        if (current?.state === 'stopped') { db.addAudit('quiet-broadcast-stopped', id, `sent=${sent}`); break }
        const currentSuppression = db.get('SELECT suppressed FROM contacts WHERE id=?', target.target_id)
        if (target.suppressed || currentSuppression?.suppressed) { skipped++; continue }
        const jid = resolveCampaignTarget(target)
        if (!jid) { skipped++; db.addAudit('quiet-broadcast-target-skipped', id, 'unknown-target'); continue }
        if (!isPrivateChat(jid)) { skipped++; db.addAudit('quiet-broadcast-target-skipped', id, 'non-private-target'); continue }
        const manual = db.get('SELECT manual_until FROM chat_sessions WHERE jid=?', db.jidKey(jid))
        if (manual?.manual_until && new Date(manual.manual_until) > new Date()) {
          skipped++; db.addAudit('quiet-broadcast-target-skipped', id, 'manual-takeover'); continue
        }
        const jobId = randomToken(10)
        const created = new Date().toISOString()
        /* لكلٍّ نصّه: {الاسم} يصير لقبه الذي كتبتَه، و{تحية} تتبع ساعة الإرسال.
           فلا تخرج رسالةٌ واحدة جامدة، بل رسالةٌ لكل إنسانٍ باسمه. */
        const contact = db.get('SELECT * FROM contacts WHERE id=?', target.target_id)
        /* نمرر جهة الاتصال كاملة لا الكنية وحدها: كاشفا الجنس والجهة يقرآن
           الاسم نفسه ليصرّفا {الأخ} و{عزيزي} و{ترحيب} صرفاً صحيحاً. */
        const body = personalize(campaign.message, contact ? { ...contact, vocative: vocativeOf(contact) } : {})
        db.run('INSERT INTO message_jobs(id,campaign_id,jid,body,state,attempts,available_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', jobId, id, db.encryptJid(jid), db.encryptText(body), 'sending', 1, created, created, created)
        try {
          await state.transport.sendText(jid, body)
          db.run('UPDATE message_jobs SET state=?,updated_at=? WHERE id=?', 'sent', new Date().toISOString(), jobId)
          db.run('INSERT INTO message_attempts(job_id,state,error,attempted_at) VALUES(?,?,?,?)', jobId, 'sent', null, new Date().toISOString())
          sent++
        } catch (error) {
          db.run('UPDATE message_jobs SET state=?,updated_at=? WHERE id=?', 'failed', new Date().toISOString(), jobId)
          db.run('INSERT INTO message_attempts(job_id,state,error,attempted_at) VALUES(?,?,?,?)', jobId, 'failed', redactError(error), new Date().toISOString())
          failed++
          db.addAudit('quiet-broadcast-send-failed', id, redactError(error))
        }
        if (index < targets.length - 1) await sleep(intervalMs)
      }
      const current = db.get('SELECT state FROM campaigns WHERE id=?', id)
      const stateName = current?.state === 'stopped' ? 'stopped' : (failed || skipped ? (sent ? 'partial' : 'stopped') : 'completed')
      db.run('UPDATE campaigns SET state=?,updated_at=? WHERE id=?', stateName, new Date().toISOString(), id)
      db.addAudit('quiet-broadcast-finished', id, `sent=${sent};skipped=${skipped};failed=${failed};interval=${intervalMs}`)
    } finally {
      state.activeCampaigns.delete(id)
    }
  }
  const sendQuietCampaign = (id, { confirm = false, confirmAgain = false, intervalSeconds = BROADCAST_DEFAULT_INTERVAL_SECONDS } = {}) => {
    if (!confirm || !confirmAgain) throw new Error('الإرسال الهادئ يحتاج تأكيدين صريحين.')
    if (!flags.send) throw new Error('الإرسال معطّل افتراضيًا. فعّل WHATSAPP_SEND_ENABLED محليًا بعد الاختبار.')
    if (!state.transport || state.transport.getConnectionStatus?.() !== 'connected') throw new Error('اربط واتساب أولًا وتأكد أن الحالة متصل.')
    const campaign = db.get('SELECT * FROM campaigns WHERE id=?', id); if (!campaign) throw new Error('الحملة غير موجودة')
    if (!['approved', 'queued'].includes(campaign.state)) throw new Error('الحملة يجب أن تكون معتمدة قبل الإرسال.')
    const targets = campaignTargets(id)
    if (!targets.length) throw new Error('لا توجد جهات فردية في الحملة.')
    if (state.activeCampaigns.has(id)) return { id, state: 'sending', alreadyRunning: true }
    state.activeCampaigns.add(id)
    db.run("UPDATE campaigns SET state='queued',updated_at=? WHERE id=?", new Date().toISOString(), id)
    void runQuietCampaign(id, { intervalSeconds }).catch((error) => {
      state.activeCampaigns.delete(id)
      db.run("UPDATE campaigns SET state='stopped',updated_at=? WHERE id=?", new Date().toISOString(), id)
      db.addAudit('quiet-broadcast-crashed', id, redactError(error))
    })
    return { id, state: 'queued', intervalSeconds: campaignInterval(intervalSeconds), targets: targets.length }
  }
  const createLocalReminder = ({ jid, contentId = null, originalText, dueAt }) => createReminder(db, { jid, contentId, originalText, dueAt })
  const status = async () => {
    const heartbeatState = db.getSetting('bridge.heartbeat', null)
    const lastHeartbeatAt = heartbeatState?.at || null
    const heartbeatAgeMs = lastHeartbeatAt ? Date.now() - new Date(lastHeartbeatAt).getTime() : null
    const bridgeOnline = Boolean(state.started && lastHeartbeatAt && heartbeatAgeMs != null && heartbeatAgeMs <= HEARTBEAT_STALE_MS)
    /* نرسم رمز الاقتران صورةً هنا على ماك الدكتور. ولا نُرسل نصّه إلى أي خدمة
       خارجية لرسمه: النصّ اعتمادُ اقترانٍ حيّ، ومن ملكه ربط جهازه بحساب الدكتور
       وقرأ رسائله. فالرسم محليٌّ أو لا يكون. */
    const snapshot = db.state()
    let qrImage = null
    if (snapshot?.qr && snapshot.status !== 'connected') {
      try {
        const qrcode = (await import('qrcode')).default || (await import('qrcode'))
        qrImage = await qrcode.toDataURL(String(snapshot.qr), { margin: 1, width: 320, errorCorrectionLevel: 'M' })
      } catch { qrImage = null }
    }
    return { ...db.state(), qrImage, flags, runtimePaused: Boolean(db.getSetting('agent.runtimePaused', false)), indexed: Number(db.get('SELECT COUNT(*) AS count FROM content_items')?.count || 0), bridge: Boolean(state.bridge), bridgeOnline, lastHeartbeatAt, heartbeatAgeMs, restartRequestedAt: db.getSetting('bridge.restartRequestedAt', null), port: BRIDGE_PORT, timeZone: TIME_ZONE, health: healthState() }
  }

  /**
   * الصحّة الصادقة — لا «متصل ✅» وحدها.
   *
   * العلّة الجذرية التي وصفها الدكتور: اللوحة تفحص «هل العملية حيّة» فتقول
   * «متصل»، والبوت لا يُرسل شيئاً. فيظلّ يجرّب ويحتار ولا يعرف السبب — وقد وقع
   * ذلك فعلاً: كان الردّ ممنوعاً بقاعدة خفية واللوحة تقول «متصل».
   *
   * فنُبلّغ هنا بالحقيقة كاملةً: أجاهزٌ هو؟ أيطلب QR؟ أمحظورٌ بقاعدة؟ وكم مرّة
   * تعثّر؟ ثم نُصنّف الحالة تصنيفاً يفهمه الدكتور ويُريه العلاج، لا رمزاً أخضر
   * يكذب عليه.
   */
  function healthState() {
    const snapshot = db.state()
    const needsAuthScan = Boolean(snapshot?.qr) && snapshot?.status !== 'connected'
    const connected = snapshot?.status === 'connected'
    const ready = Boolean(state.started && connected)
    const pollFailures = Number(db.getSetting('bridge.pollFailures', 0) || 0)
    const quietNow = false
    const now = new Date().toISOString()
    const silenced = db.all('SELECT manual_until FROM chat_sessions WHERE manual_until > ?', now).length

    /* الترتيب مقصود: نُظهر أقربَ سببٍ يمنع الردّ فعلاً، لا أعمَّها */
    let code = 'working'
    let label = 'يعمل ويردّ'
    let why = ''
    let fix = ''

    if (db.getSetting('agent.runtimePaused', false)) {
      code = 'runtime-paused'; label = 'الردود موقوفة بأمر الدكتور'
      why = 'مفتاح الإيقاف الفوري مفعّل؛ يستمر الربط والفهرس من دون أي رد آلي.'
      fix = 'اضغط «تشغيل الردود» من اللوحة عندما تريد إعادتها.'
    } else if (needsAuthScan) {
      code = 'needs-qr'; label = 'يحتاج ربطاً بـ QR'
      why = 'انتهت جلسة واتساب. إعادة التشغيل لا تنفع هنا.'
      fix = 'امسح رمز QR من اللوحة بجوالك.'
    } else if (!connected) {
      code = 'disconnected'; label = 'مفصول عن واتساب'
      why = 'لم يكتمل الاتصال بعد، أو انقطع.'
      fix = 'اضغط «إعادة تشغيل واتساب» وانتظر دقيقة.'
    } else if (!flags.agent) {
      code = 'agent-off'; label = 'الوكيل موقوف'
      why = 'WHATSAPP_AGENT_ENABLED مغلق.'
      fix = 'فعّله في إعدادات الخدمة على الماك.'
    } else if (!flags.send) {
      code = 'send-off'; label = 'الإرسال مغلق'
      why = 'مفتاح الإرسال غير مفعّل، فيجهّز الردّ ولا يُخرجه.'
      fix = 'فعّل WHATSAPP_SEND_ENABLED ثم أعد التشغيل.'
    } else if (!flags.autoReply) {
      code = 'autoreply-off'; label = 'الردّ الآليّ مغلق'
      why = 'يستقبل ويفهم، لكنه لا يردّ على أحد.'
      fix = 'فعّل WHATSAPP_AUTO_REPLY_ENABLED ثم أعد التشغيل.'
    } else if (pollFailures >= 20) {
      code = 'queue-stuck'; label = 'الطابور متعثّر'
      why = `فشلت قراءة الطابور ${pollFailures} مرة متتالية.`
      fix = 'اضغط «إعادة تشغيل واتساب».'
    } else if (silenced > 0) {
      code = 'manual-takeover'; label = 'صامتٌ — تدخّلٌ يدويّ'
      why = `رددتَ بيدك في ${silenced === 1 ? 'محادثة' : `${silenced} محادثات`}، فصمت البوت فيها.`
      fix = 'انتظر انتهاء المهلة ثم اطلب من المرسل كتابة جملة الإيقاظ، أو اضغط «اسمح بالإيقاظ الآن».'
    }

    return { code, label, why, fix, ready, needsAuthScan, pollFailures, quietNow, silenced, connected }
  }
  const pauseAutoReplies = () => {
    db.setSetting('agent.runtimePaused', true)
    db.addAudit('agent-runtime-paused', 'owner', 'إيقاف فوري من اللوحة')
    return { paused: true }
  }
  const resumeAutoReplies = () => {
    db.setSetting('agent.runtimePaused', false)
    db.addAudit('agent-runtime-resumed', 'owner', 'تشغيل الردود من اللوحة')
    return { paused: false }
  }
  const setBridge = (server) => { state.bridge = server; return status() }
  return Object.assign(api, { db, state, index, start, stop, status, sendSelf, audience, onContacts, silenceState, returnAllToBot, repair, pauseAutoReplies, resumeAutoReplies, queueCampaign, approveCampaign, sendCampaign, sendQuietCampaign, stopCampaign, listCampaigns, listBroadcastGroups, discoverGroups, createLocalReminder, onMessage, setBridge, bridgeSecret, manualTakeover, returnToBot, listReplyRules, saveReplyRule, deleteReplyRule, replyRuleVersions, rollbackReplyRule, simulateReply, learningState, setLearningPatternStatus, requestRestart })
}

export async function dispatchDueReminders(state, at = new Date()) {
  const clock = at instanceof Date ? at : new Date(at)
  const now = clock.toISOString(); const rows = state.db.all("SELECT * FROM reminders WHERE state='pending' AND due_at<=? LIMIT 5", now)
  for (const reminder of rows) {
    let reservedContentId = null
    try {
      if (!flags.send || !state.transport) continue
      const jid = state.db.decryptJid(reminder.jid)
      const target = state.db.jidKey(jid)
      if (isSuppressed(state.db, jid)) {
        state.db.run('UPDATE reminders SET state=? WHERE id=?', 'cancelled', reminder.id)
        state.db.addAudit('reminder-cancelled-suppressed', target, `id=${reminder.id}`)
        continue
      }
      const session = state.db.get('SELECT manual_until FROM chat_sessions WHERE jid=?', state.db.jidKey(jid))
      if (session?.manual_until && new Date(session.manual_until) > clock) {
        state.db.addAudit('reminder-deferred-manual', target, `id=${reminder.id}`)
        continue
      }
      /* التذكير ليس صدىً لكلام المستخدم: لا يخرج إلا إن بقيت مادته المختارة
         موجودة في الفهرس، وبقالبٍ ثابت عنوانُه ورابطُه من قاعدة الموقع فقط. */
      const item = reminder.content_id
        ? state.db.get('SELECT id,title,url FROM content_items WHERE id=?', reminder.content_id)
        : null
      if (!item || !isBelowConfiguredBase(item.url, SITE_URL)) {
        state.db.run('UPDATE reminders SET state=? WHERE id=?', 'cancelled', reminder.id)
        state.db.addAudit('reminder-cancelled-ungrounded', target, `id=${reminder.id};reason=${item ? 'non-site-url' : 'missing-content'}`)
        continue
      }
      const grounded = {
        shouldRespond: true,
        text: `هذا تذكيرك بالمادة التي اخترتها:\n${item.title}\n${item.url}`,
        contentId: item.id,
        contextItems: [item.id],
        seenContentIds: [item.id],
      }
      const verdict = validateGroundedResponse(state.db, grounded)
      if (!verdict.allowed) {
        state.db.run('UPDATE reminders SET state=? WHERE id=?', 'cancelled', reminder.id)
        state.db.addAudit('grounding-firewall-blocked', target, `reason=${verdict.code};source=reminder`)
        continue
      }
      if (!reserveContent(state.db, jid, item.id)) {
        state.db.addAudit('reminder-deferred-reservation', target, `id=${reminder.id}`)
        continue
      }
      reservedContentId = item.id
      await state.transport.sendText(jid, sign(grounded.text))
      rememberSent(state.db, jid, item.id)
      reservedContentId = null
      state.db.run('UPDATE reminders SET state=?,sent_at=? WHERE id=?', 'sent', now, reminder.id)
    } catch (error) {
      if (reservedContentId) {
        try {
          const jid = state.db.decryptJid(reminder.jid)
          releaseContentReservation(state.db, jid, reservedContentId)
        } catch { /* سيُنظَّف الحجز اليتيم بمهلة الأمان */ }
      }
      state.db.addAudit('reminder-failed', 'local', redactError(error))
    }
  }
}

export function ensureLock(lockPath) {
  try { fs.writeFileSync(lockPath, `${process.pid}\n`, { flag: 'wx', mode: 0o600 }); return true } catch { /* القفل موجود — قد يكون يتيماً */ }
  /* قفلٌ يتيم بعد سقوط مفاجئ كان يمنع الوكيل من الإقلاع للأبد، فتبقى لوحة واتساب
     «غير مرتبطة» بلا سبب ظاهر. نتبنّاه إن لم تعد عمليته حيّة. */
  try {
    const owner = Number(String(fs.readFileSync(lockPath, 'utf8')).trim())
    if (Number.isInteger(owner) && owner > 0) {
      try { process.kill(owner, 0); return false } catch { /* لا عملية بهذا المعرّف */ }
    }
    fs.writeFileSync(lockPath, `${process.pid}\n`, { mode: 0o600 })
    return true
  } catch { return false }
}

export function removeLock(lockPath) { try { fs.unlinkSync(lockPath) } catch { /* noop */ } }
