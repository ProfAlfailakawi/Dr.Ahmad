/**
 * المونتير الآلي — عقد اللوحة القصصية بالذكاء، بلا شبكة.
 *
 * حين يكتب الدكتور مقالةً جديدة لا لوحة لها في مكتبة الـ١٤٣ المقروءة، يطلب
 * المونتير من النموذج لوحةً قصصية بالعقد نفسه الذي قرأنا به مقالاته: لكل جملة
 * استعارة تطابق معناها من مكتبة الاستعارات الـ٤٨، وعنوان بسطرين من كلمات
 * الجملة حرفياً، لا اختلاق. الملف نقيٌّ عمداً (بلا استيراد) فيُختبر تحت node.
 */

export const MONTEUR_PROPS = [
  'teacherai', 'learninganalytics', 'digitalcitizen', 'feedback', 'critical', 'inclusive', 'adaptive', 'medialiteracy', 'digitalparent', 'privacy', 'creativeclass', 'gamedesign', 'vrlearning', 'researchquestion', 'assessment', 'lifelong', 'knowledgebridge', 'humanai', 'digitaldivide', 'designthinking', 'studentvoice', 'inquiry', 'teamlearning', 'selflearning',
  'neural', 'robot', 'chip', 'data', 'shield', 'scale', 'lms', 'screen', 'board', 'school', 'gamepad', 'trophy',
  'headset', 'access', 'rocket', 'gear', 'flask', 'atom', 'maker', 'blueprint', 'target', 'puzzle', 'network', 'bulb',
  'brain', 'stairs', 'ladder', 'compass', 'hands', 'family', 'heart', 'chat', 'arabesque', 'globe', 'mic', 'news',
  'magnifier', 'chart', 'book', 'clock', 'hourglass', 'calendar', 'roots', 'seed', 'key', 'door', 'question', 'cross',
]
export const MONTEUR_THEMES = ['ai', 'edtech', 'govern', 'elearn', 'smart', 'game', 'xr', 'assist', 'digital', 'stem', 'design', 'skills', 'lead', 'parent', 'society', 'media', 'research', 'read']
const PROP_MEANINGS = 'teacherai(المعلم والذكاء) learninganalytics(تحليل التعلّم) digitalcitizen(المواطنة الرقمية) feedback(تغذية راجعة) critical(تفكير ناقد) inclusive(تعلّم دامج) adaptive(تعلّم تكيفي) medialiteracy(وعي إعلامي) digitalparent(تربية رقمية) privacy(خصوصية البيانات) creativeclass(صف مبدع) gamedesign(تصميم الألعاب) vrlearning(تعلّم غامر) researchquestion(سؤال البحث) assessment(تقويم عادل) lifelong(تعلّم مستمر) knowledgebridge(جسر المعرفة) humanai(الإنسان والآلة) digitaldivide(الفجوة الرقمية) designthinking(تفكير تصميمي) studentvoice(صوت المتعلّم) inquiry(استقصاء) teamlearning(تعلّم تعاوني) selflearning(تعلّم ذاتي) neural(شبكة عصبية/تعلم آلي) robot(روبوت/آلة/أتمتة) chip(معالج/حوسبة/سحابة) data(بيانات/معلومات) shield(حماية/خصوصية/أمن/حوكمة) scale(ميزان/عدل/أخلاق/موازنة) lms(منصة تعلم/عن بعد) screen(شاشة/هاتف/تطبيق) board(سبورة/فصل/معلم/شرح) school(مدرسة/مؤسسة) gamepad(تلعيب/ألعاب/نقاط) trophy(فوز/إنجاز/تفوق) headset(واقع افتراضي/معزز/غمر) access(إتاحة/ذوي الاحتياجات/دمج) rocket(انطلاق/تسريع/تحول/مستقبل) gear(نظام/آلية/منظومة) flask(تجربة/بحث/مختبر) atom(علوم/طاقة/STEM) maker(صناعة/ورشة/بناء يدوي) blueprint(تصميم/خطة/مخطط) target(هدف/غاية/تركيز) puzzle(حل مشكلات/تركيب/تكامل) network(تعاون/تواصل/شبكة علاقات) bulb(فكرة/إبداع/إلهام) brain(تفكير/عقل/ذاكرة/انتباه) stairs(خطوات/مراحل/تعثر) ladder(ترقّي/صعود/تقدم) compass(رؤية/اتجاه/قيادة/قرار) hands(شراكة/تفويض/تكاتف) family(أسرة/أب/أم/طفل) heart(حب/مشاعر/احتواء/دفء) chat(حوار/محادثة/إصغاء) arabesque(هوية/ثقافة/تراث/لغة) globe(عالم/عالمي/دول) mic(إعلام/تلفزيون/صوت/بودكاست) news(صحافة/مقال/خبر/محتوى) magnifier(بحث/تحليل/تدقيق/تقييم) chart(نتائج/نمو/مقارنة/أداء) book(كتاب/قراءة/مكتبة/نص) clock(وقت/ساعة/زمن/سنوات) hourglass(انتظار/صبر/مهلة/تأخير/بطء) calendar(تاريخ/موعد/أمس/غد/شهر) roots(سبب جذري/أصل/أساس) seed(زرع/نمو/تنشئة/ثمرة) key(مفتاح/سر/حل) door(باب/فرصة/بداية) question(سؤال/لماذا/كيف/غموض) cross(نفي/خطأ/وهم/خرافة)'

export const STORYBOARD_PROPERTIES = {
  theme: { type: 'string', description: `one of: ${MONTEUR_THEMES.join(', ')}` },
  trio: { type: 'array', items: { type: 'string' }, description: 'ثلاثة أفعال مضارعة عربية تلخّص موقف المقالة، مثل: يفهم، يوجّه، يحمي' },
  narrative: { type: 'string', description: 'question | contrast | journey: the rhetorical arc best suited to the meaning' },
  opening: { type: 'string', description: 'A verbatim phrase from the body, at most 6 words, for the first frame' },
  quote: { type: 'string', description: 'جملة لافتة حرفية من المتن لا تتجاوز ٩ كلمات' },
  scenes: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        t: { type: 'string', description: 'metaphor | counter | list | flow | redirect' },
        prop: { type: 'string', description: `metaphor key from: ${MONTEUR_PROPS.join(' ')}` },
        src: { type: 'string', description: 'الجملة الأصلية حرفياً من المتن، ≤ 28 كلمة' },
        l1: { type: 'array', items: { type: 'string' }, description: '1–3 كلمات حرفية من src (السطر الأول)' },
        l2: { type: 'array', items: { type: 'string' }, description: '1–3 كلمات حرفية من src (السطر الثاني)' },
        em: { type: 'integer', description: 'فهرس الكلمة الأهم عبر l1 ثم l2 (يبدأ من 0)' },
        ann: { type: 'string', description: 'circle (فقط إن كانت الكلمة رقماً) | cross (فقط للنفي) | under | none' },
        photo: { type: 'string', description: 'Optional existing local /covers/ or /og/ image path supplied in the context. Never invent one.' },
        value: { type: 'number', description: 'للعدّاد فقط: الرقم أو النسبة' },
        items: { type: 'array', items: { type: 'string' }, description: 'للقائمة فقط: 2–4 عبارات حرفية قصيرة' },
        steps: { type: 'array', items: { type: 'string' }, description: 'للتدفق فقط: 2–3 عبارات حرفية' },
      },
      required: ['t', 'src', 'l1', 'l2', 'em', 'ann'],
    },
  },
}
export const STORYBOARD_REQUIRED = ['theme', 'trio', 'quote', 'scenes']

export function storyboardInstruction() {
  return [
    'You are a bilingual Arabic motion-design storyboard editor working for Dr. Ahmad Alfailakawi (professor of educational technology & AI, Kuwait).',
    'Read the article and produce a visual storyboard whose visuals truly match the MEANING of each sentence.',
    'Rules:',
    '1. 6 to 8 scenes in reading order. Each scene has t: "counter" when the sentence carries a number/percentage; "list" only for a real enumeration; "flow" only for a real sequence (ثم/بعدها/أولاً…); "redirect" only for changing course/correcting direction; else "metaphor".',
    '2. prop is REQUIRED for metaphor and must not repeat within the article. Pick the prop whose MEANING fits the sentence idea, not a surface word.',
    `3. Prop keys and meanings: ${PROP_MEANINGS}.`,
    '4. src is the original sentence VERBATIM (you may trim to a clause, never rewrite). l1 and l2 contain VERBATIM words from src only (drop words, never invent or reorder).',
    '5. em is the 0-based index of the single most important word across l1 then l2. ann is "circle" ONLY if that word contains a digit, "cross" ONLY if it is a negation (ليس/لن/خطأ/وهم), else "under" or "none".',
    '6. theme is one of the listed keys. trio is three Arabic present-tense verbs. quote is a verbatim striking sentence ≤ 9 words (prefer text inside «»).',
    '7. Keep Arabic exactly as written. Output JSON only.',
    '8. Visual-first: at most 6 words across l1+l2. Preserve negation and meaning. Choose a question, contrast or journey arc. The opening is a short VERBATIM phrase; never invent a quotation, statistic or evidence.',
    '9. Every counter value and every item/step must occur in src. Preserve reading order and units. Never turn a year or count into a percentage.',
  ].join('\n')
}

export function storyboardPrompt({ title, category, body }) {
  return [`العنوان: ${title}`, category ? `تصنيف الموقع: ${category}` : '', 'المتن:', String(body || '').slice(0, 12_000)].filter(Boolean).join('\n')
}

const DIGIT = /[0-9٠-٩]/
const NEG = ['ليس', 'لن', 'خطأ', 'غلط', 'فشل', 'باطل', 'وهم', 'ممنوع', 'خرافة']
const normalize = (s = '') => String(s).normalize('NFC').replace(/[ً-ْـ]/g, '').replace(/\s+/g, ' ').trim()
const tok = (s = '') => normalize(s).replace(/[.،؛:!؟"«»()\-–—…]/g, ' ').split(/\s+/).filter(Boolean)
const originalWords = (s = '') => String(s).replace(/[.،؛:!؟"«»()\-–—…]/g, ' ').split(/\s+/).filter(Boolean)
export function sourceContains(body, excerpt) {
  const whole = tok(body), part = tok(excerpt)
  return part.length > 0 && whole.some((_, i) => part.every((word, j) => whole[i + j] === word))
}
export function orderedSourceWords(source, words) {
  const whole = tok(source)
  let cursor = 0
  return words.every((word) => {
    const parts = tok(word)
    if (parts.length !== 1) return false
    while (cursor < whole.length && whole[cursor] !== parts[0]) cursor++
    return cursor++ < whole.length
  })
}
export function safeMonteurPhoto(value) {
  return typeof value === 'string' && /^\/(?:covers|og)\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|avif)$/.test(value) ? value : ''
}
function sourceNumbers(src) {
  return (String(src).replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).match(/\d+(?:[.,٫]\d+)?/g) || []).map((n) => Number(n.replace(/[,٫]/g, '.')))
}
/** Full-source validation, not prefix matching. Never manufacture a replacement claim. */
export function acceptStoryboard(raw, body = '') {
  const out = { theme: MONTEUR_THEMES.includes(raw?.theme) ? raw.theme : 'edtech', trio: [], quote: '', scenes: [], narrative: ['question', 'contrast', 'journey'].includes(raw?.narrative) ? raw.narrative : 'journey', opening: '' }
  out.trio = Array.isArray(raw?.trio) ? raw.trio.map((v) => String(v).trim()).filter(Boolean).slice(0, 3) : []
  for (const key of ['quote', 'opening']) {
    const phrase = String(raw?.[key] || '').trim()
    if (tok(phrase).length <= (key === 'quote' ? 9 : 6) && sourceContains(body, phrase)) out[key] = phrase
  }
  const used = new Set()
  for (const s of Array.isArray(raw?.scenes) ? raw.scenes : []) {
    const src = String(s?.src || '').trim()
    if (!src || tok(src).length > 32 || !sourceContains(body, src)) continue
    const l1 = (Array.isArray(s.l1) ? s.l1 : []).map(String).slice(0, 3)
    const l2 = (Array.isArray(s.l2) ? s.l2 : []).map(String).slice(0, 3)
    const words = [...l1, ...l2]
    if (words.length < 2 || !orderedSourceWords(src, words)) continue
    // A negated claim may not become an affirmative headline.
    const negations = originalWords(src).filter((w) => ['لا', 'ليس', 'ليست', 'لن', 'لم', 'لست', 'ليسا', 'ليسوا'].includes(normalize(w)))
    if (negations.some((w) => !words.some((x) => normalize(x) === normalize(w)))) continue
    const em = Number.isInteger(s.em) && s.em >= 0 && s.em < words.length ? s.em : words.length - 1
    const emWord = words[em]
    let ann = ['circle', 'cross', 'under', 'none'].includes(s.ann) ? s.ann : 'none'
    if (ann === 'circle' && !DIGIT.test(emWord)) ann = 'under'
    if (ann === 'cross' && !NEG.some((x) => normalize(emWord).startsWith(x))) ann = 'under'
    const t = ['metaphor', 'counter', 'list', 'flow', 'redirect'].includes(s.t) ? s.t : 'metaphor'
    const prop = MONTEUR_PROPS.includes(s.prop) ? s.prop : null
    if (t === 'metaphor' && (!prop || used.has(prop))) continue
    const scene = { t, prop, src, l1, l2, em, ann }
    if (t === 'counter') {
      const value = Number(s.value)
      if (s.value === undefined || s.value === null || !Number.isFinite(value) || !sourceNumbers(src).includes(value)) continue
      scene.value = value
    }
    if (t === 'list' || t === 'flow') {
      const key = t === 'list' ? 'items' : 'steps'
      const items = (Array.isArray(s[key]) ? s[key] : []).map(String).filter(Boolean).slice(0, t === 'list' ? 4 : 3)
      if (items.length < 2 || items.some((x) => !sourceContains(src, x)) || !orderedSourceWords(src, items.flatMap(originalWords))) continue
      scene[key] = items
    }
    const photo = safeMonteurPhoto(s.photo)
    if (photo) scene.photo = photo
    if (prop) used.add(prop)
    out.scenes.push(scene)
    if (out.scenes.length >= 8) break
  }
  return out
}
