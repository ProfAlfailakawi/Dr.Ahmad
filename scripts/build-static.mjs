#!/usr/bin/env node
/**
 * بعد `vite build` — يولّد:
 *   1) صفحة HTML ثابتة لكل مسار مع وسوم SEO و OG و Schema صحيحة
 *      (روبوتات واتساب/تويتر/غوغل لا تشغّل JS — هذا ما يجعلها تراك)
 *   2) sitemap.xml
 *   3) feed.xml  (RSS)
 *   4) 404.html
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')
if (!existsSync(DIST)) { console.error('✘ شغّل `npm run build` أولاً.'); process.exit(1) }

/* لا نسمح ببناء ينسخ أصواتاً لا يعرفها bundle. لأن Vite يعمل قبل هذا
   السكربت، فالحل الآمن عند الاختلاف هو إيقاف البناء وطلب المزامنة ثم الإعادة. */
const audioCheck = spawnSync(process.execPath, [resolve(ROOT, 'scripts/sync-audio.mjs'), '--check'], {
  cwd: ROOT,
  encoding: 'utf8',
})
if (audioCheck.status !== 0) {
  console.error(audioCheck.stderr.trim() || 'audio.json غير متزامن')
  console.error('شغّل: node scripts/sync-audio.mjs ثم أعد npm run build')
  if (process.env.CI === 'true') {
    console.warn('⚠️ تم تجاوز الخطأ لأننا في بيئة بناء متواصل (CI). سنكمل البناء.')
  } else {
    process.exit(1)
  }
}

try { process.loadEnvFile(resolve(ROOT, '.env')) } catch { /* .env اختياري */ }
// النطاق المركزي نفسه الذي يقرؤه العميل (VITE_SITE_URL) — canonical/OG/RSS/sitemap/robots كلها منه.
const OFFICIAL_SITE = 'https://dr-alfailakawi.com'
const SITE = (process.env.VITE_SITE_URL || OFFICIAL_SITE).replace(/\/+$/, '')
if (SITE !== OFFICIAL_SITE) {
  console.error(`✘ VITE_SITE_URL يجب أن يكون ${OFFICIAL_SITE} فقط، والقيمة الحالية: ${SITE}`)
  process.exit(1)
}
const AUDIO_PUBLIC_BASE_URL = (process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const SITE_HOST = new URL(SITE).hostname
const AUTHOR = 'د. أحمد حسين الفيلكاوي'
// كيان الهوية المركزي (Person) — يُربط عبر @id في كل Schema، فيبني غوغل كِيان المؤلف الواحد
const PERSON = {
  '@type': 'Person',
  '@id': `${SITE}/#person`,
  name: AUTHOR,
  alternateName: 'Dr. Ahmad H. Alfailakawi',
  url: SITE,
  image: `${SITE}/og.png`,
  description: 'أستاذ تكنولوجيا التعليم والذكاء الاصطناعي، كاتب وباحث ومستشار تربوي كويتي.',
  jobTitle: 'أستاذ تكنولوجيا التعليم والذكاء الاصطناعي، كاتب وباحث ومستشار تربوي كويتي',
  affiliation: [
    { '@type': 'CollegeOrUniversity', name: 'كلية التربية الأساسية — الهيئة العامة للتعليم التطبيقي والتدريب (PAAET)' },
    { '@type': 'CollegeOrUniversity', name: 'جامعة الكويت' },
  ],
  alumniOf: { '@type': 'CollegeOrUniversity', name: 'University of Northern Colorado' },
  sameAs: [
    'https://scholar.google.com/citations?user=WVAtInIAAAAJ&hl=en',
    'https://www.researchgate.net/profile/Ahmad-Alfailakawi',
  ],
}
const PUBLISHER = { '@type': 'Person', '@id': `${SITE}/#person`, name: AUTHOR, description: PERSON.description }
const podcastStatePath = resolve(ROOT, '.podcast-state.json')
const hasPodcastState = existsSync(podcastStatePath)
const podcastState = hasPodcastState ? JSON.parse(readFileSync(podcastStatePath, 'utf8')) : { done: {} }
const audioMetaPath = resolve(ROOT, 'src/data/audio-meta.json')
const audioMeta = AUDIO_PUBLIC_BASE_URL && existsSync(audioMetaPath) ? JSON.parse(readFileSync(audioMetaPath, 'utf8')) : {}
const sha256File = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const acceptedArabicDialogue = (slug, audioFile, transcriptFile = '') => {
  const accepted = podcastState?.done?.[`${slug}:ar`]
  if (!accepted || typeof accepted !== 'object' || accepted.status !== 'accepted_automated') return false
  const audioName = `${slug}.dialogue.mp3`
  const transcriptName = `${slug}.dialogue.json`
  const localAudioOk = Boolean(audioFile && existsSync(audioFile) && accepted.audioHash && sha256File(audioFile) === accepted.audioHash)
  const externalAudioOk = Boolean(AUDIO_PUBLIC_BASE_URL && audioMeta?.[audioName]?.sha256
    && audioMeta[audioName].sha256 === accepted.audioHash && Number(audioMeta[audioName].bytes || 0) >= 200_000)
  if (!localAudioOk && !externalAudioOk) return false
  if (transcriptFile) {
    const localTranscriptOk = Boolean(existsSync(transcriptFile) && accepted.transcriptHash
      && sha256File(transcriptFile) === accepted.transcriptHash)
    const externalTranscriptOk = Boolean(AUDIO_PUBLIC_BASE_URL && audioMeta?.[transcriptName]?.sha256
      && audioMeta[transcriptName].sha256 === accepted.transcriptHash && Number(audioMeta[transcriptName].bytes || 0) > 100)
    if (!localTranscriptOk && !externalTranscriptOk) return false
  }
  return true
}
const visibleDialogueAsset = (slug, audioFile, transcriptFile = '') =>
  acceptedArabicDialogue(slug, audioFile, transcriptFile)
const audioPublicUrl = (rel) => AUDIO_PUBLIC_BASE_URL ? `${AUDIO_PUBLIC_BASE_URL}/${rel}` : `${SITE}/audio/${rel}`
const src = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
const srcEn = readFileSync(resolve(ROOT, 'src/data-en.ts'), 'utf8')
const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const attr = (s = '') => esc(s).replace(/'/g, '&#39;')

/* ---------- قراءة البيانات من data.ts ---------- */
const grab = (name) => (src.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\n\\]`)) || [])[1] || ''
const grabObject = (source, name) => (source.match(new RegExp(`export const ${name}[^{]*= \\{([\\s\\S]*?)\\n\\}`)) || [])[1] || ''
const paperTitlesEn = Object.fromEntries([...grabObject(srcEn, 'paperTitlesEn').matchAll(/'([^']+)':\s*\n?\s*'([^']+)'/g)]
  .map((m) => [m[1], m[2].replace(/\\'/g, "'")]))

const articles = [...grab('articles').matchAll(
  /\{ slug: '([^']+)', title: '([^']+)', date: '([^']*)', iso: '([^']*)', cat: '([^']*)',\s*excerpt: '([^']*)'/g
)].map((m) => ({ slug: m[1], title: m[2].replace(/\\'/g, "'"), date: m[3], iso: m[4], cat: m[5], excerpt: m[6].replace(/\\'/g, "'") }))

const books = [...grab('books').matchAll(/\{ slug: '([^']+)'[\s\S]*?title: '([^']+)'[\s\S]*?isbn: '([^']*)'[\s\S]*?cover: '([^']*)'[\s\S]*?pdf: '([^']*)'[\s\S]*?desc: '([^']*)'/g)]
  .map((m) => ({ slug: m[1], title: m[2], isbn: m[3], cover: m[4], pdf: m[5], desc: m[6] }))

const papers = [...grab('papers').matchAll(/slug: '([^']+)',[^\n]*?title: '([^']+)',[^\n]*?meta: '([^']*)',[^\n]*?abstractAr: '([^']*)'/g)]
  .map((m) => ({ slug: m[1], title: paperTitlesEn[m[1]] || m[2], desc: m[3], abstractAr: m[4].replace(/^ملخص عربي:\s*/, '') }))

const media = [...grab('media').matchAll(/\{ title: '([^']+)', outlet: '([^']*)', url: '([^']*)'/g)]
  .map((m, index) => {
    const id = (m[3].match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/) || [])[1] || String(index + 1)
    return { slug: `media-${id}`, title: m[1], outlet: m[2], url: m[3] }
  })

const siteArticlesFeedPath = resolve(ROOT, 'src/data/site-articles-feed.json')
const siteArticlesFeed = existsSync(siteArticlesFeedPath)
  ? JSON.parse(readFileSync(siteArticlesFeedPath, 'utf8')).filter((item) => item?.slug && item?.title && item?.iso)
  : []

/* أعداد وسنوات تُحسب من المحتوى — تتجدّد أوصاف SEO تلقائياً مع أي إضافة */
const artYears = articles.map((a) => Number(a.iso.slice(0, 4))).filter((y) => y >= 1990)
const firstYear = artYears.length ? Math.min(...artYears) : new Date().getFullYear()
const nArticles = Math.floor(articles.length / 10) * 10   // «أكثر من ١٦٠»
const nBooks = books.length
const nPapers = papers.length

const STATIC = [
  { path: '/', title: 'د. أحمد حسين الفيلكاوي — أستاذ تكنولوجيا التعليم والذكاء الاصطناعي', desc: `الموقع الرسمي للدكتور أحمد حسين الفيلكاوي، أستاذ تكنولوجيا التعليم والذكاء الاصطناعي، والكاتب والباحث والمستشار التربوي الكويتي. ${nBooks} كتب، ${nPapers} بحثاً محكّماً، وأكثر من ${nArticles} مقالاً فكرياً منذ ${firstYear}.` },
  { path: '/publications', title: 'الكتب المنشورة', desc: `كتب د. أحمد حسين الفيلكاوي في التعليم وتكنولوجيا التعليم والذكاء الاصطناعي والتحول المجتمعي.` },
  { path: '/research', title: 'المساهمات العلمية', desc: `أبحاث د. أحمد حسين الفيلكاوي المحكمة في تكنولوجيا التعليم والتعلم الإلكتروني والذكاء الاصطناعي.` },
  { path: '/articles', title: 'مقالاتي الفكرية', desc: `مقالات د. أحمد حسين الفيلكاوي الفكرية في التعليم والتقنية والمجتمع، منذ ${firstYear}.` },
  { path: '/atlas', title: 'سماء المقالات', desc: `خريطة بصرية لأكثر من ${nArticles} مقالاً عبر السنوات.` },
  { path: '/media', title: 'الظهور الإعلامي', desc: 'لقاءات تلفزيونية وإذاعية.' },
  { path: '/questions', title: 'سؤال يُقلق التعليم', desc: 'زاوية متجددة: سؤال جديد كل يومين يوقظ التفكير في التعليم — بالعربية والإنجليزية.' },
  { path: '/radar', title: 'أرشيف الرادار', desc: 'كل ما التقطه الرادار من مصادر موثوقة — حصاد أسبوعي مؤرشف كمرجع بحثي، بالعربية والإنجليزية.' },
  { path: '/upcoming', title: 'اللقاءات القادمة', desc: 'محاضرات وورش عمل ومؤتمرات قادمة.' },
  { path: '/curated', title: 'من اختياراتي', desc: 'كتاب، ومقالة، وأداة، واقتباس — مساحة تتجدّد.' },
  { path: '/inbox', title: 'رسائل على الهامش', desc: 'رسائل قصيرة تفتح زاوية جديدة، ومختارات وأسئلة من التعليم والتربية والتقنية.' },
  { path: '/cv', title: 'السيرة الأكاديمية', desc: 'التعليم والخبرات والعضويات والمؤتمرات.' },
  { path: '/about', title: 'حول الموقع', desc: 'فضاءٌ مُنتقى بعناية… حيث لكل قسم غاية، ولكل اختيار فلسفة.' },
  { path: '/contact', title: 'للاستشارة أو التعاون', desc: 'استشارات ومحاضرات ومشاريع تحوّل رقمي.' },
  { path: '/privacy', title: 'سياسة الخصوصية', desc: 'سياسة الخصوصية للموقع الرسمي وأداة Dr Alfailakawi Publishing وربط Meta وLinkedIn.', robots: 'noindex, nofollow' },
  { path: '/terms', title: 'شروط الاستخدام', desc: 'شروط استخدام الموقع وأداة إدارة المحتوى والنشر على المنصات المرتبطة.', robots: 'noindex, nofollow' },
  { path: '/data-deletion', title: 'تعليمات حذف البيانات', desc: 'تعليمات إلغاء الربط وطلب حذف بيانات Facebook وInstagram وLinkedIn.', robots: 'noindex, nofollow' },
  { path: '/ask', title: 'العقل الحي', desc: 'اسأل سؤالاً حقيقياً، فيبني الموقع إجابة موثقة من أرشيف د. أحمد حسين الفيلكاوي فقط: مقالات، تطور زمني، ومصادر.' },
  { path: '/decade', title: 'وثيقة العقد', desc: 'سيرة فكرية حيّة تقرأ عشر سنوات من الكتابة وتكشف تحولات الأسئلة والموضوعات الأكثر إلحاحاً.' },
  { path: '/thought-paths', title: 'مسار الفكرة', desc: 'رحلات تربط المقال بالسؤال والبحث والكتاب واللقاء لتكشف كيف تطورت الفكرة عبر السنوات.' },
  { path: '/search', title: 'البحث العميق', desc: 'بحث متقدم في عناوين المقالات ونصوصها وتصنيفاتها وسنواتها.' },
  { path: '/admin', title: 'لوحة التحكم', desc: 'لوحة إدارة خاصة.', robots: 'noindex, nofollow' },
  /* المرآة الإنجليزية */
  { path: '/en', title: 'Dr. Ahmad H. Alfailakawi — Professor of Educational Technology & AI', desc: 'Official website of Dr. Ahmad H. Alfailakawi, Professor of Educational Technology and Artificial Intelligence in Kuwait. Nine books, eighteen peer-reviewed papers, and over 160 essays since 2016.', lang: 'en' },
  { path: '/en/cv', title: 'Curriculum Vitae', desc: 'Education, academic appointments, advisory roles and international memberships of Dr. Ahmad H. Alfailakawi.', lang: 'en' },
  { path: '/en/research', title: 'Research', desc: 'Eighteen peer-reviewed papers on educational technology, e-learning systems and emerging technologies in higher education.', lang: 'en' },
]

const routes = [
  ...STATIC,
  ...books.map((b) => ({ path: `/publications/${b.slug}`, title: b.title, desc: b.desc, image: b.cover, isbn: b.isbn })),
  ...papers.map((p) => ({ path: `/research/${p.slug}`, title: p.title, desc: p.abstractAr || `بحث محكّم — ${p.desc}`, type: 'article' })),
  ...articles.map((a) => ({ path: `/articles/${a.slug}`, title: a.title, desc: a.excerpt, type: 'article', iso: a.iso, cat: a.cat, image: `/og/articles/${a.slug}.svg` })),
  ...siteArticlesFeed.map((a) => ({ path: `/articles/${a.slug}`, title: a.title, desc: a.excerpt || a.title, type: 'article', iso: a.iso, cat: a.cat || 'مقال', image: `/og/articles/${a.slug}.svg` })),
]

const LEGACY_REDIRECTS = [
  ['/articles/a-society-that-fears-the-different-scheduledarabbic', '/articles/a-society-that-fears-the-different-arabic'],
  ['/signature_articles/a-society-that-fears-the-different-scheduledarabbic', '/articles/a-society-that-fears-the-different-arabic'],
]

const uniqueRoutes = (items) => {
  const seen = new Set()
  return items.filter((item) => {
    const key = item.path.replace(/\/+$/, '') || '/'
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
const uniqueBySlug = (items) => {
  const seen = new Set()
  return items.filter((item) => {
    if (!item.slug || seen.has(item.slug)) return false
    seen.add(item.slug)
    return true
  })
}

/* ---------- حقن الوسوم ---------- */
const shell = readFileSync(resolve(DIST, 'index.html'), 'utf8')

function stripManagedHead(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']robots["'][^>]*>/gi, '')
    .replace(/<meta\s+(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+)["'][^>]*>/gi, '')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>/gi, '')
}

/* المرآة الإنجليزية — أزواج hreflang بين اللغتين.
   ما دام زرّها مخفياً (SHOW_EN_TOGGLE=false) تبقى صفحاتها noindex وبلا hreflang وخارج sitemap. */
const SHOW_EN = /export const SHOW_EN_TOGGLE = true/.test(src)
const LANG_PAIRS = SHOW_EN ? { '/': '/en', '/cv': '/en/cv', '/research': '/en/research' } : {}

const bodiesPath = resolve(ROOT, 'src/data/bodies.json')
const bodies = existsSync(bodiesPath) ? JSON.parse(readFileSync(bodiesPath, 'utf8')) : {}

const LEGAL_STATIC = {
  '/privacy': {
    arTitle: 'سياسة الخصوصية', enTitle: 'Privacy Policy',
    ar: [
      ['من نحن ونطاق السياسة', 'تنطبق هذه السياسة على الموقع الرسمي للدكتور أحمد حسين الفيلكاوي وأداة Dr Alfailakawi Publishing. وهي تغطي زيارة الموقع، رسائل التواصل، لوحة الإدارة، والربط الاختياري مع Meta وLinkedIn.'],
      ['البيانات التي قد نعالجها', 'قد نعالج الاسم والبريد ومحتوى الرسالة، بيانات تشغيل وأمان محدودة، تفضيلات محفوظة محلياً في المتصفح، بيانات مصادقة المسؤول، وعند ربط حساب اجتماعي: معرّفات الحساب أو الصفحة، الصلاحيات، رموز الوصول المشفرة، المحتوى المختار ونتيجة النشر.'],
      ['أغراض الاستخدام', 'نستخدم البيانات لتشغيل الموقع وتأمينه، الرد على الرسائل، تحسين الأداء، إنشاء محتوى أو صوت عند الطلب، وربط الحسابات والنشر فقط بعد موافقة مستخدم مخول.'],
      ['الخدمات التقنية', 'قد نستعين بـ Google Cloud وFirebase وGemini وMicrosoft Azure Speech وMeta وLinkedIn بالقدر اللازم للوظيفة المطلوبة. لا نبيع البيانات الشخصية ولا نؤجرها.'],
      ['الذكاء الاصطناعي', 'قد يرسل نص يختاره المسؤول إلى Gemini لتجهيز مسودة أو إلى Azure Speech لإنشاء صوت. يجب عدم إدخال أسرار أو بيانات حساسة، ومراجعة المخرجات قبل النشر.'],
      ['الاحتفاظ والحماية', 'نحتفظ بالبيانات للمدة اللازمة للتشغيل والأمان والالتزامات القانونية. تُحذف أو تُعطل رموز الوصول بعد فصل الحساب أو قبول طلب حذف موثق، مع احتمال بقاء نسخ محدودة مؤقتاً في النسخ الاحتياطية.'],
      ['حقوقك', 'يمكنك طلب الوصول أو التصحيح أو الحذف حيث ينطبق، وإلغاء صلاحيات Meta أو LinkedIn من إعدادات المنصة، ومسح بيانات الموقع المحلية من المتصفح.'],
      ['التواصل', 'لطلبات الخصوصية: ah.alfailakawi@paaet.edu.kw. آخر تحديث: 13 يوليو 2026.'],
    ],
    en: [
      ['Scope', 'This policy applies to the official website of Dr. Ahmad Hussein Alfailakawi and Dr Alfailakawi Publishing, including website visits, contact messages, authorized administration and optional Meta or LinkedIn connections.'],
      ['Data we may process', 'We may process submitted contact details, limited operational and security data, browser-local preferences, administrator authentication records and, when a social account is connected, account or Page identifiers, granted scopes, encrypted access tokens, selected content and publishing results.'],
      ['Purposes', 'Data is used to operate and secure the service, respond to inquiries, improve performance, generate content or audio when requested, and publish only after authorization.'],
      ['Providers', 'We may use Google Cloud, Firebase, Gemini, Microsoft Azure Speech, Meta and LinkedIn as necessary. We do not sell or rent personal data.'],
      ['AI', 'Text selected by an administrator may be sent to Gemini or Azure Speech. Do not submit secrets or sensitive personal information, and review all output before publication.'],
      ['Retention and security', 'We retain data only as reasonably necessary. Connection data and tokens are deleted or disabled after verified deletion or disconnection, subject to limited backup and security-log retention.'],
      ['Your choices', 'You may request access, correction or deletion where applicable, revoke platform permissions, and clear local website data through your browser.'],
      ['Contact', 'Privacy requests: ah.alfailakawi@paaet.edu.kw. Last updated: July 13, 2026.'],
    ],
  },
  '/terms': {
    arTitle: 'شروط الاستخدام', enTitle: 'Terms of Use',
    ar: [
      ['قبول الشروط', 'باستخدام الموقع أو أداة Dr Alfailakawi Publishing فإنك توافق على هذه الشروط وعلى شروط الخدمات الخارجية التي تختار ربطها.'],
      ['الخدمة', 'يوفر الموقع محتوى أكاديمياً وأداة لإدارة المقالات وتجهيز محتوى السوشيال وربط منصات النشر. لا تمثل المواد استشارة قانونية أو طبية أو مالية.'],
      ['الحسابات', 'يجب أن تكون مخولاً لربط الحساب أو الصفحة، وأن تحمي بيانات الدخول والأسرار، وألا تربط حساباً لا تملكه أو لا تديره.'],
      ['المراجعة قبل النشر', 'لا يُفترض نشر محتوى إلا بعد اختيار الوجهة واعتماد المحتوى من مستخدم مخول. المستخدم مسؤول عن الدقة والحقوق والالتزام بسياسة المنصة.'],
      ['الذكاء الاصطناعي', 'قد تحتوي المسودات على أخطاء. يجب مراجعة الحقائق والاستشهادات وحقوق النشر، وعدم إدخال معلومات سرية دون سلطة قانونية.'],
      ['الاستخدام المحظور', 'يُحظر الوصول غير المصرح، تجاوز الأمان، نشر محتوى غير قانوني أو مضلل، إساءة استخدام الرموز، أو تنفيذ رسائل مزعجة ونشر مخالف لسياسات المنصات.'],
      ['الخدمات الخارجية', 'قد تتغير Firebase وGemini وAzure وMeta وLinkedIn أو تتوقف أو تفرض حدوداً أو مراجعات أو أسعاراً. لا نضمن استمرار أي واجهة خارجية.'],
      ['القانون والتواصل', 'تخضع الشروط للقوانين السارية في دولة الكويت مع مراعاة الحقوق الإلزامية المنطبقة. التواصل: ah.alfailakawi@paaet.edu.kw. آخر تحديث: 13 يوليو 2026.'],
    ],
    en: [
      ['Acceptance', 'By using the website or Dr Alfailakawi Publishing, you accept these terms and the terms of any third-party service you choose to connect.'],
      ['Service', 'The website provides academic content and a tool for article management, social content preparation and publishing connections. Content is not legal, medical or financial advice.'],
      ['Accounts', 'You must be authorized to connect each account or Page, protect credentials and secrets, and never connect an account you do not own or administer.'],
      ['Approval before publishing', 'Content should be published only after an authorized user selects the destination and approves it. The user remains responsible for accuracy, rights and platform compliance.'],
      ['AI', 'AI drafts may contain errors. Facts, citations and rights must be reviewed, and confidential information must not be submitted without authority.'],
      ['Prohibited use', 'Unauthorized access, security bypass, unlawful or deceptive content, token misuse, spam and automation that violates platform rules are prohibited.'],
      ['Third-party services', 'Firebase, Gemini, Azure, Meta and LinkedIn may change, stop, impose limits, require review or change pricing. Continued API availability is not guaranteed.'],
      ['Law and contact', 'These terms are governed by applicable Kuwait law, subject to mandatory rights that may apply. Contact: ah.alfailakawi@paaet.edu.kw. Last updated: July 13, 2026.'],
    ],
  },
  '/data-deletion': {
    arTitle: 'تعليمات حذف البيانات', enTitle: 'Data Deletion Instructions',
    ar: [
      ['إلغاء صلاحية المنصة', 'يمكنك إزالة التطبيق من إعدادات التطبيقات والمواقع أو تكاملات الأعمال في Facebook وInstagram، أو من أذونات البيانات والخدمات المسموح بها في LinkedIn.'],
      ['إرسال طلب مباشر', 'أرسل إلى ah.alfailakawi@paaet.edu.kw بعنوان «طلب حذف بيانات التطبيق»، واذكر المنصة واسم الحساب أو الصفحة ورابط الملف أو المعرّف والبريد الذي يمكن الرد عليه. لا ترسل كلمة مرور أو App Secret أو Access Token.'],
      ['التحقق والتنفيذ', 'قد نطلب إثباتاً مناسباً لملكية الحساب دون طلب كلمة المرور. بعد التحقق نحذف أو نعطل رموز الوصول ومعرّفات الربط وبيانات الحساب وسجلات النشر القابلة للتحديد. تتم المعالجة عادة خلال 30 يوماً.'],
      ['حدود الحذف', 'حذف البيانات من خدمتنا لا يحذف منشوراً سبق نشره على منصة خارجية؛ احذفه من المنصة مباشرة. قد تبقى نسخة مؤقتة في نسخة احتياطية آمنة إلى أن تدور دورة النسخ الاعتيادية.'],
      ['التأكيد', 'نرسل تأكيداً عند إتمام المعالجة ما لم يمنع القانون أو الأمن ذلك. آخر تحديث: 13 يوليو 2026.'],
    ],
    en: [
      ['Revoke platform access', 'Remove the app from Apps and Websites or Business Integrations in Facebook and Instagram, or from permitted services and data permissions in LinkedIn.'],
      ['Send a direct request', 'Email ah.alfailakawi@paaet.edu.kw with the subject “App Data Deletion Request”. Include the platform, account or Page name, profile link or identifier and a reply email. Never send a password, App Secret or access token.'],
      ['Verification and action', 'We may request proportionate proof of account ownership without asking for a password. After verification, we delete or disable tokens, connection identifiers, stored account details and identifiable publishing logs. Requests are normally processed within 30 days.'],
      ['Deletion limits', 'Deleting data from our service does not remove a post already published on a third-party platform. Delete it directly on that platform. A limited backup copy may remain until routine backup rotation.'],
      ['Confirmation', 'We send confirmation after processing unless law or security prevents it. Last updated: July 13, 2026.'],
    ],
  },
}

function legalStaticHtml(path) {
  const doc = LEGAL_STATIC[path]
  if (!doc) return ''
  const sections = (items, dir) => items.map(([title, body]) => `
    <section style="padding:1.5rem 0;border-bottom:1px solid rgba(62,92,120,.12);text-align:${dir === 'rtl' ? 'right' : 'left'};">
      <h2 style="font-size:1.35rem;margin:0 0 .65rem;color:#15161A;">${esc(title)}</h2>
      <p style="margin:0;color:#3D4650;line-height:1.9;font-size:1rem;">${esc(body)}</p>
    </section>`).join('')
  return `
    <main style="max-width:900px;margin:4rem auto;padding:0 1rem;">
      <article dir="rtl" lang="ar" style="padding:2rem;border:1px solid rgba(62,92,120,.14);border-radius:18px;background:#fff;">
        <h1 style="font-size:2.4rem;margin:0 0 .5rem;color:#15161A;">${esc(doc.arTitle)}</h1>
        <p style="color:#626A76;margin:0 0 1rem;">آخر تحديث: 13 يوليو 2026</p>
        ${sections(doc.ar, 'rtl')}
      </article>
      <article dir="ltr" lang="en" style="margin-top:2rem;padding:2rem;border:1px solid rgba(62,92,120,.14);border-radius:18px;background:#F7F8F8;">
        <h1 style="font-size:2.2rem;margin:0 0 .5rem;color:#15161A;">${esc(doc.enTitle)}</h1>
        <p style="color:#626A76;margin:0 0 1rem;">Last updated: July 13, 2026</p>
        ${sections(doc.en, 'ltr')}
      </article>
    </main>`
}

function generateBodyHtml(path, lang = 'ar') {
  if (path === '/admin') {
    return `
      <main style="min-height:100vh;display:grid;place-items:center;background:#FCFCFA;padding:2rem;" dir="rtl">
        <div style="width:min(440px,100%);border:1px solid rgba(62,92,120,.14);border-radius:22px;background:#fff;padding:2rem;text-align:center;">
          <div style="width:42px;height:42px;margin:0 auto 1rem;border:2px solid rgba(62,92,120,.18);border-top-color:#3E5C78;border-radius:999px;animation:admin-spin .8s linear infinite;"></div>
          <p style="margin:0;color:#3E5C78;font:600 1rem 'Tajawal',sans-serif;">جاري فتح لوحة التحكم الآمنة…</p>
          <style>@keyframes admin-spin{to{transform:rotate(360deg)}}</style>
        </div>
      </main>`
  }

  const en = lang === 'en'
  const isAdmin = path === '/admin'
  // Header
  const headerHtml = en ? `
    <header style="border-bottom: 1px solid rgba(62, 92, 120, 0.1); padding: 1.5rem 1rem;">
      <div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div style="font-size: 1.5rem; font-weight: bold; color: #15161A;">د. أحمد حسين الفيلكاوي</div>
        <nav style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
          <a href="/en" style="color: #3E5C78; text-decoration: none; font-weight: 500;">Home</a>
          <a href="/en/cv" style="color: #3E5C78; text-decoration: none; font-weight: 500;">CV</a>
          <a href="/en/research" style="color: #3E5C78; text-decoration: none; font-weight: 500;">Research</a>
        </nav>
      </div>
    </header>
  ` : `
    <header style="border-bottom: 1px solid rgba(62, 92, 120, 0.1); padding: 1.5rem 1rem;" dir="rtl">
      <div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div style="font-size: 1.5rem; font-weight: bold; font-family: 'El Messiri', serif; color: #15161A;">د. أحمد حسين الفيلكاوي</div>
        <nav style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
          <a href="/" style="color: #3E5C78; text-decoration: none; font-weight: 500;">الرئيسية</a>
          <a href="/articles" style="color: #3E5C78; text-decoration: none; font-weight: 500;">المقالات</a>
          <a href="/publications" style="color: #3E5C78; text-decoration: none; font-weight: 500;">الكتب</a>
          <a href="/research" style="color: #3E5C78; text-decoration: none; font-weight: 500;">الأبحاث</a>
          <a href="/cv" style="color: #3E5C78; text-decoration: none; font-weight: 500;">السيرة</a>
          <a href="/about" style="color: #3E5C78; text-decoration: none; font-weight: 500;">حول</a>
          <a href="/contact" style="color: #3E5C78; text-decoration: none; font-weight: 500;">اتصل بي</a>
        </nav>
      </div>
    </header>
  `

  // Footer
  const footerHtml = en ? `
    <footer style="background: #111215; color: #EAEAE7; padding: 3rem 1rem; margin-top: 4rem; text-align: center;">
      <div style="max-width: 1200px; margin: 0 auto;">
        <p style="margin-bottom: 1rem; font-weight: bold;">د. أحمد حسين الفيلكاوي</p>
        <p style="color: #8AADCC; font-size: 0.9rem;">Professor of Educational Technology and Artificial Intelligence</p>
        <p style="margin-top: 1.25rem;">
          <a href="https://tebyan.dr-alfailakawi.com" target="_blank" rel="noopener noreferrer" title="تبيان — منصة عامة مستقلة" style="display: inline-flex; align-items: center; gap: .45rem; color: #8AADCC; font-size: .82rem; text-decoration: none;">
            <img src="/tebyan-icon.png" alt="" style="width: 20px; height: 20px; border-radius: 999px;" /> Tebyan ↗
          </a>
          <span style="display:inline-block; width: .75rem;"></span>
          <a href="https://schedule.dr-alfailakawi.com" target="_blank" rel="noopener noreferrer" title="برنامج الجدول الدراسي" style="display: inline-flex; align-items: center; gap: .35rem; color: #8AADCC; font-size: .76rem; text-decoration: none; opacity: .84;">
            <span style="display:inline-flex; width: 16px; height: 16px; align-items:center; justify-content:center; border: 1px solid currentColor; border-radius: 5px; font-size: 10px;">▦</span> Schedule ↗
          </a>
        </p>
        <p style="font-size: 0.8rem; color: #626A76; margin-top: 1.5rem;">&copy; ${new Date().getFullYear()} All Rights Reserved.</p>
      </div>
    </footer>
  ` : `
    <footer style="background: #111215; color: #EAEAE7; padding: 3rem 1rem; margin-top: 4rem; text-align: center;" dir="rtl">
      <div style="max-width: 1200px; margin: 0 auto;">
        <p style="margin-bottom: 1rem; font-weight: bold; font-family: 'El Messiri', serif; font-size: 1.25rem;">د. أحمد حسين الفيلكاوي</p>
        <p style="color: #8AADCC; font-size: 0.9rem;">أستاذ تكنولوجيا التعليم والذكاء الاصطناعي</p>
        <p style="margin-top: 1.25rem;">
          <a href="https://tebyan.dr-alfailakawi.com" target="_blank" rel="noopener noreferrer" title="تبيان — منصة عامة مستقلة" style="display: inline-flex; align-items: center; gap: .45rem; color: #8AADCC; font-size: .82rem; text-decoration: none;">
            <img src="/tebyan-icon.png" alt="" style="width: 20px; height: 20px; border-radius: 999px;" /> تبيان ↗
          </a>
          <span style="display:inline-block; width: .75rem;"></span>
          <a href="https://schedule.dr-alfailakawi.com" target="_blank" rel="noopener noreferrer" title="برنامج الجدول الدراسي" style="display: inline-flex; align-items: center; gap: .35rem; color: #8AADCC; font-size: .76rem; text-decoration: none; opacity: .84;">
            <span style="display:inline-flex; width: 16px; height: 16px; align-items:center; justify-content:center; border: 1px solid currentColor; border-radius: 5px; font-size: 10px;">▦</span> الجدول الدراسي ↗
          </a>
        </p>
        <p style="font-size: 0.8rem; color: #626A76; margin-top: 1.5rem;">&copy; ${new Date().getFullYear()} جميع الحقوق محفوظة.</p>
      </div>
    </footer>
  `

  let contentHtml = ''

  if (LEGAL_STATIC[path]) {
    contentHtml = legalStaticHtml(path)
  } else if (path === '/' || path === '/en') {
    if (en) {
      contentHtml = `
        <main style="max-width: 800px; margin: 4rem auto; padding: 0 1rem; text-align: center;">
          <h1 style="font-size: 3rem; margin-bottom: 1rem; font-weight: bold; color: #15161A;">I keep the human at the heart of the machine.</h1>
          <p style="font-size: 1.25rem; color: #626A76; line-height: 1.6; margin-bottom: 2rem;">
            Official website of Dr. Ahmad H. Alfailakawi, Professor of Educational Technology and Artificial Intelligence in Kuwait.
          </p>
          <div style="background: rgba(62, 92, 120, 0.05); padding: 2rem; border-radius: 8px; margin-bottom: 3rem; text-align: left;">
            <h2 style="font-size: 1.5rem; margin-bottom: 1rem; font-weight: bold; color: #3E5C78;">Academic Bio</h2>
            <p style="line-height: 1.7; color: #15161A;">
              Ph.D. in Education, Educational Technology major from University of Northern Colorado. Associate Professor at College of Basic Education (PAAET) and delegated professor at College of Education in Kuwait University. Expert and Consultant at Ministry of Information.
            </p>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 3rem;">
            <div style="padding: 1.5rem; border: 1px solid rgba(62, 92, 120, 0.1); border-radius: 6px;">
              <h3 style="font-size: 2rem; color: #3E5C78; font-weight: bold; margin-bottom: 0.5rem;">${nBooks}</h3>
              <p style="color: #626A76; font-size: 0.9rem; margin: 0;">Published Books</p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid rgba(62, 92, 120, 0.1); border-radius: 6px;">
              <h3 style="font-size: 2rem; color: #3E5C78; font-weight: bold; margin-bottom: 0.5rem;">${nPapers}</h3>
              <p style="color: #626A76; font-size: 0.9rem; margin: 0;">Peer-reviewed Papers</p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid rgba(62, 92, 120, 0.1); border-radius: 6px;">
              <h3 style="font-size: 2rem; color: #3E5C78; font-weight: bold; margin-bottom: 0.5rem;">${articles.length}</h3>
              <p style="color: #626A76; font-size: 0.9rem; margin: 0;">Intellectual Articles</p>
            </div>
          </div>
        </main>
      `
    } else {
      contentHtml = `
        <main style="max-width: 800px; margin: 4rem auto; padding: 0 1rem; text-align: center;" dir="rtl">
          <h1 style="font-size: 3rem; margin-bottom: 1.5rem; font-family: 'El Messiri', serif; font-weight: bold; color: #15161A; line-height: 1.2;">أُبقي الإنسان<br>في قلب الآلة.</h1>
          <p style="font-size: 1.25rem; color: #626A76; line-height: 1.7; margin-bottom: 2.5rem; font-family: 'Tajawal', sans-serif;">
            الموقع الرسمي للدكتور أحمد حسين الفيلكاوي، أستاذ تكنولوجيا التعليم والذكاء الاصطناعي، الكاتب والباحث والمستشار التربوي الكويتي.
          </p>
          <div style="background: rgba(62, 92, 120, 0.05); padding: 2rem; border-radius: 8px; margin-bottom: 3rem; text-align: right; border-right: 4px solid #3E5C78;">
            <h2 style="font-size: 1.5rem; margin-bottom: 1rem; font-family: 'El Messiri', serif; font-weight: bold; color: #3E5C78;">السيرة الأكاديمية والمهنية</h2>
            <p style="line-height: 1.8; color: #15161A; font-family: 'Tajawal', sans-serif;">
              حاصل على دكتوراه الفلسفة في التربية، تخصص تكنولوجيا التعليم من جامعة شمال كولورادو. أستاذ مشارك في كلية التربية الأساسية (PAAET) وأستاذ منتدب في كلية التربية بجامعة الكويت. خبير ومستشار في وزارة الإعلام والمجلس الوطني للثقافة والفنون والآداب ومكتبة الكويت الوطنية والهيئة العامة للشباب.
            </p>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 3rem; font-family: 'Tajawal', sans-serif;">
            <div style="padding: 1.5rem; border: 1px solid rgba(62, 92, 120, 0.1); border-radius: 6px;">
              <h3 style="font-size: 2rem; color: #3E5C78; font-weight: bold; margin-bottom: 0.5rem;">${nBooks}</h3>
              <p style="color: #626A76; font-size: 0.9rem; margin: 0;">كتب منشورة</p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid rgba(62, 92, 120, 0.1); border-radius: 6px;">
              <h3 style="font-size: 2rem; color: #3E5C78; font-weight: bold; margin-bottom: 0.5rem;">${nPapers}</h3>
              <p style="color: #626A76; font-size: 0.9rem; margin: 0;">أبحاثاً محكّمة</p>
            </div>
            <div style="padding: 1.5rem; border: 1px solid rgba(62, 92, 120, 0.1); border-radius: 6px;">
              <h3 style="font-size: 2rem; color: #3E5C78; font-weight: bold; margin-bottom: 0.5rem;">${articles.length}</h3>
              <p style="color: #626A76; font-size: 0.9rem; margin: 0;">مقالات فكرية</p>
            </div>
          </div>
        </main>
      `
    }
  } else if (path === '/articles') {
    const listHtml = articles.map(a => `
      <article style="margin-bottom: 2.5rem; border-bottom: 1px solid rgba(62, 92, 120, 0.1); padding-bottom: 2rem; text-align: right;">
        <h2 style="font-size: 1.75rem; font-family: 'El Messiri', serif; margin-bottom: 0.75rem;">
          <a href="/articles/${a.slug}" style="color: #15161A; text-decoration: none; transition: color 0.2s;">${esc(a.title)}</a>
        </h2>
        <div style="color: #626A76; font-size: 0.9rem; margin-bottom: 1rem; font-family: 'Tajawal', sans-serif;">
          <span>${esc(a.cat)}</span> &middot; <span>${esc(a.date)}</span>
        </div>
        <p style="color: #15161A; line-height: 1.7; font-size: 1.05rem; font-family: 'Tajawal', sans-serif;">${esc(a.excerpt)}</p>
        <div style="margin-top: 1rem;">
          <a href="/articles/${a.slug}" style="color: #3E5C78; text-decoration: none; font-weight: bold; font-size: 0.95rem; font-family: 'Tajawal', sans-serif;">اقرأ المقال بالكامل &larr;</a>
        </div>
      </article>
    `).join('')

    contentHtml = `
      <main style="max-width: 800px; margin: 4rem auto; padding: 0 1rem;" dir="rtl">
        <h1 style="font-size: 2.5rem; font-family: 'El Messiri', serif; font-weight: bold; margin-bottom: 1rem; text-align: right; color: #15161A;">مقالاتي الفكرية</h1>
        <p style="font-size: 1.15rem; color: #626A76; line-height: 1.7; margin-bottom: 3rem; text-align: right; font-family: 'Tajawal', sans-serif;">
          أرشيف المقالات الفكرية والتربوية والتقنية المنشورة في جريدة الجريدة وجريدة القبس ومختلف المنابر الثقافية.
        </p>
        <div style="margin-top: 2rem;">
          ${listHtml}
        </div>
      </main>
    `
  } else if (path.startsWith('/articles/')) {
    const slug = path.split('/').pop()
    const a = articles.find(x => x.slug === slug)
    if (a) {
      const bodyKey = a.slug + 'arabic'
      const fullText = bodies[bodyKey] || bodies[a.slug] || a.excerpt
      const paragraphs = fullText.split(/\n+/).filter(Boolean).map(p => `
        <p style="line-height: 1.8; margin-bottom: 1.5rem; font-size: 1.15rem; color: #15161A; text-align: justify; font-family: 'Tajawal', sans-serif;">${esc(p)}</p>
      `).join('')

      contentHtml = `
        <main style="max-width: 740px; margin: 4rem auto; padding: 0 1rem;" dir="rtl">
          <div style="margin-bottom: 2rem; text-align: right;">
            <a href="/articles" style="color: #3E5C78; text-decoration: none; font-weight: 500; font-family: 'Tajawal', sans-serif;">&rarr; العودة للمقالات</a>
          </div>
          <article>
            <header style="margin-bottom: 3rem; text-align: right;">
              <div style="color: #3E5C78; font-weight: bold; font-size: 1rem; margin-bottom: 0.5rem; font-family: 'Tajawal', sans-serif;">${esc(a.cat)}</div>
              <h1 style="font-size: 2.5rem; font-family: 'El Messiri', serif; font-weight: bold; color: #15161A; margin-bottom: 1rem; line-height: 1.3;">${esc(a.title)}</h1>
              <div style="color: #626A76; font-size: 0.95rem; font-family: 'Tajawal', sans-serif;">
                تاريخ النشر: <span>${esc(a.date)}</span> &middot; الكاتب: د. أحمد حسين الفيلكاوي
              </div>
            </header>
            <section style="margin-top: 2rem;">
              ${paragraphs}
            </section>
          </article>
        </main>
      `
    }
  } else if (path === '/publications') {
    const booksHtml = books.map(b => `
      <div style="margin-bottom: 3rem; border: 1px solid rgba(62, 92, 120, 0.1); padding: 2rem; border-radius: 8px; text-align: right;">
        <h2 style="font-size: 1.75rem; font-family: 'El Messiri', serif; margin-bottom: 0.5rem; color: #15161A;">
          <a href="/publications/${b.slug}" style="color: #15161A; text-decoration: none;">${esc(b.title)}</a>
        </h2>
        <p style="color: #626A76; font-size: 1.05rem; line-height: 1.7; font-family: 'Tajawal', sans-serif; margin-bottom: 1.5rem;">${esc(b.desc)}</p>
        <div>
          <a href="/publications/${b.slug}" style="color: #3E5C78; text-decoration: none; font-weight: bold; font-family: 'Tajawal', sans-serif;">عرض تفاصيل الكتاب &larr;</a>
        </div>
      </div>
    `).join('')

    contentHtml = `
      <main style="max-width: 800px; margin: 4rem auto; padding: 0 1rem;" dir="rtl">
        <h1 style="font-size: 2.5rem; font-family: 'El Messiri', serif; font-weight: bold; margin-bottom: 1rem; text-align: right; color: #15161A;">الكتب والمؤلفات</h1>
        <p style="font-size: 1.15rem; color: #626A76; line-height: 1.7; margin-bottom: 3rem; text-align: right; font-family: 'Tajawal', sans-serif;">
          المؤلفات والكتب العلمية والتربوية والمنهجية المنشورة للدكتور أحمد حسين الفيلكاوي في مجالات تكنولوجيا التعليم والتغيير المعرفي.
        </p>
        <div style="margin-top: 2rem;">
          ${booksHtml}
        </div>
      </main>
    `
  } else if (path.startsWith('/publications/')) {
    const slug = path.split('/').pop()
    const b = books.find(x => x.slug === slug)
    if (b) {
      contentHtml = `
        <main style="max-width: 800px; margin: 4rem auto; padding: 0 1rem;" dir="rtl">
          <div style="margin-bottom: 2rem; text-align: right;">
            <a href="/publications" style="color: #3E5C78; text-decoration: none; font-weight: 500; font-family: 'Tajawal', sans-serif;">&rarr; العودة للكتب</a>
          </div>
          <article style="text-align: right;">
            <header style="margin-bottom: 2rem;">
              <h1 style="font-size: 2.5rem; font-family: 'El Messiri', serif; font-weight: bold; color: #15161A; margin-bottom: 1rem;">كتاب: ${esc(b.title)}</h1>
              <p style="color: #626A76; font-size: 1.05rem; font-family: 'Tajawal', sans-serif;">المؤلف: د. أحمد حسين الفيلكاوي</p>
            </header>
            <section style="background: rgba(62, 92, 120, 0.03); padding: 2.5rem; border-radius: 8px; border-right: 4px solid #3E5C78; margin-bottom: 2rem;">
              <p style="line-height: 1.8; font-size: 1.15rem; color: #15161A; font-family: 'Tajawal', sans-serif; margin: 0;">${esc(b.desc)}</p>
            </section>
          </article>
        </main>
      `
    }
  } else if (path === '/research' || path === '/en/research') {
    if (en) {
      const papersHtml = papers.map(p => `
        <div style="margin-bottom: 2rem; border-bottom: 1px solid rgba(62, 92, 120, 0.1); padding-bottom: 1.5rem; text-align: left;">
          <h2 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem; color: #15161A;">
            <a href="/research/${p.slug}" style="color: #15161A; text-decoration: none;">${esc(p.title)}</a>
          </h2>
          <p style="color: #626A76; font-size: 0.95rem; margin-bottom: 0.5rem;">${esc(p.desc)}</p>
          <p style="color: #3E5C78; font-size: 0.85rem; font-weight: 500; margin: 0;">Co-author: د. عبدالعزيز دخيل العنزي</p>
        </div>
      `).join('')

      contentHtml = `
        <main style="max-width: 800px; margin: 4rem auto; padding: 0 1rem;">
          <h1 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 1rem; text-align: left; color: #15161A;">Scholarly Contributions</h1>
          <p style="font-size: 1.1rem; color: #626A76; line-height: 1.6; margin-bottom: 3rem; text-align: left;">
            Peer-reviewed papers and academic contributions on educational technology, virtual classrooms, and e-learning systems.
          </p>
          <div style="margin-top: 2rem;">
            ${papersHtml}
          </div>
        </main>
      `
    } else {
      const papersHtml = papers.map(p => `
        <div style="margin-bottom: 2rem; border-bottom: 1px solid rgba(62, 92, 120, 0.1); padding-bottom: 1.5rem; text-align: right;">
          <h2 dir="auto" style="font-size: 1.5rem; font-family: 'El Messiri', serif; margin-bottom: 0.5rem; color: #15161A;">
            <a href="/research/${p.slug}" style="color: #15161A; text-decoration: none;">${esc(p.title)}</a>
          </h2>
          <p style="color: #626A76; font-size: 0.95rem; font-family: 'Tajawal', sans-serif; margin-bottom: 0.5rem;">${esc(p.desc)}</p>
          <p style="color: #3E5C78; font-size: 0.85rem; font-family: 'Tajawal', sans-serif; font-weight: 500; margin: 0;">الباحث المشارك: د. عبدالعزيز دخيل العنزي</p>
        </div>
      `).join('')

      contentHtml = `
        <main style="max-width: 800px; margin: 4rem auto; padding: 0 1rem;" dir="rtl">
          <h1 style="font-size: 2.5rem; font-family: 'El Messiri', serif; font-weight: bold; margin-bottom: 1rem; text-align: right; color: #15161A;">المساهمات والأوراق العلمية المحكّمة</h1>
          <p style="font-size: 1.15rem; color: #626A76; line-height: 1.7; margin-bottom: 3rem; text-align: right; font-family: 'Tajawal', sans-serif;">
            الأبحاث والدراسات العلمية المحكّمة المنشورة في المجلات والدوريات الأكاديمية العالمية والمحلية في مجالات تكنولوجيا التعليم والتحول الرقمي.
          </p>
          <div style="margin-top: 2rem;">
            ${papersHtml}
          </div>
        </main>
      `
    }
  } else if (path.startsWith('/research/')) {
    const slug = path.split('/').pop()
    const p = papers.find(x => x.slug === slug)
    if (p) {
      contentHtml = `
        <main style="max-width: 800px; margin: 4rem auto; padding: 0 1rem;" dir="rtl">
          <div style="margin-bottom: 2rem; text-align: right;">
            <a href="/research" style="color: #3E5C78; text-decoration: none; font-weight: 500; font-family: 'Tajawal', sans-serif;">&rarr; العودة للأبحاث</a>
          </div>
          <article style="text-align: right;">
            <header style="margin-bottom: 2rem;">
              <h1 dir="auto" style="font-size: 2.25rem; font-family: 'El Messiri', serif; font-weight: bold; color: #15161A; margin-bottom: 1rem; line-height: 1.3;">بحث محكّم: ${esc(p.title)}</h1>
              <p style="color: #626A76; font-size: 1.05rem; font-family: 'Tajawal', sans-serif;">الباحث الرئيسي: د. أحمد حسين الفيلكاوي &middot; الباحث المشارك: د. عبدالعزيز دخيل العنزي</p>
            </header>
            <section style="background: rgba(62, 92, 120, 0.03); padding: 2.5rem; border-radius: 8px; border-right: 4px solid #3E5C78; margin-bottom: 2rem;">
              <p style="color: #3E5C78; font-size: .85rem; font-weight: 700; font-family: 'Tajawal', sans-serif; margin: 0 0 .75rem;">الملخص</p>
              <p style="line-height: 1.8; font-size: 1.15rem; color: #15161A; font-family: 'Tajawal', sans-serif; margin: 0;">${esc(p.abstractAr || p.desc)}</p>
            </section>
          </article>
        </main>
      `
    }
  } else if (path === '/media') {
    const mediaHtml = media.map((item) => `
      <article style="margin-bottom: 2rem; border-bottom: 1px solid rgba(62, 92, 120, 0.1); padding-bottom: 1.5rem; text-align: right;">
        <h2 style="font-size: 1.45rem; font-family: 'El Messiri', serif; margin-bottom: 0.5rem; color: #15161A;">
          <a href="${attr(item.url)}" style="color: #15161A; text-decoration: none;">${esc(item.title)}</a>
        </h2>
        <p style="color: #626A76; font-size: 0.95rem; font-family: 'Tajawal', sans-serif; margin: 0;">${esc(item.outlet || 'ظهور إعلامي')}</p>
      </article>
    `).join('')

    contentHtml = `
      <main style="max-width: 800px; margin: 4rem auto; padding: 0 1rem;" dir="rtl">
        <h1 style="font-size: 2.5rem; font-family: 'El Messiri', serif; font-weight: bold; margin-bottom: 1rem; text-align: right; color: #15161A;">الظهور الإعلامي</h1>
        <p style="font-size: 1.15rem; color: #626A76; line-height: 1.7; margin-bottom: 3rem; text-align: right; font-family: 'Tajawal', sans-serif;">
          مقتطفات من اللقاءات الإذاعية والتلفزيونية حيث يتحول الحوار إلى منصة للفكر.
        </p>
        ${mediaHtml}
      </main>
    `
  } else if (['/about', '/contact', '/ask', '/decade', '/thought-paths', '/search', '/atlas', '/questions', '/radar', '/curated', '/upcoming', '/inbox'].includes(path)) {
    const current = STATIC.find((item) => item.path === path)
    const links = [
      ['/', 'الرئيسية'],
      ['/articles', 'المقالات'],
      ['/publications', 'الكتب'],
      ['/research', 'الأبحاث'],
      ['/media', 'الإعلام'],
      ['/cv', 'السيرة'],
      ['/contact', 'التواصل'],
    ].map(([href, label]) => `<a href="${href}" style="color:#3E5C78;text-decoration:none;font-weight:600;">${label}</a>`).join(' · ')
    contentHtml = `
      <main style="max-width: 800px; margin: 4rem auto; padding: 0 1rem;" dir="rtl">
        <h1 style="font-size: 2.5rem; font-family: 'El Messiri', serif; font-weight: bold; margin-bottom: 1rem; text-align: right; color: #15161A;">${esc(current?.title || 'د. أحمد حسين الفيلكاوي')}</h1>
        <p style="font-size: 1.15rem; color: #626A76; line-height: 1.8; margin-bottom: 2rem; text-align: right; font-family: 'Tajawal', sans-serif;">
          ${esc(current?.desc || 'صفحة عامة من الموقع الرسمي للدكتور أحمد حسين الفيلكاوي.')}
        </p>
        <nav aria-label="روابط داخلية" style="line-height:2;font-family:'Tajawal',sans-serif;text-align:right;">${links}</nav>
      </main>
    `
  } else if (path === '/cv' || path === '/en/cv') {
    if (en) {
      contentHtml = `
        <main style="max-width: 800px; margin: 4rem auto; padding: 0 1rem;">
          <h1 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 1.5rem; color: #15161A;">Academic Curriculum Vitae</h1>
          <p style="font-size: 1.15rem; color: #626A76; line-height: 1.6; margin-bottom: 3rem;">
            Dr. Ahmad H. Alfailakawi - Professor of Educational Technology and AI.
          </p>
          
          <section style="margin-bottom: 3rem;">
            <h2 style="font-size: 1.75rem; font-weight: bold; color: #3E5C78; border-bottom: 2px solid rgba(62, 92, 120, 0.1); padding-bottom: 0.5rem; margin-bottom: 1.5rem;">Education</h2>
            <ul style="list-style-type: none; padding: 0; line-height: 1.8;">
              <li style="margin-bottom: 1rem;">
                <strong>Ph.D. in Education (Educational Technology)</strong><br>
                University of Northern Colorado, Greeley, Colorado - Summa Cum Laude
              </li>
              <li style="margin-bottom: 1rem;">
                <strong>Master in Educational Technology</strong><br>
                University of Northern Colorado - Summa Cum Laude
              </li>
              <li style="margin-bottom: 1rem;">
                <strong>B.Ed. in Educational Technology</strong><br>
                The Public Authority for Applied Education and Training (PAAET) - Summa Cum Laude
              </li>
            </ul>
          </section>

          <section style="margin-bottom: 3rem;">
            <h2 style="font-size: 1.75rem; font-weight: bold; color: #3E5C78; border-bottom: 2px solid rgba(62, 92, 120, 0.1); padding-bottom: 0.5rem; margin-bottom: 1.5rem;">Academic Teaching</h2>
            <ul style="list-style-type: none; padding: 0; line-height: 1.8;">
              <li style="margin-bottom: 1rem;">
                <strong>Associate Professor</strong> (Jan 2020 - Present)<br>
                College of Basic Education, PAAET
              </li>
              <li style="margin-bottom: 1rem;">
                <strong>Assistant Professor</strong> (Until Jan 2020)<br>
                College of Basic Education, PAAET
              </li>
              <li style="margin-bottom: 1rem;">
                <strong>Delegated Professor</strong><br>
                College of Education, Kuwait University
              </li>
            </ul>
          </section>
        </main>
      `
    } else {
      contentHtml = `
        <main style="max-width: 800px; margin: 4rem auto; padding: 0 1rem;" dir="rtl">
          <h1 style="font-size: 2.5rem; font-family: 'El Messiri', serif; font-weight: bold; margin-bottom: 1.5rem; text-align: right; color: #15161A;">السيرة الأكاديمية والمهنية</h1>
          <p style="font-size: 1.15rem; color: #626A76; line-height: 1.7; margin-bottom: 3rem; text-align: right; font-family: 'Tajawal', sans-serif;">
            د. أحمد حسين الفيلكاوي - أستاذ تكنولوجيا التعليم والذكاء الاصطناعي، الكاتب والمستشار التربوي.
          </p>

          <section style="margin-bottom: 3rem; text-align: right;">
            <h2 style="font-size: 1.75rem; font-family: 'El Messiri', serif; font-weight: bold; color: #3E5C78; border-bottom: 2px solid rgba(62, 92, 120, 0.1); padding-bottom: 0.5rem; margin-bottom: 1.5rem;">الدرجات الأكاديمية</h2>
            <ul style="list-style-type: none; padding: 0; line-height: 2; font-family: 'Tajawal', sans-serif;">
              <li style="margin-bottom: 1rem; border-right: 3px solid #3E5C78; padding-right: 1rem;">
                <strong>دكتوراه الفلسفة في التربية — تكنولوجيا التعليم</strong><br>
                جامعة شمال كولورادو، غريلي، كولورادو &middot; بدرجة امتياز مع مرتبة الشرف
              </li>
              <li style="margin-bottom: 1rem; border-right: 3px solid #3E5C78; padding-right: 1rem;">
                <strong>ماجستير في تكنولوجيا التعليم</strong><br>
                جامعة شمال كولورادو &middot; بدرجة امتياز مع مرتبة الشرف
              </li>
              <li style="margin-bottom: 1rem; border-right: 3px solid #3E5C78; padding-right: 1rem;">
                <strong>بكالوريوس التربية في تكنولوجيا التعليم</strong><br>
                الهيئة العامة للتعليم التطبيقي والتدريب (PAAET) &middot; بدرجة امتياز مع مرتبة الشرف
              </li>
            </ul>
          </section>

          <section style="margin-bottom: 3rem; text-align: right;">
            <h2 style="font-size: 1.75rem; font-family: 'El Messiri', serif; font-weight: bold; color: #3E5C78; border-bottom: 2px solid rgba(62, 92, 120, 0.1); padding-bottom: 0.5rem; margin-bottom: 1.5rem;">الخبرة الأكاديمية والتدريس</h2>
            <ul style="list-style-type: none; padding: 0; line-height: 2; font-family: 'Tajawal', sans-serif;">
              <li style="margin-bottom: 1rem;">
                <strong>أستاذ مشارك</strong> (يناير 2020 حتى الآن) &middot; كلية التربية الأساسية (PAAET)
              </li>
              <li style="margin-bottom: 1rem;">
                <strong>أستاذ مساعد</strong> (حتى يناير 2020) &middot; كلية التربية الأساسية (PAAET)
              </li>
              <li style="margin-bottom: 1rem;">
                <strong>أستاذ منتدب</strong> &middot; كلية التربية بجامعة الكويت
              </li>
            </ul>
          </section>

          <section style="margin-bottom: 3rem; text-align: right;">
            <h2 style="font-size: 1.75rem; font-family: 'El Messiri', serif; font-weight: bold; color: #3E5C78; border-bottom: 2px solid rgba(62, 92, 120, 0.1); padding-bottom: 0.5rem; margin-bottom: 1.5rem;">الاستشارات والخبرة المهنية</h2>
            <ul style="list-style-type: none; padding: 0; line-height: 2; font-family: 'Tajawal', sans-serif;">
              <li style="margin-bottom: 0.75rem;">&bull; خبير ومستشار مكتب الوزير &middot; وزارة الإعلام</li>
              <li style="margin-bottom: 0.75rem;">&bull; مستشار &middot; المجلس الوطني للثقافة والفنون والآداب</li>
              <li style="margin-bottom: 0.75rem;">&bull; مستشار &middot; مكتبة الكويت الوطنية</li>
              <li style="margin-bottom: 0.75rem;">&bull; خبير ومستشار &middot; الهيئة العامة للشباب</li>
            </ul>
          </section>
        </main>
      `
    }
  } else {
    contentHtml = `
      <main style="max-width: 800px; margin: 4rem auto; padding: 0 1rem; text-align: ${en ? 'left' : 'right'};" ${en ? '' : 'dir="rtl"'}>
        <h1 style="font-size: 2.5rem; font-family: ${en ? 'inherit' : "'El Messiri', serif"}; font-weight: bold; color: #15161A; margin-bottom: 1rem;">د. أحمد حسين الفيلكاوي</h1>
        <p style="font-size: 1.15rem; color: #626A76; line-height: 1.7; font-family: ${en ? 'inherit' : "'Tajawal', sans-serif"};">
          أستاذ تكنولوجيا التعليم والذكاء الاصطناعي · باحث · مستشار تربوي
        </p>
      </main>
    `
  }

  return `${headerHtml}\n${contentHtml}\n${footerHtml}`
}

function render({ path, title, desc, type = 'website', iso, cat, image, robots, lang = 'ar', isbn }) {
  const en = lang === 'en'
  const isAdmin = path === '/admin'
  // ما دامت المرآة مخفية: صفحاتها الإنجليزية لا تُفهرس
  if (en && !SHOW_EN) robots = 'noindex, nofollow'
  // لا تُلحق الاسم إن كان العنوان يحمله أصلاً — يمنع تضاعفه
  const hasName = title.includes('Alfailakawi') || title.includes('د. أحمد حسين الفيلكاوي')
  const full = isAdmin ? title : path === '/' || hasName ? title : en ? `${title} — Dr. Ahmad H. Alfailakawi` : `${title} — د. أحمد حسين الفيلكاوي`
  const url = SITE + path
  const img = `${SITE}${image || '/og.png'}`

  // مسار التفصيل يحدّد نوع Schema والفتات (Breadcrumb)
  const isArticlePage = /^\/(?:en\/)?articles\//.test(path)
  const isPaperPage = /^\/(?:en\/)?research\//.test(path)
  const isBookPage = /^\/(?:en\/)?publications\//.test(path)
  const section = isArticlePage ? ['المقالات', '/articles']
    : isPaperPage ? ['المساهمات العلمية', '/research']
    : isBookPage ? ['المؤلفات', '/publications'] : null
  const crumb = section && {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: en ? 'Home' : 'الرئيسية', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: section[0], item: SITE + section[1] },
      { '@type': 'ListItem', position: 3, name: title, item: url },
    ],
  }

  let graph
  if (path === '/' || path === '/en') {
    // الرئيسية: هوية الموقع + المؤلف (ProfilePage) — أساس كِيان غوغل
    graph = [
      { '@type': 'WebSite', '@id': `${SITE}/#website`, url: SITE, name: full, inLanguage: lang, publisher: { '@id': `${SITE}/#person` } },
      { '@type': 'ProfilePage', '@id': url + '#profile', url, name: full, inLanguage: lang, mainEntity: { '@id': `${SITE}/#person` } },
    ]
  } else if (path === '/cv' || path === '/en/cv') {
    graph = [
      { '@type': 'ProfilePage', '@id': url + '#profile', url, name: full, description: desc, inLanguage: lang, mainEntity: { '@id': `${SITE}/#person` } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: en ? 'Home' : 'الرئيسية', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: title, item: url },
      ] },
    ]
  } else if (isPaperPage) {
    graph = [{ '@type': 'ScholarlyArticle', headline: title, name: title, description: desc, image: img, inLanguage: lang, author: { '@id': `${SITE}/#person` }, publisher: PUBLISHER, mainEntityOfPage: url, ...(iso ? { datePublished: iso } : {}) }, crumb].filter(Boolean)
  } else if (isBookPage) {
    graph = [{ '@type': 'Book', name: title, description: desc, image: img, inLanguage: lang, author: { '@id': `${SITE}/#person` }, url, ...(isbn ? { isbn } : {}) }, crumb].filter(Boolean)
  } else if (type === 'article') {
    graph = [{ '@type': 'Article', headline: title, description: desc, datePublished: iso, dateModified: iso, articleSection: cat, image: img, inLanguage: lang, author: { '@id': `${SITE}/#person` }, publisher: PUBLISHER, mainEntityOfPage: url }, crumb].filter(Boolean)
  } else {
    graph = [{ '@type': 'WebPage', name: full, description: desc, url, inLanguage: lang }]
  }
  const ld = { '@context': 'https://schema.org', '@graph': isAdmin ? graph : [PERSON, ...graph] }

  // hreflang للصفحات المتقابلة عربي↔إنجليزي
  const arPath = en ? Object.keys(LANG_PAIRS).find((k) => LANG_PAIRS[k] === path) : path
  const enPath = en ? path : LANG_PAIRS[path]
  const hreflang = arPath !== undefined && enPath
    ? `<link rel="alternate" hreflang="ar" href="${SITE + arPath}" />
    <link rel="alternate" hreflang="en" href="${SITE + enPath}" />
    <link rel="alternate" hreflang="x-default" href="${SITE + arPath}" />`
    : ''

  const head = isAdmin ? `
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <meta name="robots" content="noindex, nofollow, noarchive" />
    <link rel="canonical" href="${url}" />
    <script type="application/ld+json">${JSON.stringify(ld)}</script>
  ` : `
    <title>${esc(full)}</title>
    <meta name="description" content="${esc(desc)}" />
    ${robots ? `<meta name="robots" content="${robots}" />` : ''}
    <link rel="canonical" href="${url}" />
    ${hreflang}
    <meta property="og:type" content="${type}" />
    <meta property="og:title" content="${esc(full)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:locale" content="${en ? 'en_US' : 'ar_KW'}" />
    <meta property="og:site_name" content="${en ? 'Dr. Ahmad H. Alfailakawi' : 'د. أحمد حسين الفيلكاوي'}" />
    ${type === 'article' ? `<meta property="article:author" content="${AUTHOR}" />
    ${iso ? `<meta property="article:published_time" content="${iso}" />
    <meta property="article:modified_time" content="${iso}" />` : ''}
    ${cat ? `<meta property="article:section" content="${esc(cat)}" />` : ''}` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(full)}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image" content="${img}" />
    <meta name="twitter:creator" content="@drahmadkw" />
    <script type="application/ld+json">${JSON.stringify(ld)}</script>
  `

  let html = stripManagedHead(shell)
  if (isAdmin) {
    html = html
      .replace(/<meta\s+name=["']author["'][^>]*>/gi, '')
      .replace(/<link\s+rel=["']alternate["'][^>]*>/gi, '')
      .replace(/<link\s+rel=["']preload["'][^>]+(?:portrait|og\.png)[^>]*>/gi, '')
  }
  html = html.replace('</head>', `${head}\n  </head>`)
  const bodyHtml = generateBodyHtml(path, lang)
  html = html.replace(
    '<div id="root"></div>',
    `<div id="seo-fallback">${bodyHtml}</div><div id="root"></div>`,
  )
  return html
}

function writeRoute(path, html) {
  if (path === '/') {
    writeFileSync(resolve(DIST, 'index.html'), html, 'utf8')
    return
  }

  const withoutSlash = path.replace(/^\/+/, '')
  const dir = resolve(DIST, withoutSlash)
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'index.html'), html, 'utf8')

  // يخدم /path مباشرة على المنصات التي تبحث عن path.html قبل fallback.
  writeFileSync(resolve(DIST, `${withoutSlash}.html`), html, 'utf8')
}

function wrapSvgText(text, max = 28) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > max && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 4)
}

function generateArticleOg() {
  const out = resolve(DIST, 'og/articles')
  mkdirSync(out, { recursive: true })
  for (const article of articles) {
    const titleLines = wrapSvgText(article.title, 29)
    const excerptLines = wrapSvgText(article.excerpt, 58).slice(0, 2)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" dir="rtl">
  <defs>
    <style>
      .bg{fill:#FCFCFA}.ink{fill:#15161A}.soft{fill:#626A76}.accent{fill:#3E5C78}.hair{stroke:#3E5C78;stroke-opacity:.18}
      text{font-family:"Tajawal","Arial",sans-serif}.display{font-family:"El Messiri","Tajawal",serif}
    </style>
  </defs>
  <rect class="bg" width="1200" height="630"/>
  <circle cx="210" cy="118" r="280" fill="#3E5C78" opacity=".07"/>
  <rect x="64" y="64" width="1072" height="502" rx="0" fill="none" class="hair" stroke-width="2"/>
  <text x="1080" y="134" text-anchor="end" class="accent" font-size="30" font-weight="700">${attr(article.cat)} · ${attr(article.date)}</text>
  ${titleLines.map((line, i) => `<text x="1080" y="${226 + i * 74}" text-anchor="end" class="display ink" font-size="58" font-weight="700">${attr(line)}</text>`).join('\n  ')}
  ${excerptLines.map((line, i) => `<text x="1080" y="${466 + i * 42}" text-anchor="end" class="soft" font-size="29" font-weight="400">${attr(line)}</text>`).join('\n  ')}
  <rect x="898" y="526" width="182" height="4" class="accent"/>
  <text x="1080" y="564" text-anchor="end" class="ink" font-size="26" font-weight="700">د. أحمد حسين الفيلكاوي</text>
  <text x="1080" y="596" text-anchor="end" class="soft" font-size="21">${attr(SITE_HOST)}</text>
</svg>`
    writeFileSync(resolve(out, `${article.slug}.svg`), svg, 'utf8')
  }
}

const publicRoutes = uniqueRoutes(routes)

let n = 0
for (const r of publicRoutes) {
  writeRoute(r.path, render(r))
  n++
}
writeFileSync(resolve(DIST, '404.html'), render({ path: '/404', title: 'الصفحة غير موجودة', desc: 'الصفحة المطلوبة غير موجودة.' }), 'utf8')
writeFileSync(resolve(DIST, 'admin.html'), render({ path: '/admin', title: 'لوحة التحكم', desc: 'لوحة إدارة خاصة.', robots: 'noindex, nofollow' }), 'utf8')
writeFileSync(resolve(DIST, 'offline.html'), render({ path: '/offline', title: 'أنت غير متصل', desc: 'هذه الصفحة متاحة عند انقطاع الاتصال.' }), 'utf8')
generateArticleOg()

/* ---------- sitemap ---------- */
const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicRoutes.filter((r) => (SHOW_EN || r.lang !== 'en') && !r.robots).map((r) => `  <url><loc>${SITE}${r.path}</loc>${r.iso ? `<lastmod>${r.iso}</lastmod>` : ''}<priority>${r.path === '/' ? '1.0' : r.type === 'article' ? '0.6' : '0.8'}</priority></url>`).join('\n')}
</urlset>
`
writeFileSync(resolve(DIST, 'sitemap.xml'), sm, 'utf8')

/* ---------- robots.txt (مولّد من النطاق المركزي — لا يتقادم أبداً) ---------- */
writeFileSync(resolve(DIST, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /admin
Disallow: /login
Disallow: /_share
Disallow: /*?*

Sitemap: ${SITE}/sitemap.xml
`, 'utf8')

/* ---------- RSS ---------- */
const feedArticles = uniqueBySlug([...siteArticlesFeed, ...articles]).filter((a) => a.slug && a.title && a.iso)
const items = feedArticles.map((a) => `    <item>
      <title>${esc(a.title)}</title>
      <link>${SITE}/articles/${a.slug}</link>
      <guid isPermaLink="true">${SITE}/articles/${a.slug}</guid>
      <pubDate>${new Date(a.iso).toUTCString()}</pubDate>
      <category>${esc(a.cat)}</category>
      <description>${esc(a.excerpt)}</description>
    </item>`).join('\n')

writeFileSync(resolve(DIST, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
    <title>د. أحمد حسين الفيلكاوي — مقالات فكرية</title>
    <link>${SITE}</link>
    <description>مقالات في التعليم والتقنية والمجتمع.</description>
    <language>ar</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel></rss>
`, 'utf8')

/* ---------- بودكاست: خلاصة RSS قياسية من الأرشيف الصوتي (صوت فهد) ----------
   كل مقالٍ له MP3 يصبح حلقة؛ تُقبل مباشرة في Apple Podcasts وSpotify.
   بلا أثر بصري على الموقع — قناة موازية للمستمعين. */
const podcastArt = `${SITE}/podcast-cover.png`
const durationOf = (file) => {
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ], { encoding: 'utf8', timeout: 20_000 })
  if (result.status !== 0) return ''
  const seconds = Math.round(Number(result.stdout.trim()))
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
const durationLabel = (seconds) => {
  seconds = Math.round(Number(seconds || 0))
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
const audioAssetInfo = (rel, file = '') => {
  if (file && existsSync(file)) {
    return { bytes: statSync(file).size, duration: durationOf(file) }
  }
  const meta = audioMeta?.[rel]
  if (!meta) return null
  const bytes = Number(meta.bytes || 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return null
  return { bytes, duration: durationLabel(meta.durationSeconds) }
}
const episodeItem = (articleList, fileOf) => articleList
  .map((a) => {
    const item = fileOf(a)
    const asset = item?.rel ? audioAssetInfo(item.rel, item.file) : null
    return { a, ...item, asset }
  })
  .filter((e) => e.rel && e.asset)
  .sort((x, y) => (y.a.iso || '').localeCompare(x.a.iso || ''))
const podcastEpisodeNumbers = new Map([...feedArticles]
  .sort((left, right) => (left.iso || '').localeCompare(right.iso || ''))
  .map((article, index) => [article.slug, index + 1]))
const podcastEpisodes = episodeItem(feedArticles, (a) => {
    // الحلقة الحوارية (فهد ونورة) هي حلقة القناة؛ وإلى أن تُولَّد لمقالٍ ما،
    // تبقى قراءته العادية حلقةً بنفس الـGUID — فلا تختفي حلقة ولا تتكرر.
    const dlg = resolve(ROOT, 'audio', `${a.slug}.dialogue.mp3`)
    const transcript = resolve(ROOT, 'audio', `${a.slug}.dialogue.json`)
    if (visibleDialogueAsset(a.slug, dlg, transcript)) return { file: dlg, rel: `${a.slug}.dialogue.mp3` }
    const plain = resolve(ROOT, 'audio', `${a.slug}.mp3`)
    return { file: existsSync(plain) ? plain : null, rel: `${a.slug}.mp3` }
  })
  .map(({ a, rel, asset }) => {
    const bytes = asset.bytes
    const url = audioPublicUrl(rel)
    const duration = asset.duration
    return `    <item>
      <title>${esc(a.title)}</title>
      <itunes:author>د. أحمد حسين الفيلكاوي</itunes:author>
      <itunes:subtitle>${esc(a.excerpt).slice(0, 120)}</itunes:subtitle>
      <description>${esc(a.excerpt)}</description>
      <itunes:summary>${esc(a.excerpt)}</itunes:summary>
      <link>${SITE}/articles/${a.slug}</link>
      <guid isPermaLink="false">podcast-${a.slug}</guid>
      <pubDate>${new Date(`${a.iso}T08:00:00Z`).toUTCString()}</pubDate>
      <enclosure url="${url}" length="${bytes}" type="audio/mpeg"/>
      ${duration ? `<itunes:duration>${duration}</itunes:duration>` : ''}
      <itunes:episode>${podcastEpisodeNumbers.get(a.slug) || 1}</itunes:episode>
      <itunes:episodeType>full</itunes:episodeType>
      ${rel.endsWith('.dialogue.mp3') ? `<podcast:transcript url="${audioPublicUrl(`${a.slug}.dialogue.json`)}" type="application/json"/>` : ''}
      <itunes:image href="${podcastArt}"/>
      <itunes:explicit>false</itunes:explicit>
    </item>`
  }).join('\n')

writeFileSync(resolve(DIST, 'podcast.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>مقالات د. أحمد حسين الفيلكاوي المسموعة</title>
    <link>${SITE}</link>
    <atom:link href="${SITE}/podcast.xml" rel="self" type="application/rss+xml"/>
    <language>ar-KW</language>
    <generator>Dr. Ahmad Alfailakawi Podcast Engine</generator>
    <copyright>© د. أحمد حسين الفيلكاوي</copyright>
    <description>أفكاري عن التعليم والتقنية والمجتمع، وكيف نُبقي الإنسان في قلب الآلة — بصوتي، مقالاً تلو الآخر. حلقة جديدة مع كل مقال.

My reflections on education, technology, and society — and how we keep the human at the heart of the machine. In my own voice, essay by essay. A new episode with every article.

تُنتج النسخة الصوتية باستخدام تقنيات صوتية متقدمة، تحت الإشراف والتحرير الكامل للدكتور أحمد حسين الفيلكاوي.</description>
    <itunes:author>د. أحمد حسين الفيلكاوي · Dr. Ahmad Alfailakawi</itunes:author>
    <itunes:summary>قناة صوتية رسمية لمقالات د. أحمد حسين الفيلكاوي في التعليم والتقنية والمجتمع.</itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:owner><itunes:name>د. أحمد حسين الفيلكاوي</itunes:name><itunes:email>ah_f@hotmail.com</itunes:email></itunes:owner>
    <itunes:image href="${podcastArt}"/>
    <itunes:category text="Education"/>
    <itunes:category text="Society &amp; Culture"/>
    <itunes:explicit>false</itunes:explicit>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${podcastEpisodes}
  </channel>
</rss>
`, 'utf8')


/* ---------- podcast-en.xml: القناة الإنجليزية المستقلة (حوار Andrew وAva) ---------- */
const enEpisodes = episodeItem(articles, (a) => {
    const f = resolve(ROOT, 'audio', `${a.slug}.dialogue-en.mp3`)
    return { file: existsSync(f) ? f : null, rel: `${a.slug}.dialogue-en.mp3` }
  })
  .map(({ a, rel, asset }) => {
    const bytes = asset.bytes
    const duration = asset.duration
    return `    <item>
      <title>${esc(a.title)}</title>
      <itunes:author>Dr. Ahmad Alfailakawi</itunes:author>
      <description>${esc(a.excerpt)}</description>
      <link>${SITE}/articles/${a.slug}</link>
      <guid isPermaLink="false">podcast-en-${a.slug}</guid>
      <pubDate>${new Date(`${a.iso}T09:00:00Z`).toUTCString()}</pubDate>
      <enclosure url="${audioPublicUrl(rel)}" length="${bytes}" type="audio/mpeg"/>
      ${duration ? `<itunes:duration>${duration}</itunes:duration>` : ''}
      <itunes:image href="${podcastArt}"/>
      <itunes:explicit>false</itunes:explicit>
    </item>`
  }).join('\n')

if (enEpisodes) writeFileSync(resolve(DIST, 'podcast-en.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Dr. Ahmad Alfailakawi — The Human at the Heart of the Machine</title>
    <link>${SITE}</link>
    <language>en</language>
    <copyright>© Dr. Ahmad Alfailakawi</copyright>
    <description>Conversations on education, technology, and society — inspired by the Arabic essays of Dr. Ahmad Alfailakawi, professor of educational technology and AI. Produced with advanced voice technology under the author's full editorial supervision.</description>
    <itunes:author>Dr. Ahmad Alfailakawi</itunes:author>
    <itunes:type>episodic</itunes:type>
    <itunes:owner><itunes:name>Dr. Ahmad Alfailakawi</itunes:name><itunes:email>ah_f@hotmail.com</itunes:email></itunes:owner>
    <itunes:image href="${podcastArt}"/>
    <itunes:category text="Education"/>
    <itunes:explicit>false</itunes:explicit>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${enEpisodes}
  </channel>
</rss>
`, 'utf8')

/* ---------- أصول الإنتاج ----------
   المصدر المعتمد لهذه الملفات هو مجلدات الجذر، لا public/.
   نحذف وجهة الصوت أولاً كي لا تبقى ملفات قديمة أو تالفة نسخها Vite من public. */
function syncDirectory(name, extension) {
  const from = resolve(ROOT, name)
  const to = resolve(DIST, name)
  if (!existsSync(from)) throw new Error(`مجلد الأصول مفقود: ${name}`)
  rmSync(to, { recursive: true, force: true })
  mkdirSync(to, { recursive: true })
  if (name === 'audio' && AUDIO_PUBLIC_BASE_URL) return 0
  const extensions = Array.isArray(extension) ? extension : [extension]
  const files = readdirSync(from, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((suffix) => entry.name.endsWith(suffix)))
    .filter((entry) => {
      if (name !== 'audio') return true
      const match = entry.name.match(/^(.*)\.dialogue\.(mp3|json)$/)
      if (!match) return true // القراءات العادية والنسخ الإنجليزية لا تتبع بوابة الحلقة العربية
      const slug = match[1]
      return visibleDialogueAsset(slug, resolve(from, `${slug}.dialogue.mp3`), resolve(from, `${slug}.dialogue.json`))
    })
  for (const entry of files) copyFileSync(resolve(from, entry.name), resolve(to, entry.name))
  return files.length
}

const copiedAssets = Object.fromEntries(
  [['audio', ['.mp3', '.dialogue.json']], ['covers', '.png'], ['files', '.pdf']]
    .map(([name, extension]) => [name, syncDirectory(name, extension)]),
)

/* مجلد اختبار الأصوات الأعمى — يعيش في public/audio/bakeoff؛ يُنسخ بعد إعادة بناء dist/audio
   (syncDirectory يمسح dist/audio) كي يصل الموقع الحي على /audio/bakeoff */
const bakeoffSrc = resolve(ROOT, 'public/audio/bakeoff')
if (existsSync(bakeoffSrc)) {
  const bakeoffDst = resolve(DIST, 'audio/bakeoff')
  mkdirSync(bakeoffDst, { recursive: true })
  for (const f of readdirSync(bakeoffSrc)) if (/\.(mp3|json)$/.test(f)) copyFileSync(resolve(bakeoffSrc, f), resolve(bakeoffDst, f))
}

const firebaseAppletConfig = resolve(ROOT, 'firebase-applet-config.json')
if (!existsSync(firebaseAppletConfig)) throw new Error('firebase-applet-config.json مفقود')
copyFileSync(firebaseAppletConfig, resolve(DIST, 'firebase-applet-config.json'))

/* ---------- service worker: إصدار تلقائي + توافق Cloud Run ---------- */
const sw = resolve(DIST, 'sw.js')
if (existsSync(sw)) {
  const id = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 12)
  const text = readFileSync(sw, 'utf8').replace(/__BUILD_ID__/g, id)
  writeFileSync(sw, text, 'utf8')
}

function assertStaticOutput() {
  const badPages = publicRoutes
    .filter((route) => !route.robots)
    .map((route) => route.path === '/' ? resolve(DIST, 'index.html') : resolve(DIST, route.path.replace(/^\/+/, ''), 'index.html'))
    .filter((file) => {
      if (!existsSync(file)) return true
      const html = readFileSync(file, 'utf8')
      return !/<div id="seo-fallback">[\s\S]*<main\b[\s\S]*<\/main>[\s\S]*<\/div><div id="root"><\/div>/.test(html)
        || !/<link rel="canonical" href="https:\/\/[^"]+" \/>/.test(html)
        || !/<script type="application\/ld\+json">/.test(html)
    })
  if (badPages.length) throw new Error(`Prerender ناقص في ${badPages.length} صفحة: ${badPages.slice(0, 5).map((file) => file.replace(ROOT, '')).join(', ')}`)

  const sitemap = readFileSync(resolve(DIST, 'sitemap.xml'), 'utf8')
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
  const duplicateLocs = locs.filter((loc, index) => locs.indexOf(loc) !== index)
  if (duplicateLocs.length) throw new Error(`sitemap يحتوي روابط مكررة: ${duplicateLocs.slice(0, 3).join(', ')}`)
  if (/scheduledarabbic|localhost|127\.0\.0\.1/.test(sitemap)) throw new Error('sitemap يحتوي رابط اختبار أو slug غير نظيف')

  const robots = readFileSync(resolve(DIST, 'robots.txt'), 'utf8')
  if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`) || /localhost|127\.0\.0\.1/.test(robots)) {
    throw new Error('robots.txt لا يستخدم النطاق المركزي الصحيح')
  }

  const feed = readFileSync(resolve(DIST, 'feed.xml'), 'utf8')
  const guids = [...feed.matchAll(/<guid[^>]*>([^<]+)<\/guid>/g)].map((match) => match[1])
  const duplicateGuids = guids.filter((guid, index) => guids.indexOf(guid) !== index)
  if (duplicateGuids.length) throw new Error(`RSS يحتوي GUID مكرر: ${duplicateGuids.slice(0, 3).join(', ')}`)

  const podcast = readFileSync(resolve(DIST, 'podcast.xml'), 'utf8')
  if (hasPodcastState && /\.dialogue\.mp3/.test(podcast) && !Object.values(podcastState?.done || {}).some((entry) => entry?.status === 'accepted_automated')) {
    throw new Error('podcast.xml يحتوي حلقة حوارية غير معتمدة')
  }
  if (!/<atom:link\b[^>]*rel="self"/.test(podcast)) throw new Error('podcast.xml يفتقد atom:link self')
  const podcastItems = [...podcast.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1])
  const podcastGuids = podcastItems.map((item) => (item.match(/<guid[^>]*>([^<]+)<\/guid>/) || [])[1]).filter(Boolean)
  const podcastEnclosures = podcastItems.map((item) => (item.match(/<enclosure\s[^>]*url="([^"]+)"/) || [])[1]).filter(Boolean)
  if (new Set(podcastGuids).size !== podcastGuids.length) throw new Error('podcast.xml يحتوي GUID مكرراً')
  if (new Set(podcastEnclosures).size !== podcastEnclosures.length) throw new Error('podcast.xml يحتوي enclosure URL مكرراً')
  for (const item of podcastItems) {
    const enclosureTag = (item.match(/<enclosure\s[^>]*\/?>(?:<\/enclosure>)?/) || [])[0] || ''
    const enclosureLength = Number((enclosureTag.match(/length="([0-9]+)"/) || [])[1] || 0)
    const enclosureType = (enclosureTag.match(/type="([^"]+)"/) || [])[1] || ''
    if (enclosureLength < 200_000 || enclosureType !== 'audio/mpeg')
      throw new Error('podcast.xml يحتوي enclosure ناقصاً أو صغيراً')
    if (!/<itunes:duration>[^<]+<\/itunes:duration>/.test(item)) throw new Error('حلقة بودكاست بلا مدة')
    if (!/<itunes:episodeType>full<\/itunes:episodeType>/.test(item)) throw new Error('حلقة بودكاست بلا episodeType')
  }
}

/* بعض بيئات Cloud Run/App Hosting تتعامل مع assets المستوردة من Vite بشكل مختلف.
   إبقاء نسخة public واضحة من الشعار والبورتريه يحمي الواجهة من 404 إن تغيّر مسار الحزمة. */
for (const [from, to] of [
  ['src/assets/logo.png', 'dist/logo.png'],
  ['src/assets/portrait.webp', 'dist/portrait.webp'],
]) {
  const srcFile = resolve(ROOT, from)
  if (existsSync(srcFile)) copyFileSync(srcFile, resolve(ROOT, to))
}

assertStaticOutput()

console.log(`✔ ${n} صفحة ثابتة · sitemap (${publicRoutes.length}) · feed.xml · 404.html`)
console.log(`✔ أصول الإنتاج: audio ${copiedAssets.audio} · covers ${copiedAssets.covers} · files ${copiedAssets.files} · Firebase config`)
