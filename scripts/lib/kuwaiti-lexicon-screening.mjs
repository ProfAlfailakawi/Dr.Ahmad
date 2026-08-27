/**
 * خريطة التنبؤ السمعي للمعجم الكويتي.
 *
 * لا تدّعي التنبؤ بكل كلمة عربية مستقبلية؛ هذا مستحيل. بدلاً من ذلك تجمع:
 *  - الأعلى تكراراً وخطورةً في حوارات الدكتور الـ144؛
 *  - كلمات مقالاته التي لم تدخل الحوار بعد؛
 *  - ألفاظاً كويتية معاصرة موثقة في معاجم عامة؛
 *  - مصطلحات مرجحة في مقالات التربية والذكاء والمجتمع القادمة.
 *
 * كل عنصرٍ يُسمع في جملة. ما يسقط ينتقل إلى اختبار خيارات؛ وما لم يظهر
 * أصلاً يمسكه حارس الكلمات الجديدة قبل أن يصل Gemini.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { optimizeNativeSpokenEpisode } from './kuwaiti-native-spoken.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (rel) => JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'))
const tokens = (text) => String(text || '').match(/[ء-يچگ]+/gu) || []
const tidy = (text) => String(text || '').replace(/\s+/g, ' ').trim()

export const SCREENING_VERSION = '2026-08-27-kuwaiti-lexicon-screening-v2-risk-families'

const bare = (text) => String(text || '')
  .normalize('NFKC')
  .replace(/[\u064B-\u065F\u0670]/gu, '')
  .replace(/[إأآٱ]/gu, 'ا')
  .replace(/ى/gu, 'ي')

/* سياق الاختبار لازم يقيس الكلمة، مو قدرة المحرك على قراءة فقرة. بعض
   جمل المقالات تتجاوز ٦٠٠ حرف؛ نأخذ نافذةً طبيعية حول المفردة نفسها. */
function compactCarrier (sentence, key, before = 5, after = 7) {
  const parts = tidy(sentence).split(/\s+/u)
  const target = bare(key)
  const at = parts.findIndex((part) => bare(part).replace(/[^ء-يچگ]/gu, '').includes(target))
  if (at < 0 || parts.length <= before + after + 1) return tidy(sentence)
  const from = Math.max(0, at - before)
  const to = Math.min(parts.length, at + after + 1)
  return `${from ? '… ' : ''}${parts.slice(from, to).join(' ')}${to < parts.length ? ' …' : ''}`
}

/* الست التي سقطت في الحلقة 04. لا ألف وصل في خيارات ركض/هرب/تهرّب:
   الحكم الأحدث نصّ صراحةً أن بعض الكلمات تحملها وبعضها لا. الخيار الثالث
   إعادة صياغة حقيقية تحفظ المعنى إن بقي الجذر نفسه متذبذباً عند Gemini. */
export const OPTION_TESTS = [
  { key: 'نركض', speaker: 'Noura', carrier: '{W} وايد… ونسمي هالحركة التزام.',
    options: ['نَرْكُظ', 'نِرْكُظ', 'نظل نتحرك'] },
  { key: 'نتهرّب', speaker: 'Fahad', carrier: 'مرات تكون طريقة مرتبة {W} فيها.',
    options: ['نَتْهَرَّب', 'نِتْهَرَّب', 'نلهّي نفسنا'] },
  { key: 'قَسوة', speaker: 'Noura', carrier: 'بس هذا فيه {W} على اللي يشتغل بجد.',
    options: ['قَسوة', 'قِسوة', 'شدّة'] },
  { key: 'يقرّبنا', speaker: 'Fahad', carrier: 'نفرق بين شغل {W}… وشغل يبعدنا عنه.',
    options: ['يَقَرِّبنا من الشي المهم', 'يِقَرِّبنا من الشي المهم', 'يودّينا للشي المهم'] },
  { key: 'يركض', speaker: 'Noura', carrier: 'المشكلة إن الواحد {W}.',
    options: ['يَرْكُظ سنة كاملة', 'يِرْكِظ سنة كاملة', 'يظل مشغول سنة كاملة'] },
  { key: 'يهرب', speaker: 'Fahad', carrier: 'وبالأخير يكتشف إنه كان {W}.',
    options: ['يَهْرُب من نفسه', 'يِهْرِب من نفسه', 'ما يواجه نفسه'] },
]

/* عيّنة تغطية مقصودة: جذور القاف، الحركات الملتبسة، الهمزة، الأفعال
   المضارعة وتبدّل السياق. الجملة الحاملة تُقتنى آلياً من أقصر دور حقيقي. */
const EXPECTED_WORDS = `
أقل طريق الواقع الوقت يقول نقدر الحقيقي تقول نقول يقدر تقدر العقل الفرق نلقى الحقيقة المواقع
قبل قاعد قدام قال واقع نقعد يقدرون الرقابة أعمق طريقة قصة ناقصة الصادق الأرقام القرصنة القصور
أصدق التطبيقات أصلا أخطر باقي قاعدة توقف القديمة الورقة تفوق القيم أدق الذوق الطاقة الإرهاق
القراءة أضيق أوقظك إطلاق ينقصنا يصفق تطبيق يطبقونها نقصت يوقظ يقضي القلق القرار ثقافة
يقصدون يلتقط نصدق قاعدين حقيقة رقابة القضية القراصنة ينطق تنقطع تلقائيا يضايقك نستيقظ
المشكلة الطالب الطلبة الإنسان الإنترنت الذكاء التواصل الموضوع المفروض يسأل نسأل يبدأ
`.trim().split(/\s+/u)

/* ألفاظ حضرية/كويتية شائعة مأخوذة للتغطية من معاجم اللهجة المنشورة.
   وجودها في مرجع لا يعني اعتماد نطق Gemini؛ أذن الدكتور هي الحكم الأخير. */
const EXTERNAL = [
  ['ابتلش', 'إذا ابتلش الواحد بمشكلة، يسأل قبل لا يتصرف.'],
  ['أبخص', 'إنت أبخص بتفاصيل شغلك.'],
  ['أتونس', 'أتونس يوم تكون السالفة خفيفة وطبيعية.'],
  ['أدز', 'أدز لك الرابط عقب ما أتأكد منه.'],
  ['أدعم', 'مرات بالغلط أدعم السيارة اللي جدامي.'],
  ['دريشة', 'فتح الدريشة وخلى الهوا يدخل.'],
  ['فريج', 'كل أهل الفريج كانوا يعرفون بعض.'],
  ['حوش', 'اليهال قاعدين يلعبون بالحوش.'],
  ['يزهب', 'قاعد يزهب أغراضه حق باچر.'],
  ['ناطر', 'أنا ناطر الرد من الصبح.'],
  ['طرش', 'طرش لي الملف يوم تخلص.'],
  ['دز', 'دز الرسالة ولا تأجلها.'],
  ['طاف', 'الموعد طاف وإحنا للحين ننطر.'],
  ['هقوتي', 'هقوتي إن الموضوع أبسط من جذي.'],
  ['عبالي', 'عبالي إن الاجتماع باچر.'],
  ['حزة', 'بهالحزة عادة يكون الشارع زحمة.'],
  ['عفسة', 'الغرفة صارت عفسة بعد الشغل.'],
  ['خوش', 'خوش سؤال، ويستاهل نفكر فيه.'],
  ['يخرع', 'الخبر يخرع إذا سمعته من غير سياق.'],
  ['يطنش', 'مو كل مرة يقدر يطنش المشكلة.'],
  ['ينحاش', 'بدل لا ينحاش من السؤال، يواجهه.'],
  ['شالسالفة', 'شالسالفة؟ ليش الكل ساكت؟'],
  ['شكو', 'شكو هالموضوع باللي قاعدين نقوله؟'],
  ['شكثر', 'شكثر نحتاج وقت عشان نشوف النتيجة؟'],
  ['توه', 'توه واصل وما لحق يرتاح.'],
  ['للحين', 'للحين ما وصلنا للقرار النهائي.'],
  ['يمعود', 'يمعود، خلنا نفهم السالفة أول.'],
  ['يبه', 'يبه، الموضوع ما يحتاج كل هالتعقيد.'],
  ['أكو', 'أكو فرق بين السرعة والاستعجال.'],
  ['ماكو', 'ماكو مشكلة إذا اعترفنا بالغلط.'],
  ['جذي', 'جذي الصورة تصير أوضح.'],
  ['چم', 'چم مرة قلنا إن الإنسان أهم من الرقم؟'],
  ['أبي', 'أبي أفهم الفكرة قبل لا أحكم عليها.'],
  ['نبي', 'نبي نتيجة تنفع الناس مو مجرد رقم.'],
  ['تبي', 'إذا تبي الصج، لازم تسمع الطرفين.'],
  ['يبي', 'الطالب يبي أحد يسمعه قبل لا يحاسبه.'],
  ['شلون', 'شلون نعرف إن القرار كان صح؟'],
  ['شنو', 'شنو اللي تغير فعلًا بعد هالتجربة؟'],
  ['منو', 'منو يتحمل المسؤولية إذا صار خطأ؟'],
  ['ليش', 'ليش نستعجل الجواب قبل ما نفهم السؤال؟'],
  ['عيل', 'عيل شنو الخطوة اللي بعدها؟'],
  ['مادري', 'مادري إذا هالحل يناسب الكل.'],
  ['أدري', 'أدري إن الموضوع مو سهل.'],
  ['تدري', 'تدري شنو أكثر شي لفت نظري؟'],
  ['ندري', 'إحنا نَدري إن الخوف يأثر على القرار.'],
  ['ينطر', 'ما يصير الطالب ينطر لين آخر السنة.'],
  ['ننطر', 'إذا بننطر الكمال، ما راح نبدي.'],
  ['توني', 'توني منتبه لهالنقطة.'],
  ['توك', 'توك قلت إن المشكلة مو بالنتيجة.'],
  ['مبجر', 'وصل مبجر عشان يراجع كل شي.'],
  ['متوهق', 'صار متوهق بين قرارين.'],
  ['باچر', 'باچر نقدر نراجع النتيجة بهدوء.'],
  ['جدام', 'حط الدليل جدامك وبعدين احكم.'],
  ['ورا', 'لازم نفهم شنو ورا هالقرار.'],
  ['بره', 'المشكلة مو بس بره المدرسة.'],
  ['ديوانية', 'السالفة بالديوانية تمشي من سؤال لسؤال.'],
  ['يهال', 'اليهال يلاحظون التناقض بسرعة.'],
  ['ريال', 'كل ريال ينصرف لازم نعرف أثره.'],
  ['شغلة', 'هذي شغلة ثانية وتحتاج شرح بروحها.'],
  ['ينرفز', 'الرد الجاهز ينرفز أكثر مما يقنع.'],
]

/* مفردات مرجحة من خط الدكتور التحريري: تربية، ذكاء، بحث، نفس ومجتمع.
   بعضها قد يكون موجوداً الآن؛ إزالة التكرار لاحقاً تبقي جملة واحدة فقط. */
const FUTURE = [
  ['الخوارزمية', 'الخوارزمية مو دايما تعرف شنو الأنسب للإنسان.'],
  ['الخوارزميات', 'الخوارزميات تأثر على اللي نشوفه كل يوم.'],
  ['الخصوصية', 'الخصوصية مو تفصيل صغير بالعالم الرقمي.'],
  ['التحيز', 'التحيز ممكن يدخل بالقرار من غير ما ننتبه.'],
  ['الشفافية', 'الشفافية تبدأ يوم نفهم شلون طلع القرار.'],
  ['المساءلة', 'المساءلة ضرورية إذا نبي ثقة حقيقية.'],
  ['الحوكمة', 'الحوكمة تحدد منو مسؤول عن القرار.'],
  ['الاستدامة', 'الاستدامة مو شعار؛ هي قرار طويل المدى.'],
  ['الأتمتة', 'الأتمتة توفر وقت، بس ما تلغي دور الإنسان.'],
  ['الهلوسة', 'الهلوسة بالذكاء الاصطناعي ممكن تطلع جواب واثق وغلط.'],
  ['التوليدي', 'الذكاء التوليدي يكتب بسرعة، بس يحتاج مراجعة.'],
  ['السيبراني', 'الأمن السيبراني صار جزء من التربية الرقمية.'],
  ['المنصة', 'المنصة تجمع البيانات، بس منو يحميها؟'],
  ['البيانات', 'البيانات بروحها ما تشرح كل شي.'],
  ['المؤشرات', 'المؤشرات تساعدنا، بس ما تختصر الإنسان.'],
  ['المنهجية', 'المنهجية الواضحة تفرق بين الرأي والنتيجة.'],
  ['السببية', 'السببية ما تثبت لمجرد إن شيين صاروا مع بعض.'],
  ['العينة', 'إذا العينة صغيرة، ما نعمم النتيجة بسرعة.'],
  ['المتوسط', 'المتوسط يخفي فروق مهمة بين الناس.'],
  ['التقييم', 'التقييم المفروض يساعد الطالب يفهم نفسه.'],
  ['التكويني', 'التقييم التكويني يصير أثناء التعلم، مو بعده بس.'],
  ['الدافعية', 'الدافعية تقل إذا صار التعلم كله خوف.'],
  ['الاحتراق', 'الاحتراق النفسي مو مجرد تعب يومين.'],
  ['المرونة', 'المرونة مو إنك تسكت عن كل ضغط.'],
  ['الصمود', 'الصمود يحتاج دعم، مو أوامر وبس.'],
  ['الجدارة', 'الجدارة ما تنقاس بورقة وحدة.'],
  ['الكفاءة', 'الكفاءة تبين بالموقف، مو بالشعار.'],
  ['العدالة', 'العدالة مو إننا نعامل الكل بنفس الطريقة.'],
  ['المساواة', 'المساواة مهمة، بس الاحتياج يختلف من شخص للثاني.'],
  ['الهوية', 'الهوية الرقمية ما تختصر هوية الإنسان.'],
  ['الانتماء', 'الانتماء يكبر يوم الواحد يحس إن صوته مسموع.'],
  ['الأخلاقيات', 'الأخلاقيات بالتقنية تبدأ قبل إطلاق المنتج.'],
  ['المسؤولية', 'المسؤولية ما تضيع لمجرد إن القرار آلي.'],
  ['النقدي', 'التفكير النقدي يسأل عن الدليل قبل التصديق.'],
  ['الهجين', 'التعليم الهجين يحتاج تصميم، مو بس شاشة وصف.'],
  ['الذاتي', 'التعلم الذاتي يحتاج هدف واضح وتغذية راجعة.'],
  ['المصداقية', 'المصداقية تنبني على الدقة والوضوح.'],
  ['الاستقطاب', 'الاستقطاب يخلي كل طرف يسمع نفسه وبس.'],
  ['التضليل', 'التضليل ينتشر أسرع يوم تكون الرواية جذابة.'],
  ['التحقق', 'التحقق من المصدر يسبق المشاركة.'],
  ['النمذجة', 'النمذجة تساعدنا نفهم الاحتمالات قبل القرار.'],
  ['المحاكاة', 'المحاكاة تقرب الفكرة، بس مو بديل عن الواقع.'],
  ['الاستدلال', 'الاستدلال السليم يبدأ من دليل واضح.'],
  ['الترابط', 'الترابط بين متغيرين ما يثبت إن واحد سبب الثاني.'],
  ['الانحدار', 'تحليل الانحدار يفيد، بس تفسيره يحتاج حذر.'],
  ['الانحياز', 'الانحياز بالعينة ممكن يغير النتيجة كلها.'],
  ['الموثوقية', 'الموثوقية تعني إن القياس ثابت بظروف متشابهة.'],
  ['الصدق', 'صدق الأداة يسأل إذا كانت تقيس الشي المقصود.'],
  ['التكرار', 'التكرار بنفس النتيجة يقوي ثقتنا فيها.'],
  ['الاحتمالية', 'النتيجة الاحتمالية مو وعد أكيد.'],
  ['السحابة', 'السحابة تحفظ البيانات، بس تحتاج حماية واضحة.'],
  ['التشفير', 'التشفير يحمي المعلومة وهي تنتقل.'],
  ['المصادقة', 'المصادقة بخطوتين تقلل خطر اختراق الحساب.'],
  ['الاختراق', 'الاختراق مو دايما يبدأ بهجوم معقد.'],
  ['الابتزاز', 'الابتزاز الرقمي يحتاج تصرف هادي وسريع.'],
  ['الخوارزمي', 'القرار الخوارزمي لازم يكون قابل للمراجعة.'],
  ['الروبوتات', 'الروبوتات تغير بعض المهام، مو قيمة الإنسان.'],
  ['الافتراضي', 'العالم الافتراضي يوسع التواصل، بس مو بديل كامل.'],
  ['المعزز', 'الواقع المعزز يضيف معلومة فوق المشهد الحقيقي.'],
  ['التحليلات', 'التحليلات بالتعلم تساعد المعلم إذا فهم سياقها.'],
  ['الاستباقي', 'الدعم الاستباقي يوصل قبل ما تكبر المشكلة.'],
  ['التشخيص', 'التشخيص التربوي مو حكم نهائي على الطالب.'],
  ['التدخل', 'التدخل المبكر يفرق إذا كان مبني على دليل.'],
  ['الإدماج', 'الإدماج الحقيقي يحتاج بيئة تسمع احتياج كل طالب.'],
  ['الدمج', 'الدمج مو مجرد وجود الطلبة بنفس الصف.'],
  ['الإعاقة', 'الإعاقة ما تختصر الإنسان ولا قدراته.'],
  ['العسر', 'العسر بالقراءة يحتاج دعم متخصص مو لوم.'],
  ['الانتباه', 'الانتباه يتأثر بالنوم والضغط وطريقة الشرح.'],
  ['الذاكرة', 'الذاكرة مو مخزن ثابت؛ تتأثر بالسياق.'],
  ['الإدراك', 'الإدراك يتغير حسب الخبرة والتوقع.'],
  ['التعاطف', 'التعاطف يبدأ يوم نسمع من غير استعجال.'],
  ['الوصمة', 'الوصمة تمنع وايد ناس من طلب المساعدة.'],
  ['العزلة', 'العزلة الطويلة تأثر على النفس والعلاقات.'],
  ['التنمر', 'التنمر مو مزحة إذا الطرف الثاني قاعد يتأذى.'],
  ['المواطنة', 'المواطنة الرقمية فيها حقوق ومسؤوليات.'],
  ['الاستثمار', 'الاستثمار بالتعليم أثره يبين على مدى طويل.'],
  ['الاقتصاد', 'الاقتصاد المعرفي يعتمد على الإنسان قبل التقنية.'],
  ['التنافسية', 'التنافسية ما تنبني على السرعة بروحها.'],
  ['الإنتاجية', 'الإنتاجية مو عدد ساعات الدوام وبس.'],
  ['التمويل', 'التمويل لازم يرتبط بهدف وأثر واضح.'],
]

function dialogueContexts () {
  const lib = read('src/data/kuwaiti-diwania-v3.json')
  const rows = []
  for (const [slug, episode] of Object.entries(lib.episodes || {})) {
    const prepared = optimizeNativeSpokenEpisode(Object.values(episode), { slug }).turns
    for (const turn of prepared) rows.push({ slug, text: tidy(turn.text), words: new Set(tokens(turn.text)) })
  }
  return rows
}

function dialogueRiskExpected (rows, limit = 150) {
  const lexicon = read('src/data/kuwaiti-pronunciation.json')
  const approved = new Set()
  const approve = (value) => { for (const word of tokens(value)) approved.add(bare(word)) }
  for (const [key, value] of Object.entries(lexicon.words || {})) { approve(key); approve(value) }
  for (const [key, value] of Object.entries(lexicon.heardByEar || {})) { approve(key); approve(value) }
  for (const family of Object.values(lexicon.waslFamilies || {})) {
    for (const [key, value] of Object.entries(family.forms || {})) { approve(key); approve(value) }
  }
  const counts = new Map()
  for (const row of rows) {
    for (const word of row.words) {
      const key = bare(word)
      if (key.length < 3 || approved.has(key)) continue
      const risk = (/ق/u.test(word) ? 12 : 0) + (/[ضظصطغ]/u.test(word) ? 7 : 0) +
        (/[ءأإؤئ]/u.test(word) ? 6 : 0) + (/^[نيت]/u.test(word) && word.length >= 5 ? 5 : 0) +
        (/ّ/u.test(word) ? 4 : 0)
      if (!risk) continue
      const item = counts.get(key) || { key: word, count: 0, risk, carrier: row.text, source: row.slug }
      item.count += 1
      if (row.text.length < item.carrier.length) { item.carrier = row.text; item.source = row.slug }
      counts.set(key, item)
    }
  }
  return [...counts.values()]
    .sort((a, b) => (b.risk + Math.min(10, b.count)) - (a.risk + Math.min(10, a.count)) || a.carrier.length - b.carrier.length)
    .slice(0, limit)
    .map(({ key, carrier, source }) => ({ key, carrier: compactCarrier(carrier, key), category: 'عائلة نطق عالية الخطورة من الحوارات', source }))
}

function pickShortest (word, rows) {
  return rows.filter((row) => row.words.has(word)).sort((a, b) => a.text.length - b.text.length)[0]
}

function articleUnexpected (dialogueVocab, limit = 100) {
  const bodies = read('src/data/bodies.json')
  const found = new Map()
  const risk = (word) => {
    let score = 0
    if (/ق/u.test(word)) score += 12
    if (/[ءأإؤئ]/u.test(word)) score += 7
    if (/[ضظصطغ]/u.test(word)) score += 5
    if (/^[نيت]/u.test(word) && word.length >= 5) score += 4
    return score
  }
  for (const [slug, body] of Object.entries(bodies || {})) {
    const sentences = String(body).split(/(?<=[.؟!…])|\n+/u).map(tidy).filter(Boolean)
    for (const sentence of sentences) {
      for (const word of tokens(sentence)) {
        if (word.length < 4 || dialogueVocab.has(word) || risk(word) < 8) continue
        const row = found.get(word) || { key: word, count: 0, category: 'غير متوقع من متن المقالات', source: slug, carrier: sentence }
        row.count += 1
        if (sentence.length < row.carrier.length) { row.carrier = sentence; row.source = slug }
        found.set(word, row)
      }
    }
  }
  return [...found.values()]
    .sort((a, b) => (risk(b.key) + Math.min(8, b.count)) - (risk(a.key) + Math.min(8, a.count)) || a.carrier.length - b.carrier.length)
    .slice(0, limit)
    .map((item) => ({ ...item, carrier: compactCarrier(item.carrier, item.key) }))
}

export function buildKuwaitiLexiconScreening () {
  const rows = dialogueContexts()
  const dialogueVocab = new Set(rows.flatMap((row) => [...row.words]))
  const expected = EXPECTED_WORDS.map((key) => {
    const row = pickShortest(key, rows)
    return row && { key, carrier: compactCarrier(row.text, key), category: 'متوقع من حوارات الدكتور', source: row.slug }
  }).filter(Boolean)
  const riskFamilies = dialogueRiskExpected(rows)
  const article = articleUnexpected(dialogueVocab)
  const external = EXTERNAL.map(([key, carrier]) => ({ key, carrier, category: 'تغطية معجم كويتي', source: 'external-kuwaiti-lexicons' }))
  const future = FUTURE.map(([key, carrier]) => ({ key, carrier, category: 'مصطلح مرجح لمقال قادم', source: 'editorial-domain-forecast' }))

  const seen = new Set(OPTION_TESTS.map((item) => item.key))
  const screening = []
  for (const item of [...expected, ...riskFamilies, ...article, ...external, ...future]) {
    const normalizedKey = bare(item?.key)
    if (!item || seen.has(item.key) || seen.has(normalizedKey)) continue
    seen.add(item.key); seen.add(normalizedKey)
    screening.push({ ...item, speaker: screening.length % 2 ? 'Fahad' : 'Noura' })
  }
  return {
    version: SCREENING_VERSION,
    methodology: 'current-dialogue-frequency + article-only-risk + attested-kuwaiti-coverage + future-domain-forecast + fail-closed-new-word-guard',
    references: [
      'https://alarabi.nccal.gov.kw/Home/Article/6036',
      'https://sites.dlib.nyu.edu/viewer/books/nyu_aco000276/1?embed=1&lang=ar',
      'https://www.lahjah.com/web/index.php?show=1',
      'https://www.kalmasoft.com/KLEX/dccolkw.htm',
      'https://etheses.durham.ac.uk/id/eprint/935/1/Shamlan_al-Qenaie.._Final_Draft_%28PhD%29.pdf?DDD36=',
    ],
    optionTests: OPTION_TESTS,
    screening,
  }
}
