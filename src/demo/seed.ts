/*
 * بيانات العرض التوضيحي — كلها خيالية (أسماء وعناوين بريد example.com) وتُولَّد محلياً
 * بنسبة إلى لحظة التشغيل، فتبقى التواريخ «حديثة» دائماً. لا تُرسَل لأي خادم.
 * تُحمَّل فقط حين يكون VITE_DEMO_MODE=1 (انظر vite.config.ts).
 */
import { articles, books, papers } from '../data'
import audioMap from '../data/audio.json'
import bodies from '../data/bodies.json'

const DAY = 86_400_000
type Raw = Record<string, any>
const ts = (ms: number) => ({ __ts: ms })

/* مولّد شبه عشوائي ثابت — النتائج متطابقة في كل تشغيل */
function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}
const kuwaitDay = (ms: number) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kuwait', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}
const enc = (path: string) => encodeURIComponent(path)

const NAMES = ['نورة العتيبي', 'فهد المطيري', 'مريم الرشيدي', 'يوسف الكندري', 'هند الصباح', 'سلمان العجمي', 'دانة الهاجري', 'خالد البراك', 'لطيفة الدوسري', 'ناصر الشمري', 'ريم العازمي', 'بدر الفضلي', 'أمل الخالدي', 'عبدالله السالم', 'جود القطان', 'حمد الكوح']
const EMAILS = ['noura.demo', 'fahad.demo', 'maryam.demo', 'yousef.demo', 'hind.demo', 'salman.demo', 'dana.demo', 'khaled.demo', 'latifa.demo', 'nasser.demo', 'reem.demo', 'badr.demo', 'amal.demo', 'abdullah.demo', 'joud.demo', 'hamad.demo']

function audioInventory(now: number): Raw {
  const bySlug = audioMap as Record<string, Record<string, boolean>>
  const vals = Object.values(bySlug)
  const count = (k: string) => vals.filter((v) => v && v[k]).length
  return {
    fahed: count('fahed'), noura: count('noura'), dialogue: count('dialogue'), dialogueKuwaiti: count('dialogueKuwaiti'),
    readingArticles: vals.filter((v) => v && (v.fahed || v.noura)).length,
    totalAudioFiles: count('fahed') + count('noura') + count('dialogue') + count('dialogueKuwaiti'), articleCount: articles.length,
    source: 'R2', scanComplete: true, lastAttemptComplete: true, scanMethod: 'جرد R2 الموقّع', scanMessage: 'اكتمل الجرد بنجاح', unknownObjects: 0, bySlug,
    lastAttemptAt: ts(now - 40 * 60_000), lastSyncAt: ts(now - 40 * 60_000),
  }
}

export function DEMO_COLLECTIONS(now: number): Record<string, Record<string, Raw>> {
  const r = rng(20261001)
  const out: Record<string, Record<string, Raw>> = {}

  /* ── المشاهدات: إجماليات + أيام الأسبوع الأخير لكل مقال وكتاب وبحث وصفحة ── */
  const views: Record<string, Raw> = {}
  const addView = (path: string, title: string, base: number) => {
    const total = Math.max(3, Math.round(base))
    views[`total:${enc(path)}`] = { count: total, title, updatedAt: ts(now - r() * 2 * DAY) }
    let left = Math.round(total * 0.06)
    for (let d = 0; d < 7; d++) {
      const c = d === 6 ? left : Math.round(left * (0.1 + r() * 0.2))
      left -= c
      const n = Math.max(0, c)
      if (n) views[`day:${kuwaitDay(now - d * DAY)}:${enc(path)}`] = { count: n, title, updatedAt: ts(now - d * DAY) }
    }
  }
  const pages: [string, string, number][] = [['/', 'الرئيسية', 5200], ['/articles', 'فهرس المقالات', 2100], ['/publications', 'فهرس الكتب', 1350], ['/research', 'فهرس الأبحاث', 980], ['/media', 'الظهور الإعلامي', 640], ['/cv', 'السيرة الأكاديمية', 1120], ['/contact', 'التواصل', 540], ['/about', 'حول الموقع', 330], ['/atlas', 'سماء المقالات', 410], ['/search', 'البحث العميق', 760], ['/ask', 'اسأل الأرشيف', 890], ['/listen', 'استمع', 1480], ['/questions', 'سؤال يقلق التعليم', 520], ['/radar', 'أرشيف الرادار', 380], ['/upcoming', 'اللقاءات القادمة', 290], ['/thought-paths', 'مسارات الفكرة', 450]]
  pages.forEach(([p, t, b]) => addView(p, t, b * (0.9 + r() * 0.2)))
  articles.forEach((a, i) => {
    const base = 40 + 1900 / (1 + i * 0.35) + r() * 120
    addView(`/articles/${a.slug}`, a.title, base)
    if (i < 40) views[`total:${enc(`/_share/articles/${a.slug}`)}`] = { count: Math.round(base * (0.04 + r() * 0.05)) + 2, title: `مشاركة: ${a.title}` }
    if (i < 25) { views[`total:${enc(`/_listen50/articles/${a.slug}`)}`] = { count: Math.round(base * 0.12) + 3, title: `استماع ٥٠٪ (فهد): ${a.title}` }; views[`total:${enc(`/_listen100/articles/${a.slug}`)}`] = { count: Math.round(base * 0.06) + 1, title: `استماع ١٠٠٪ (نورة): ${a.title}` } }
  })
  books.forEach((b: any, i) => addView(`/publications/${b.slug}`, b.title, 700 / (1 + i * 0.4) + 60 + r() * 50))
  papers.forEach((p: any, i) => addView(`/research/${p.slug}`, p.titleAr || p.title, 320 / (1 + i * 0.15) + 25 + r() * 30))
  /* رحلات الزائر داخل views */
  const jr: Record<string, Raw> = {}
  const as = articles.slice(0, 12)
  for (let i = 0; i < as.length - 1; i++) {
    const from = i % 3 === 0 ? '/' : `/articles/${as[i].slug}`
    const to = `/articles/${as[i + 1].slug}`
    const count = Math.round(180 / (1 + i * 0.5)) + 6
    jr[`${enc(from)}>${enc(to)}`] = { from, to, count, updatedAt: ts(now - r() * 3 * DAY) }
  }
  ;[['/', '/articles'], ['/', '/publications'], ['/articles', `/articles/${as[0].slug}`], ['/publications', `/publications/${(books[0] as any).slug}`], ['/search', '/ask'], ['/', '/listen']].forEach(([f, t], i) => { jr[`${enc(f)}>${enc(t)}`] = { from: f, to: t, count: 240 - i * 28, updatedAt: ts(now - i * DAY) } })
  out.journeys = jr
  out.views = views

  /* ── الرسائل (صندوق الوارد) ── */
  const MSGS: [string, string, string, string, string][] = [
    ['محاضرة أو ورشة', 'طلب فعالية', 'جاد وواضح', 'السلام عليكم دكتور، نرغب في دعوتكم لإلقاء ورشة عن توظيف الذكاء الاصطناعي في التقييم التربوي ضمن يوم المعلم في كلية التربية الأساسية، الموعد المقترح نهاية نوفمبر، ونسعد بتحديد الأنسب لكم.', '2'],
    ['لقاء إعلامي', 'طلب إعلامي', 'جاد وواضح', 'نعدّ حلقة بودكاست حول مستقبل المدرسة في الكويت ونود استضافتكم لمدة ٤٠ دقيقة. التسجيل في استوديو بالعاصمة أو عن بعد حسب راحتكم.', '3'],
    ['استشارة', 'استشارة', 'جاد وواضح', 'أعمل منسقة تقنية في مدرسة ثانوية، وأبحث عن إطار عملي لتقييم أدوات التعلم الرقمية قبل اعتمادها. هل لديكم ورقة أو مقال يصلح مرجعاً؟', '5'],
    ['تعاون بحثي', 'تعاون أكاديمي', 'جاد وواضح', 'ندرس أثر القراءة الصوتية على استيعاب طلاب المرحلة المتوسطة، ويسعدنا التعاون معكم في تصميم الأداة وتحليل النتائج. مرفق ملخص المشروع في الرابط.', '8'],
    ['أخرى', 'طلب عام', 'يحتاج تفصيل بسيط', 'أعجبني مقالكم «النجاح الذي لا يفرح صاحبه»، وأود الاقتباس منه في نشرة المدرسة مع الإشارة للمصدر. هل يناسبكم ذلك؟', '12'],
    ['استشارة', 'استشارة', 'جاد وواضح', 'ابني في الصف التاسع يخاف الامتحانات إلى درجة الأرق. أي اقتراحات تربوية عملية للأسرة قبل الاختبارات النهائية؟ جزاكم الله خيراً.', '20'],
    ['محاضرة أو ورشة', 'طلب فعالية', 'يحتاج تفصيل بسيط', 'هل تقدمون محاضرات عن بعد لمعلمي المدارس الأهلية؟ نحتاج جلسة لا تتجاوز ساعة في بداية الفصل الثاني.', '26'],
    ['لقاء إعلامي', 'طلب إعلامي', 'جاد وواضح', 'برنامج «صباح التعليم» يود تخصيص فقرة عن الكتب الإلكترونية التفاعلية. هل يمكن تحديد موعد تسجيل خلال الأسبوعين القادمين؟', '31'],
    ['أخرى', 'طلب عام', 'جاد وواضح', 'قرأت كتابكم الموسوعة بالكامل وأحببت الفصل الأخير، وأقترح إضافة قسم عن التعلم المصغر. شكراً على هذا الجهد المبارك.', '38'],
    ['تعاون بحثي', 'تعاون أكاديمي', 'جاد وواضح', 'طالبة ماجستير في تكنولوجيا التعليم، وأرغب في إجراء مقابلة قصيرة معكم لرسالتي عن التحول الرقمي في التعليم العام.', '44'],
    ['استشارة', 'استشارة', 'يحتاج توضيح', 'أريد البدء في مجال تكنولوجيا التعليم، من أين أبدأ؟', '52'],
    ['محاضرة أو ورشة', 'طلب فعالية', 'جاد وواضح', 'يسر جمعية المعلمين دعوتكم لافتتاح ملتقى «المعلم الرقمي» في فبراير القادم، وسنرسل الكتاب الرسمي عبر البريد.', '60'],
    ['أخرى', 'طلب عام', 'جاد وواضح', 'شكراً لكم على تفريغ حلقات الموسوعة المرئية؛ ساعدني ذلك في تحضير محاضرتي الجامعية.', '71'],
    ['لقاء إعلامي', 'طلب إعلامي', 'جاد وواضح', 'مجلة تربوية محكّمة تطلب مقابلة مكتوبة حول رؤيتكم لمدرسة ٢٠٣٥.', '85'],
  ]
  const messages: Record<string, Raw> = {}
  MSGS.forEach(([topic, intent, quality, message, days], i) => {
    const approved = i === 4 || i === 8 || i === 12
    messages[`msg${String(i + 1).padStart(2, '0')}`] = {
      name: NAMES[i % NAMES.length], email: `${EMAILS[i % EMAILS.length]}@example.com`, topic, intent, quality, message,
      reference: `DR-${2610 + i}-${String(100 + i * 7)}`, createdAt: ts(now - Number(days) * DAY * 0.8 - i * 3600_000),
      ...(approved ? { approvedForTestimonial: true, testimonialQuote: message.slice(0, 240) } : {}),
    }
  })
  out.messages = messages

  /* ── مشتركو النشرة ── */
  const subs: Record<string, Raw> = {}
  for (let i = 0; i < 46; i++) {
    const n = EMAILS[i % EMAILS.length].split('.')[0]
    subs[`sub${i}`] = { email: `${n}${i + 1}@example.com`, createdAt: ts(now - (i * 2.3 + r() * 2) * DAY), source: i % 3 ? 'footer' : 'article' }
  }
  out.subscribers = subs

  /* ── طابور المحتوى الاجتماعي (يغذي مسودة النشرة) ── */
  const queue: Record<string, Raw> = {}
  articles.slice(0, 8).forEach((a, i) => {
    queue[`q${i}`] = {
      articleTitle: a.title, articleSlug: a.slug, source: 'article', status: i < 2 ? 'draft' : i < 5 ? 'approved' : 'published', createdAt: ts(now - (i * 4 + 1) * DAY),
      posts: {
        newsletter: `${a.title}\n\n${a.excerpt}\n\nفي هذا العدد نتوقف عند فكرةٍ واحدة تستحق التأمل، ثم نقترح ثلاث قراءات قصيرة تعمّقها، وسؤالاً تفتح به نقاشاً في صفّك أو في بيتك هذا الأسبوع.\n\nاقرأ المقال كاملاً على الموقع.`,
        x: `${a.title} — ${a.excerpt.slice(0, 140)}`, linkedin: `${a.title}\n\n${a.excerpt}`, instagram: a.excerpt.slice(0, 180),
      },
    }
  })
  out.social_queue = queue

  /* ── صحة الموقع والتقارير الشهرية ── */
  const health: Record<string, Raw> = {}
  for (let i = 0; i < 10; i++) {
    const d = kuwaitDay(now - i * DAY)
    health[d] = { date: d, status: i === 0 || i === 4 ? 'تنبيه' : 'سليم', issueCount: i === 0 ? 2 : i === 4 ? 1 : 0, issues: i === 0 ? ['مصدر خارجي يتأخر في الاستجابة: aljarida.com', 'رابط مرجعي واحد يحتاج مراجعة في مقال قديم'] : i === 4 ? ['صورة غلاف تتجاوز الحجم الموصى به'] : [] }
  }
  health.sources = {
    checkedAt: new Date(now - 3 * 3600_000).toISOString(), total: 64, places: 41, ok: 61, problems: 0, warnings: 3,
    items: [
      { url: 'https://www.aljarida.com/article/129142', state: 'timeout', status: 0, note: 'لم يكتمل الفحص خلال المهلة', advice: 'أعد الفحص لاحقاً؛ الموقع يستجيب ببطء.', owned: false, places: [{ kind: 'article', title: articles[0].title, slug: articles[0].slug, where: 'المصدر' }] },
      { url: 'https://example.org/reports/digital-learning-2025', state: 'suspect', status: 403, note: 'الخادم يرفض الفاحص الآلي', advice: 'افتح الرابط يدوياً للتأكد.', owned: false, places: [{ kind: 'paper', title: 'ورقة تجريبية', slug: 'demo', where: 'المراجع' }] },
      { url: 'https://example.org/archive/old-page', state: 'unreachable', status: 0, note: 'تعذّر الوصول إلى النطاق', advice: 'تحقق لاحقاً أو استبدل المرجع.', owned: false, places: [{ kind: 'article', title: articles[3].title, slug: articles[3].slug, where: 'نص المقال' }] },
    ],
  }
  out.site_health = health
  const reports: Record<string, Raw> = {}
  for (let m = 0; m < 5; m++) {
    const dt = new Date(now); dt.setUTCMonth(dt.getUTCMonth() - m)
    const period = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
    const total = Math.round(9800 - m * 900 + r() * 400)
    reports[period] = {
      period, monthlyTotal: total, lifetimeTotal: 61400 + (4 - m) * 7000, notification: `بلغت مشاهدات ${period} ما مجموعه ${total}، بزيادة ملحوظة في صفحات المقالات والكتب.`,
      days: Array.from({ length: 28 }, (_, d) => ({ date: `${period}-${String(d + 1).padStart(2, '0')}`, count: Math.round(total / 30 * (0.7 + r() * 0.7)) })),
      topArticles: articles.slice(0, 5).map((a, i) => ({ path: `/articles/${a.slug}`, slug: a.slug, title: a.title, count: Math.round(900 / (1 + i * 0.6)) })),
      trend: { firstHalf: Math.round(total * 0.46), secondHalf: Math.round(total * 0.54), direction: 'up', changePercent: 8 + m },
    }
  }
  out.admin_reports = reports

  /* ── أحداث استخدام الأدوات الإدارية ── */
  const tools = ['dashboard', 'articles', 'studio', 'analytics', 'inbox', 'design', 'audio-library', 'social-posts', 'style-checker', 'lab']
  const evs: Record<string, Raw> = {}
  let k = 0
  for (let d = 0; d < 90; d++) for (let j = 0; j < 7; j++) {
    const tool = tools[Math.floor(r() * tools.length)]
    const names = ['admin_tool_opened', 'admin_task_started', 'admin_result_generated', 'admin_result_accepted', 'admin_result_edited', 'admin_result_rejected', 'admin_result_converted', 'admin_task_abandoned', 'admin_result_generated', 'admin_result_accepted']
    evs[`e${k++}`] = { name: names[Math.floor(r() * (j < 2 ? 1 : names.length))], tool, sessionId: `s-${d}-${Math.floor(j / 3)}`, createdAt: ts(now - d * DAY - j * 2400_000), props: { tool }, durationMs: 20_000 + Math.round(r() * 240_000), taskId: `t-${d}-${Math.floor(j / 3)}`, result: j > 3 ? 'accepted' : '' }
  }
  const recTypes = ['اقتراح عنوان', 'مقال مجدول للنشر', 'تغريدة من المقال', 'وسم مقترح', 'مراجعة مصدر']
  for (let i = 0; i < 70; i++) {
    evs[`e${k++}`] = { name: r() < 0.55 ? 'admin_recommendation_used' : 'admin_recommendation_ignored', tool: tools[i % tools.length], taskType: recTypes[i % recTypes.length], sessionId: `rec-${i}`, createdAt: ts(now - (i % 28) * DAY - i * 600_000), props: {}, durationMs: 0 }
  }
  out.admin_tool_events = evs

  /* ── شهادات القرّاء + محتوى الصفحات العامة الحي ── */
  const tm: Record<string, Raw> = {}
  ;[
    'جملتك «التعليم صناعة معنى لا تلقين معلومات» غيّرت طريقتي في تحضير الدروس هذا الفصل، وصرت أبدأ بالسؤال لا بالشرح.',
    'مقالاتك تكتب بهدوء وعمق، وأجد فيها ما أقوله لأولياء الأمور ولا أحسن صياغته. شكراً لهذا الصفاء.',
    'استمعت لقراءة المقال بصوت نورة أثناء الطريق إلى العمل، وكانت أجمل بداية ليوم دراسي طويل.',
    'الموسوعة صارت مرجعاً أساسياً لطلبتي في مقرر تكنولوجيا التعليم؛ أسلوبها قريب وغير مثقل بالمصطلحات.',
    'أكثر ما أحببته أن الموقع لا يستعجلني، بل يتركني أفكر مع الفكرة قبل أن يعرض الفكرة التالية.',
  ].forEach((quote, i) => { tm[`t${i}`] = { quote, status: 'published', published: true, anonymous: true, source: 'approved_message', createdAt: ts(now - (i * 9 + 3) * DAY) } })
  out.site_testimonials = tm

  const radar: Record<string, Raw> = {}
  ;[
    ['الذكاء الاصطناعي التوليدي في الفصول: بين الحماس والحذر', 'Generative AI in classrooms: between enthusiasm and caution', 'UNESCO', 'https://www.unesco.org/en/digital-education', 'الخلاصة أن الأداة تنفع حين يسبقها سؤال تربوي واضح، وتضر حين تُستعمل بديلاً عن تفكير الطالب.', 'The takeaway: the tool helps when a clear pedagogical question comes first, and harms when it replaces the learner thinking.'],
    ['دراسة جديدة: القراءة الصوتية ترفع الفهم لدى الطلاب المترددين', 'New study: audio reading lifts comprehension for hesitant readers', 'Educational Research Review', 'https://www.sciencedirect.com/journal/educational-research-review', 'نتيجة تدعم تقديم المقال مسموعاً إلى جانب المكتوب، خاصة لمن يتعثر في القراءة الطويلة.', 'A result that supports offering articles in audio next to text, especially for readers who struggle with long reading.'],
    ['لماذا تفشل أغلب مشاريع التحول الرقمي في المدارس؟', 'Why most school digital transformation projects fail', 'OECD', 'https://www.oecd.org/education/', 'السبب المتكرر ليس نقص الأجهزة بل غياب تدريب المعلم ووقته لتجربة الأدوات.', 'The recurring cause is not a lack of devices but missing teacher training and time to try the tools.'],
    ['مدارس تعيد الاعتبار للكتابة بخط اليد', 'Schools restore the value of handwriting', 'EdSurge', 'https://www.edsurge.com/', 'عودة محسوبة لا حنين: الكتابة اليدوية تبطئ الطالب بما يكفي ليفهم ما يكتب.', 'A measured return, not nostalgia: handwriting slows the learner just enough to understand what is written.'],
    ['تقرير: مهارات المعلم الرقمي في دول الخليج', 'Report: digital teacher skills in the Gulf', 'World Bank', 'https://www.worldbank.org/en/topic/education', 'يربط التقرير بين الترقية والكفاءة الرقمية، وهو نقاش مطروح في أكثر من وزارة.', 'The report links promotion to digital competence, a debate open in more than one ministry.'],
    ['التعلم المصغّر: متى ينفع ومتى يضر؟', 'Microlearning: when it helps and when it harms', 'Journal of Learning Design', 'https://www.jld.edu.au/', 'ينفع في المهارات الإجرائية ويضعف حين يُطلب منه بناء فهم مركّب متدرّج.', 'Works for procedural skills and weakens when asked to build layered understanding.'],
    ['تجربة مدرسية: خمس دقائق تأمل في نهاية الحصة', 'School experiment: five minutes of reflection at the end of class', 'Teaching Today', 'https://www.example.org/teaching-today/reflection', 'عادة صغيرة تتفق مع ما نكرره: سؤال واحد في آخر الحصة يكشف الفهم أكثر من اختبار كامل.', 'A small habit consistent with what we keep saying: one end-of-class question reveals more than a full test.'],
    ['جامعات تعيد تعريف الغش في زمن الأدوات التوليدية', 'Universities redefine cheating in the age of generative tools', 'Times Higher Education', 'https://www.timeshighereducation.com/', 'يتجه النقاش من المنع إلى إعادة تصميم التقييم بحيث يظهر مسار التفكير لا الناتج وحده.', 'The debate shifts from prohibition to redesigning assessment so the thinking path shows, not just the output.'],
    ['بيانات جديدة عن قلق الامتحانات لدى طلبة المرحلة الثانوية', 'New data on exam anxiety among secondary students', 'Journal of School Psychology', 'https://www.example.org/jsp/exam-anxiety', 'الأرقام تؤكد أثر التوقعات المرتفعة، وتدعم تخفيف الضغط ليلة الاختبار.', 'The figures confirm the effect of high expectations and support easing pressure the night before exams.'],
    ['مبادرة لتدريب المعلمين على تقييم المخرجات المولَّدة آلياً', 'Initiative trains teachers to assess machine-generated work', 'Digital Promise', 'https://www.digitalpromise.org/', 'تدريب عملي قصير يبدأ بأسئلة الفهم قبل أدوات الكشف، وهو توجّه أقرب إلى روح التعلم.', 'Short practical training that starts with comprehension questions before detection tools, closer to the spirit of learning.'],
    ['حين يصبح المعلم مصمم تجربة لا ناقل معلومة', 'When the teacher becomes an experience designer, not an information carrier', 'Harvard Graduate School of Education', 'https://www.gse.harvard.edu/', 'قراءة هادئة لدور المعلم في زمن وفرة المعلومات: الاختيار والترتيب والسؤال.', 'A calm reading of the teacher role in an age of information abundance: selecting, sequencing, and asking.'],
    ['استطلاع: ما الذي يريده أولياء الأمور من المدرسة الرقمية؟', 'Survey: what do parents want from the digital school?', 'Pew Research Center', 'https://www.pewresearch.org/', 'يتصدر المطلبَ وضوحُ التواصل مع المعلم، لا كثرة المنصات.', 'Clear communication with the teacher tops the demand, not the number of platforms.'],
    ['أبحاث الانتباه: لماذا يتعثر الطالب بعد المقطع الثالث؟', 'Attention research: why learners stall after the third clip', 'Learning and Instruction', 'https://www.example.org/li/attention', 'تكشف الدراسة أن التوقف القصير بسؤال يعيد الانتباه أكثر من تقصير المحتوى.', 'The study suggests a short pause with a question restores attention more than shortening content.'],
    ['مدرسة تجرّب يوماً أسبوعياً بلا شاشات', 'A school tries one screen-free day a week', 'BBC Education', 'https://www.bbc.com/news/education', 'تجربة صغيرة تُقرأ بحذر: الأثر ظاهر في الحوار الصفي لكن العينة محدودة.', 'A small experiment to read with caution: the effect shows in class dialogue but the sample is limited.'],
  ].forEach(([ar, en, source, url, arNote, enNote], i) => {
    radar[`r${i}`] = { ar, en, arNote, enNote, source, url, day: kuwaitDay(now - (i * 4 + 1) * DAY), status: 'published', translationStatus: 'reviewed', createdAt: ts(now - (i * 4 + 1) * DAY) }
  })
  out.site_radar = radar

  const up: Record<string, Raw> = {}
  ;[
    ['ورشة: الذكاء الاصطناعي في التقييم التربوي', 'كلية التربية الأساسية', 'الكويت — قاعة المؤتمرات', 21, '6:00 م', 'ورشة'],
    ['محاضرة افتتاحية: المعلم الرقمي والمدرسة القادمة', 'جمعية المعلمين (جهة تجريبية)', 'الكويت — مركز المعارض', 47, '10:00 ص', 'محاضرة'],
    ['مؤتمر التعلم الرقمي في الخليج', 'مؤتمر تجريبي', 'الدوحة — عن بُعد متاح', 78, '9:00 ص', 'مؤتمر'],
    ['لقاء مفتوح مع طلبة الدراسات العليا', 'قسم تكنولوجيا التعليم', 'الكويت — الجامعة', 104, '12:30 م', 'لقاء'],
  ].forEach(([title, org, place, d, time, kind], i) => {
    const t = now + Number(d) * DAY
    up[`u${i}`] = { title, org, place, date: new Intl.DateTimeFormat('ar-KW-u-nu-latn', { dateStyle: 'long', timeZone: 'Asia/Kuwait' }).format(new Date(t)), iso: kuwaitDay(t), time, kind, url: 'https://example.com/register', status: 'published', published: true, createdAt: ts(now - i * DAY) }
  })
  out.site_upcoming = up

  const qs: Record<string, Raw> = {}
  ;[
    ['هل يصنع الجهاز طالباً أقدر على التفكير، أم يصنع طالباً أسرع في الوصول إلى الإجابة؟', 'السؤال الأدق: ماذا يفعل الطالب بالوقت الذي وفّره الجهاز؟', 'التقنية تعفي الطالب من الحفظ لكنها لا تعفيه من الفهم.'],
    ['متى يصبح الامتحان هدفاً بدل أن يكون وسيلة؟', 'حين تتحول الدرجة إلى لغة وحيدة يتفاهم بها البيت والمدرسة.', 'اجعلوا الدرجة جزءاً من الحديث لا كل الحديث.'],
    ['ما الذي يخسره الصفّ حين يخاف الجميع من الخطأ؟', 'يخسر الأسئلة غير المكتملة، وهي أجمل ما في التعلم.', 'احتفوا بالخطأ المفيد قبل الصواب السريع.'],
  ].forEach(([ar, arNote, take], i) => { qs[`qq${i}`] = { ar, q: ar, question: ar, arNote, take, status: 'published', published: true, createdAt: ts(now - (i * 7 + 2) * DAY) } })
  out.site_questions = qs

  const faqs: Record<string, Raw> = {}
  ;[
    ['كيف أستفيد من الموقع إن كنت معلماً؟', 'ابدأ بالمقالات القصيرة ثم انتقل إلى مسارات الفكرة؛ كل مسار يجمع المقال والكتاب والبحث في رحلة واحدة.'],
    ['هل يمكن الاقتباس من المقالات؟', 'نعم، مع ذكر المصدر ورابط المقال. زر «انسخ الاستشهاد» يجهّز لك الصيغة المناسبة.'],
    ['كيف أطلب محاضرة أو ورشة؟', 'عبر صفحة التواصل، اختر «محاضرة أو ورشة» واذكر الجهة والموعد التقريبي.'],
  ].forEach(([q, a], i) => { faqs[`f${i}`] = { q, a, question: q, answer: a, status: 'published', published: true, createdAt: ts(now - i * 10 * DAY) } })
  out.site_faqs = faqs

  const inbox: Record<string, Raw> = {}
  ;[
    ['رسالة من معلمة', 'أخبرتني أن فقرة «الصف الذي يخاف الخطأ» غيّرت طريقتها في تصحيح الواجبات.', 'سعدت بهذا الأثر؛ التغيير الصغير في التصحيح يغيّر شعور الطالب كله.'],
    ['رسالة من ولي أمر', 'سأل كيف يخفف قلق الامتحانات عن ابنه قبل النهائيات.', 'اجعلوا الليلة السابقة للامتحان ليلة هادئة، لا ليلة مراجعة أخيرة.'],
    ['رسالة من طالب دراسات عليا', 'يسأل عن مصادر بداية البحث في التحول الرقمي.', 'ابدأ بقراءة الأوراق الثلاث في صفحة الأبحاث ثم اتبع الإحالات.'],
  ].forEach(([title, message, reply], i) => { inbox[`i${i}`] = { title, message, reply, note: reply, tone: 'warm', status: 'published', published: true, createdAt: ts(now - (i * 5 + 1) * DAY) } })
  out.site_inbox = inbox

  /* ── تظليلات القراء (نبض القارئ ورنين القرّاء): إزاحات حقيقية داخل متون المقالات ── */
  const hl: Record<string, Raw> = {}
  let hn = 0
  articles.slice(0, 40).forEach((a, i) => {
    const body = (bodies as Record<string, string>)[a.slug]
    if (!body) return
    const paras = body.split('\n\n')
    let made = 0
    for (let pi = 0; pi < Math.min(paras.length, 6) && made < 3; pi++) {
      const para = paras[pi]
      const m = /[^.!؟?…\n]{40,200}[.!؟?…]/.exec(para)
      if (!m) continue
      hl[`h${hn++}`] = { slug: a.slug, articleVersion: 'demo', paragraph: pi, paragraphId: String(pi), startOffset: m.index, endOffset: m.index + m[0].length, count: Math.max(3, Math.round(34 / (1 + i * 0.4) + r() * 6) - made * 3), createdAt: ts(now - (i + made) * DAY) }
      made++
    }
  })
  out.article_highlights = hl

  /* ── إعدادات الموقع ── */
  out.site_settings = {
    launch: { enabled: false, kind: 'article', slug: articles[0].slug, eyebrow: 'جديد هذا الأسبوع', note: 'مقال جديد يستحق القراءة', until: new Date(now + 3 * DAY).toISOString() },
    cv: {},
    audio_inventory: audioInventory(now),
  }
  /* ── آخر ما نُشر في المجموعات الحية: يغذّي بطاقة «الصحة والتزامن»؛ الحقول minimal فلا تغيّر المحتوى الثابت ── */
  const live = (rows: { slug: string; title: string }[], offset: number) => Object.fromEntries(rows.slice(0, 2).map((row, i) => [row.slug, { slug: row.slug, title: row.title, status: 'published', published: true, createdAt: ts(now - (offset + i * 3 + 5) * DAY), updatedAt: ts(now - (offset + i * 3) * DAY) }]))
  out.site_articles = live(articles, 1)
  out.site_books = live(books as any, 2)
  out.site_papers = live(papers as any, 3)
  out.bot_messages = {}
  return out
}
