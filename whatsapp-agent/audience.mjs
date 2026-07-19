/**
 * محرك الجمهور — دفتر أسماء الدكتور وقوائمه.
 *
 * لماذا لا نسحب «قوائم البث» من واتساب؟
 * لأنها لا تُسحب. واتساب يحفظ قوائم البث على هاتفك وحده ولا يزامنها مع
 * الأجهزة المرتبطة، ومكتبة baileys لا تملك دالةً لجلبها (فحصنا: يوجد
 * isJidBroadcast للكشف فقط، ولا يوجد أي fetch). لو انتظرناها لانتظرنا أبداً.
 *
 * والذي يُزامَن فعلاً: دفتر جهات اتصالك بأسمائها. فنحن نلتقطه، ثم تبني أنت
 * قوائمك منه بالأسماء — وهذا أفضل من قوائم واتساب لا أضعف:
 *
 *   قائمة واتساب                     |  قائمتك هنا
 *   ---------------------------------|---------------------------------
 *   لا تصل إلا لمن حفظ رقمك          |  تصل للجميع (رسائل فردية)
 *   ٢٥٦ شخصاً حدّاً أقصى              |  بلا حد
 *   نصٌّ واحد للجميع                  |  «أهلاً أبا خالد» لكل واحد باسمه
 *   لا تعرف من وصلته                 |  حالة التسليم لكل شخص
 *   تعيش في هاتفك وحده               |  تعيش في لوحتك، تعدّلها متى شئت
 */
import { randomUUID } from 'node:crypto'

const now = () => new Date().toISOString()

/* ═══ ترقية الجداول — تُنفَّذ عند كل إقلاع، آمنة للتكرار ═══ */
const ADDITIONS = [
  ['contacts', 'nickname', 'TEXT'],           // اللقب الذي يكتبه الدكتور: «أبو خالد»
  ['contacts', 'wa_name', 'TEXT'],            // الاسم كما في واتساب
  ['contacts', 'source', "TEXT DEFAULT 'whatsapp'"],
  ['contacts', 'last_seen_at', 'TEXT'],
  ['broadcast_lists', 'kind', "TEXT DEFAULT 'manual'"],
  ['broadcast_lists', 'note', 'TEXT'],
  ['broadcast_lists', 'updated_at', 'TEXT'],
]

export function ensureAudienceSchema(db) {
  for (const [table, column, type] of ADDITIONS) {
    const has = db.all(`PRAGMA table_info(${table})`).some((c) => c.name === column)
    if (!has) db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
  }
  db.run('CREATE INDEX IF NOT EXISTS idx_broadcast_members_list ON broadcast_members(list_id)')
  purgeDiscoveredGroups(db)
  scrubPlainNumbers(db)
}

/**
 * القروبات المسحوبة سابقاً تُمحى، ولا يُسحب بعدها شيء.
 *
 * كانت تظهر في «قوائمك» بأسمائها الغريبة وبـ«٠ شخصاً» — وهي ليست قوائم
 * الدكتور بل مجموعاتٌ التقطها النظام من تلقاء نفسه.
 *
 * والعلامة الفارقة هي عمود jid لا عمود kind: القروب المسحوب يحمل jid
 * مشفَّراً لمجموعة واتساب، بينما القائمة التي ينشئها الدكتور تتركه فارغاً.
 * (ولا يصلح kind هنا لأن ALTER TABLE يملأ الصفوف القديمة بالقيمة الافتراضية،
 * فتتنكّر القروبات في هيئة قوائم يدوية.)
 */
function purgeDiscoveredGroups(db) {
  const strays = db.all('SELECT id FROM broadcast_lists WHERE jid IS NOT NULL')
  for (const row of strays) {
    db.run('DELETE FROM broadcast_members WHERE list_id=?', row.id)
    db.run('DELETE FROM broadcast_lists WHERE id=?', row.id)
  }
  if (strays.length) db.addAudit('groups.purged', '', `مُحيت ${strays.length} مجموعة مسحوبة`)
}

/**
 * سرّية الأرقام — قاعدة لا تُخترق.
 *
 * الرقم الكامل لا يُكتب في قاعدة البيانات أبداً. يعيش مشفَّراً داخل حقل jid
 * وحده، ولا يُفكّ إلا في اللحظة التي نسلّم فيها الرسالة لواتساب. أما عمود
 * phone فلا يحمل إلا آخر أربعة أرقام — للتمييز بين متشابهي الأسماء لا غير.
 *
 * وهذا يمسح ما كُتب صريحاً قبل هذا الإصلاح.
 */
function scrubPlainNumbers(db) {
  const rows = db.all('SELECT id, phone FROM contacts').filter((row) => String(row.phone || '').length > 4)
  for (const row of rows) db.run('UPDATE contacts SET phone=? WHERE id=?', String(row.phone).slice(-4), row.id)
  if (rows.length) db.addAudit('privacy.scrub', '', `أُخفيت ${rows.length} أرقام كاملة من القاعدة`)
}

/* ═══ أدوات ═══ */

/** آخر أربعة أرقام فقط — وهو كل ما نحفظه صريحاً */
const tailOf = (jid = '') => String(jid).split('@')[0].split(':')[0].replace(/\D/g, '').slice(-4)

/** الرقم الكامل يُستخرج من الـjid المشفَّر، ولا يُحفظ ولا يُعرض */
export function jidOf(db, row) {
  try { return row?.jid ? db.decryptJid(row.jid) : '' } catch { return '' }
}

/**
 * الاسم المعروض: لقب الدكتور أولاً، ثم اسم واتساب، ثم آخر أربعة أرقام.
 * لا يظهر الرقم كاملاً في اللوحة أبداً — ولا حتى للدكتور نفسه.
 */
export function displayNameOf(row) {
  return row.nickname || row.wa_name || row.display_name || `••${String(row.phone || '').slice(-4)}`
}

/* الألقاب التي يكتبها الدكتور قبل الاسم — تُصان ولا تُقتطع */
/* المنقوط يقبل الالتصاق («د.عبد الله»)، والكلمة تلزمها مسافة كيلا نبتر
   «الشيخة» إلى «الشيخ» + «ة». */
const HONORIFIC = /^(?:(?:[أا]\s*\.?\s*د\s*\.|د\s*\.|[أا]\s*\.|م\s*\.)\s*|(?:دكتورة?|الدكتورة?|[أا]ستاذة?|ال[أا]ستاذة?|مهندسة?|المهندسة?|الشيخة?|الحاجة?|المعلمة?|ال[أا]خ|ال[أا]خت)\s+)/

/* رؤوس الأسماء المركّبة: «عبد» و«أبو» و«أم» لا تقوم وحدها أبداً */
const COMPOUND_HEAD = /^(?:عبد|عبدال|أبو|ابو|أبا|ابا|أم|ام|ابن|بن|ذو|أبي|ابي)$/

/**
 * كنية النداء في الرسالة — الاسم الأول وحده، لكن بأدبٍ عربيّ:
 *
 *   «د. عبد الرزاق العلي»      → «د. عبد الرزاق»   (لا «د. عبد»!)
 *   «الدكتور عبد اللطيف الشمري» → «الدكتور عبد اللطيف»
 *   «خالد العنزي»              → «خالد»
 *   «أبو خالد»                 → «أبو خالد»
 *
 * قاعدتان: اللقب الذي كتبه الدكتور يبقى، و«عبد» لا تُفصل عمّا بعدها —
 * فمناداة رجلٍ بـ«عبد» وحدها إساءةٌ لا اختصار.
 */
export function vocativeOf(row) {
  const raw = String(row.nickname || row.wa_name || row.display_name || '').replace(/[‎‏]/g, '').replace(/\s+/g, ' ').trim()
  if (!raw || /^\+?\d[\d\s-]*$/.test(raw)) return ''      // رقمٌ لا اسم: لا نُنادي به إنساناً

  let title = ''
  let rest = raw
  const matched = rest.match(HONORIFIC)
  if (matched) { title = matched[0].trim(); rest = rest.slice(matched[0].length).trim() }

  const words = rest.split(' ').filter(Boolean)
  if (!words.length) return title
  const first = COMPOUND_HEAD.test(words[0]) && words[1] ? `${words[0]} ${words[1]}` : words[0]
  return title ? `${title} ${first}` : first
}

/* ═══ التقاط جهات الاتصال من واتساب ═══ */

/**
 * يستوعب دفعة جهات اتصال من baileys. لا يمسّ لقباً كتبه الدكتور أبداً —
 * واتساب يحدّث اسمه هو، واللقب يبقى للدكتور وحده.
 */
export function absorbContacts(db, contacts = []) {
  let added = 0
  let updated = 0
  for (const contact of contacts) {
    const jid = contact?.id || contact?.jid
    if (!jid || typeof jid !== 'string') continue
    if (!jid.endsWith('@s.whatsapp.net')) continue          // أفراد فقط: لا مجموعات ولا حالات
    const waName = String(contact.name || contact.notify || contact.verifiedName || '').trim()
    const id = db.jidKey(jid)
    const existing = db.get('SELECT id, wa_name FROM contacts WHERE id=?', id)
    if (existing) {
      if (waName && waName !== existing.wa_name) {
        db.run('UPDATE contacts SET wa_name=?, last_seen_at=?, updated_at=? WHERE id=?', waName, now(), now(), id)
        updated += 1
      }
      continue
    }
    db.run(
      `INSERT INTO contacts(id, jid, display_name, phone, suppressed, wa_name, source, last_seen_at, created_at, updated_at)
       VALUES(?,?,?,?,0,?,'whatsapp',?,?,?)`,
      id, db.encryptJid(jid), waName || null, tailOf(jid), waName || null, now(), now(), now(),
    )
    added += 1
  }
  if (added || updated) db.addAudit('contacts.absorb', '', `أضيف ${added} · حُدّث ${updated}`)
  return { added, updated }
}

/* ═══ دفتر الأسماء ═══ */

export function listContacts(db, { search = '', limit = 500 } = {}) {
  const rows = db.all('SELECT * FROM contacts ORDER BY COALESCE(nickname, wa_name, display_name, phone) COLLATE NOCASE')
  const term = String(search || '').trim().toLowerCase()
  return rows
    .map((row) => ({
      id: row.id,
      name: displayNameOf(row),
      nickname: row.nickname || '',
      waName: row.wa_name || row.display_name || '',
      tail: String(row.phone || '').slice(-4),
      suppressed: Boolean(row.suppressed),
      /* في كم قائمةٍ هو؟ صفرٌ يعني أنه في دفترك ولم يدخل قائمةً بعد. */
      lists: Number(db.get('SELECT COUNT(*) c FROM broadcast_members WHERE jid=?', row.id)?.c || 0),
    }))
    .filter((row) => !term || row.name.toLowerCase().includes(term) || row.tail.includes(term))
    .slice(0, limit)
}

/** يكتب الدكتور لقباً لشخص — «أبو خالد» بدل رقمٍ مجهول */
export function setNickname(db, contactId, nickname) {
  const value = String(nickname || '').trim().slice(0, 60) || null
  db.run('UPDATE contacts SET nickname=?, updated_at=? WHERE id=?', value, now(), contactId)
  db.addAudit('contact.nickname', contactId, value || '(أُزيل)')
  return { ok: true }
}

/**
 * يضيف الدكتور شخصاً برقمه يدوياً (ليس في دفتر واتساب بعد).
 * نقبل الرقم الكويتي بلا مفتاح دولة ونكمّله.
 */
export function addContactByPhone(db, phone, nickname = '') {
  /* الرقم الواحد يُكتب بصيغٍ شتّى — «٩٩٠٠١١٢٢» و«+965 9900 1122» و«00965…»
     و«(965) 9900-1122». تُوحَّد كلها إلى صورةٍ واحدة، وإلا صار الشخص الواحد
     شخصين في الدفتر وتلقّى الرسالة مرتين. */
  let digits = String(phone || '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))   // أرقام عربية → غربية
    .replace(/\D/g, '')
  if (!digits) return { ok: false, error: 'الرقم فارغ' }
  digits = digits.replace(/^00+/, '')                             // بادئة الاتصال الدولي
  if (digits.length === 8) digits = `965${digits}`                // كويتي بلا مفتاح
  if (digits.length < 10) return { ok: false, error: 'الرقم غير مكتمل' }
  const jid = `${digits}@s.whatsapp.net`
  const id = db.jidKey(jid)
  const existing = db.get('SELECT id FROM contacts WHERE id=?', id)
  if (existing) {
    if (nickname) setNickname(db, id, nickname)
    return { ok: true, id, existed: true }
  }
  db.run(
    `INSERT INTO contacts(id, jid, display_name, phone, suppressed, nickname, source, created_at, updated_at)
     VALUES(?,?,?,?,0,?,'manual',?,?)`,
    id, db.encryptJid(jid), nickname || null, digits.slice(-4), nickname || null, now(), now(),
  )
  db.addAudit('contact.add', id, 'أُضيف يدوياً')
  return { ok: true, id, existed: false }
}

/**
 * لصق دفعة أرقام بأسمائها — الطريق المضمون.
 *
 * واتساب لا يسلّم دفتر هاتفك لجهازٍ مرتبط إلا عبر مزامنة حالة التطبيق، وقد
 * تتأخّر أو لا تصل. فبدل انتظارها، يلصق الدكتور أسماءه وأرقامه دفعةً واحدة.
 *
 * يقبل كل الصيغ الشائعة، سطراً لكل شخص:
 *   أبو خالد, 99001122
 *   99001122 - أبو خالد
 *   أبو خالد  +965 9900 1122
 *   99001122
 * ويتجاهل السطور الفارغة والمكررة، ولا يستبدل لقباً كتبتَه من قبل.
 */
/**
 * بطاقات vCard — ما يخرج من «جهات الاتصال» في الماك والآيفون.
 *
 * يكفي أن يحدّد الدكتور جهاته كلها ويسحبها إلى الخانة أو يلصق محتوى الملف،
 * فنقرأ الاسم (FN) والأرقام (TEL) من كل بطاقة. وهذا أسرع طريقٍ لنقل دفترٍ
 * كامل، وأضمن من انتظار مزامنةٍ قد لا تحمل الدفتر أصلاً.
 */
function parseVCards(text) {
  const cards = String(text).split(/BEGIN:VCARD/i).slice(1)
  const lines = []
  for (const card of cards) {
    const name = (card.match(/^FN[^:]*:(.+)$/im) || [])[1]
      || (card.match(/^N[^:]*:(.+)$/im) || [])[1]?.split(';').filter(Boolean).reverse().join(' ')
      || ''
    const tel = (card.match(/^TEL[^:]*:(.+)$/im) || [])[1] || ''
    if (tel.trim()) lines.push(`${name.trim().replace(/;/g, ' ')} ${tel.trim()}`)
  }
  return lines
}

export function importContacts(db, text, { listId = '' } = {}) {
  const raw = String(text || '')
  /* البطاقات تُترجَم إلى سطور «اسم رقم» فيمرّ الجميع بالمسار نفسه */
  const source = /BEGIN:VCARD/i.test(raw) ? parseVCards(raw).join('\n') : raw
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const added = []
  const known = []
  const skipped = []
  for (const line of lines) {
    /* الرقم أطول تتابع أرقام في السطر (مع تجاهل الفواصل داخله) */
    const candidates = [...line.matchAll(/[\d٠-٩][\d٠-٩\s+()-]{6,}/g)]
      .map((match) => match[0])
      .sort((a, b) => b.replace(/\D/g, '').length - a.replace(/\D/g, '').length)
    const rawNumber = candidates[0]
    if (!rawNumber) { skipped.push({ line, why: 'لا رقم فيه' }); continue }
    /* الأرقام العربية تُحوّل غربيةً — قاعدةُ الدكتور الثابتة */
    const digits = rawNumber.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\D/g, '')
    /* «+» مفتاح الدولة يبقى خارج المطابقة (النمط يبدأ برقم) فيتسرّب للاسم — يُنظَّف */
    const name = line.replace(rawNumber, ' ')
      .replace(/[,،\-–—:|+()]/g, ' ')
      .replace(/\s+/g, ' ').trim()
    const result = addContactByPhone(db, digits, name)
    if (!result.ok) { skipped.push({ line, why: result.error }); continue }
    /* الاستيراد الثاني لا يكرّر أحداً: من كان في الدفتر يُعدّ «معروفاً»
       ويُترك كما هو (بلقبه الذي كتبتَه)، والجديد وحده يُجمع لتراه. */
    if (result.existed) known.push(result.id); else added.push(result.id)
  }
  if (listId && added.length) addMembers(db, listId, added)
  db.addAudit('contacts.import', listId || '', `جديد ${added.length} · معروف ${known.length} · تُخطّي ${skipped.length}`)
  return {
    ok: true,
    added: added.length,
    known: known.length,
    skipped,
    /* الجدد بأسمائهم — يعرضهم الاستوديو على حدة كي يعرف الدكتور من لم
       يُضَف إلى قائمةٍ بعد. */
    newcomers: added.map((id) => {
      const row = db.get('SELECT * FROM contacts WHERE id=?', id)
      return { id, name: displayNameOf(row), tail: String(row?.phone || '').slice(-4) }
    }),
  }
}

/* ═══ القوائم ═══ */

export function listLists(db) {
  return db.all('SELECT * FROM broadcast_lists ORDER BY name COLLATE NOCASE').map((row) => ({
    id: row.id,
    name: row.name || 'قائمة بلا اسم',
    note: row.note || '',
    kind: row.kind || 'manual',
    count: db.get('SELECT COUNT(*) c FROM broadcast_members WHERE list_id=?', row.id)?.c || 0,
  }))
}

export function createList(db, name, note = '') {
  const clean = String(name || '').trim().slice(0, 80)
  if (!clean) return { ok: false, error: 'اسم القائمة فارغ' }
  const id = randomUUID()
  db.run(
    'INSERT INTO broadcast_lists(id, name, jid, member_count, members_readable, discovered_at, kind, note, updated_at) VALUES(?,?,NULL,0,1,?,?,?,?)',
    id, clean, now(), 'manual', String(note || '').slice(0, 200), now(),
  )
  db.addAudit('list.create', id, clean)
  return { ok: true, id }
}

export function renameList(db, listId, name, note) {
  const clean = String(name || '').trim().slice(0, 80)
  if (!clean) return { ok: false, error: 'اسم القائمة فارغ' }
  db.run('UPDATE broadcast_lists SET name=?, note=?, updated_at=? WHERE id=?', clean, String(note || '').slice(0, 200), now(), listId)
  return { ok: true }
}

export function deleteList(db, listId) {
  db.run('DELETE FROM broadcast_members WHERE list_id=?', listId)
  db.run('DELETE FROM broadcast_lists WHERE id=?', listId)
  db.addAudit('list.delete', listId, '')
  return { ok: true }
}

export function listMembers(db, listId) {
  const rows = db.all(
    `SELECT c.* FROM broadcast_members m JOIN contacts c ON c.id = m.jid
     WHERE m.list_id = ? ORDER BY COALESCE(c.nickname, c.wa_name, c.display_name) COLLATE NOCASE`,
    listId,
  )
  return rows.map((row) => ({
    id: row.id,
    name: displayNameOf(row),
    vocative: vocativeOf(row),
    nickname: row.nickname || '',
    tail: String(row.phone || '').slice(-4),
    suppressed: Boolean(row.suppressed),
  }))
}

export function addMembers(db, listId, contactIds = []) {
  let added = 0
  for (const contactId of contactIds) {
    if (!db.get('SELECT id FROM contacts WHERE id=?', contactId)) continue
    const result = db.run(
      'INSERT OR IGNORE INTO broadcast_members(list_id, jid, opaque_id) VALUES(?,?,?)',
      listId, contactId, contactId,
    )
    if (result.changes) added += 1
  }
  syncCount(db, listId)
  return { ok: true, added }
}

export function removeMember(db, listId, contactId) {
  db.run('DELETE FROM broadcast_members WHERE list_id=? AND jid=?', listId, contactId)
  syncCount(db, listId)
  return { ok: true }
}

function syncCount(db, listId) {
  const count = db.get('SELECT COUNT(*) c FROM broadcast_members WHERE list_id=?', listId)?.c || 0
  db.run('UPDATE broadcast_lists SET member_count=?, updated_at=? WHERE id=?', count, now(), listId)
}

/* ═══ التخصيص ═══ */

/**
 * يستبدل الرموز في نص الرسالة لكل شخص على حدة.
 *   {الاسم}  → «أبو خالد» — ويسقط السطر كله بلطف إن لم نعرف اسمه
 *   {تحية}   → «صباح الخير» / «مساء الخير» بحسب ساعة الإرسال
 *
 * الحيلة المهمة: «أهلاً {الاسم}،» بلا اسمٍ تصير «أهلاً ،» وهذا قبيح.
 * لذا نحذف علامات الترقيم المعلّقة حول الرمز الفارغ.
 */
export function personalize(text, member, at = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kuwait' }).format(at))
  const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء الخير'
  let out = String(text || '').replace(/\{\s*تحية\s*\}/g, greeting)
  const vocative = member?.vocative || ''
  if (vocative) out = out.replace(/\{\s*الاسم\s*\}/g, vocative)
  else {
    /* بلا اسم: يسقط الرمز وحده، وتبقى الفاصلة ملتصقةً بما قبلها —
       «{تحية} {الاسم}، مقال» تصير «صباح الخير، مقال» لا «صباح الخير مقال». */
    out = out.replace(/ *\{\s*الاسم\s*\} */g, '')
    out = out.replace(/^[ \t]*[،,:]\s*/gm, '')   // ولا تبدأ الجملة بفاصلة يتيمة
  }
  return out.replace(/[ \t]{2,}/g, ' ').replace(/ +\n/g, '\n').trim()
}

/**
 * جمهور الإرسال الفعلي: أعضاء القائمة ناقص من طلب الإيقاف.
 * قاعدةٌ لا تُخترق — من قال «أوقف الرسائل» لا يصله شيء أبداً.
 */
export function resolveAudience(db, listId) {
  const members = listMembers(db, listId)
  return {
    send: members.filter((m) => !m.suppressed),
    suppressed: members.filter((m) => m.suppressed),
  }
}

/** معاينة: ماذا يصل أول ثلاثة بالضبط؟ */
export function previewFor(db, listId, text, limit = 3) {
  const { send } = resolveAudience(db, listId)
  return send.slice(0, limit).map((member) => ({ name: member.name, body: personalize(text, member) }))
}
