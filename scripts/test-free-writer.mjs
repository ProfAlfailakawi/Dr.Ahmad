#!/usr/bin/env node
/**
 * اختبارات جولة ٣١ يوليو: المحرك المجاني للمقال الكامل + إصلاحات الجسر والبث.
 *
 * الوظيفي: generatePerfectArticle يكتب عبر Cloudflare حين لا Gemini —
 * ببصمة مكثفة ونطاق قبول ٦٪ حول الهدف. والمصدري: رقع الجسر (تمهيد المحادثة،
 * رد واحد للدفعة، حارس التكرار، شبكة الحقول) وتصريف {عزيزي}/{الأخ} وترتيب
 * دفتر الأسماء — كلها في مواضعها ولا تمس البوابة المقدسة.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
delete process.env.GEMINI_API_KEY
delete process.env.GOOGLE_API_KEY
process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account'
process.env.CLOUDFLARE_API_TOKEN = 'test-token'

const { generatePerfectArticle } = await import(resolve(root, 'server.mjs'))

/* جسم بعدد كلمات مقصود: ٣٤٤ كلمة — داخل نطاق ٦٪ حول ٣٥٠ (±٢١) */
const paragraph = (words) => Array.from({ length: words }, (_, i) => ['التعليم', 'يتنفس', 'حين', 'يقود', 'المعلم', 'التقنية', 'بوعي', 'راشد'][i % 8]).join(' ')
const bodyText = [paragraph(60), paragraph(58), paragraph(57), paragraph(60), paragraph(55), paragraph(54)].join('\n\n')

const cfCalls = []
const fetchMock = async (url, init) => {
  const address = String(url)
  if (address.includes('api.cloudflare.com')) {
    cfCalls.push(JSON.parse(init.body))
    return {
      ok: true,
      status: 200,
      json: async () => ({
        result: {
          response: JSON.stringify({
            title: 'حين يستأذن الذكاء الاصطناعي المعلم',
            cat: 'التقنية',
            excerpt: 'ليست المعركة بين المعلم والخوارزمية، بل بين وعيين: وعي يقود الأداة ووعي تقوده. هنا خريطة الفارق.',
            body: bodyText,
            angle: 'زاوية القيادة التربوية للأداة',
            eventId: '',
            eventConnection: '',
            originalityNote: 'زاوية جديدة لم تُطرق في الأرشيف المرفق.',
          }),
        },
      }),
    }
  }
  /* أي نداء آخر (سياق الأحداث الراهنة…) يفشل بهدوء ليُثبت الصمود بلا شبكة */
  return { ok: false, status: 503, json: async () => ({}) }
}

const input = {
  idea: 'الذكاء الاصطناعي بين يدي المعلم',
  audience: 'المعلمون والقيادات التعليمية',
  angle: 'القيادة لا الاستبدال',
  targetWords: 350,
  skipOriginality: false,
  styleProfile: { articleCount: 143, tone: 'فكري إنساني' },
  styleSamples: Array.from({ length: 8 }, (_, i) => ({
    title: `عينة ${i + 1}`, cat: 'التعليم', year: '2021',
    opening: paragraph(80), middle: paragraph(80), closing: paragraph(80),
  })),
  existing: Array.from({ length: 40 }, (_, i) => ({
    slug: `article-${i}`, title: `مقال الأرشيف رقم ${i}`,
    excerpt: 'مقتطف أرشيفي moderate عن التعليم والتقنية.',
    body: paragraph(200),
  })),
  selectedEventIds: [],
}

const article = await generatePerfectArticle(input, fetchMock)
assert.ok(article.title.length > 10, 'عنوان حقيقي')
assert.ok(Math.abs(article.exactWords - 350) <= 21, `العدد ${article.exactWords} داخل نطاق ٦٪ حول ٣٥٠`)
assert.equal(article.modelValidated, true, 'المحرك المجاني يوسم النسخة موثقة النموذج')
assert.ok(article.originality >= 0, 'درجة أصالة محسوبة فعلياً')

/* البصمة المكثفة وصلت للمحرك المجاني: أرشيف ≤١٠ وعينات ≤٤ داخل نداء CF */
const firstCall = cfCalls[0]
assert.ok(firstCall, 'نداء Cloudflare وقع فعلاً')
const userContent = firstCall.messages.find((m) => m.role === 'user')?.content || ''
const compact = JSON.parse(userContent.split('\n').slice(1).join('\n'))
assert.ok(compact.nearestArchive.length <= 10, 'الأرشيف مكثف للنافذة الأضيق')
assert.ok(compact.styleSamples.length <= 4, 'عينات الأسلوب مكثفة')
assert.ok(firstCall.messages[0].content.includes('يُمنع منعاً باتاً اختراع رقم'), 'قاعدة عدم اختراع الإحصائيات حاضرة')
assert.ok(firstCall.messages[0].content.includes('صيدة'), 'الكلمة المحظورة مذكورة منعاً')
assert.ok(firstCall.max_tokens <= 4_096, 'سقف الإخراج ضمن حد Workers AI')

/* ─── فحوص المصدر ─── */
const bridge = readFileSync(resolve(root, 'whatsapp-web-bridge/index.mjs'), 'utf8')
const controller = readFileSync(resolve(root, 'src/server/whatsapp-controller.mjs'), 'utf8')
const audiencePanel = readFileSync(resolve(root, 'src/components/admin/AudienceStudio.tsx'), 'utf8')
const serverSource = readFileSync(resolve(root, 'server.mjs'), 'utf8')

/* الجسر: تمهيد المحادثة قبل الإرسال + لا إرسال لألقاب lid */
assert.match(bridge, /ensureIndividualChatExists/, 'تمهيد المحادثة موجود')
assert.match(bridge, /findOrCreateLatestChat/, 'ينشئ المحادثة بفعل واتساب الرسمي')
assert.match(bridge, /await ensureIndividualChatExists\(jid\)/, 'التمهيد داخل مسار الإرسال')
assert.match(bridge, /recipient-not-on-whatsapp/, 'رقم خارج واتساب يفشل بهوية واضحة')
assert.match(bridge, /الرقم ليس مسجلاً في واتساب/, 'سبب الفشل يظهر عربياً للدكتور')

/* الجسر: دفعة الانقطاع رد واحد + حارس التكرار + شبكة الحقول */
assert.match(bridge, /lastReplyEligible/, 'آخر رسالة لكل محادثة وحدها ترد')
assert.match(bridge, /catchup_backlog_reply_collapsed/, 'طي الدفعة مسجل في اللوغ')
assert.match(bridge, /repeatedReplySuppressed/, 'حارس الرد المطابق موجود')
assert.match(bridge, /applyMergeFieldSafetyNet/, 'شبكة أمان الحقول موجودة')
assert.match(bridge, /applyMergeFieldSafetyNet\(command\.payload\?\.text\)/, 'الشبكة على نص الأوامر فعلاً')

/* البوابة المقدسة سليمة: الإيقاظ وحده يفتح الجلسة */
assert.match(controller, /wake-phrase-only/, 'سياسة الإيقاظ الحصري باقية')
assert.match(controller, /wakeEpoch:\s*2/, 'حقبة الإيقاظ ٢ باقية')

/* التصريف الكامل الموعود في اللوحة */
assert.match(controller, /\{عزيزي\}/, 'حقل عزيزي معالج في الخادم')
assert.match(controller, /\{الأخ\}/, 'حقل الأخ معالج في الخادم')
assert.match(controller, /الأعزاء في \$\{fullName\}/, 'صيغة الجهات (الأعزاء في…)')
assert.match(controller, /عزيزتي \$\{vocative\}/, 'صيغة المؤنث')
assert.ok(controller.includes('[^{}\\n]{1,24}'), 'تنظيف أي حقل مجهول قبل الوصول')

/* دفتر الأسماء: الأسماء أولاً ورقاقة بلا ألغاز */
assert.match(controller, /leftNamed \? -1 : 1/, 'أصحاب الأسماء يتقدمون الدفتر')
assert.match(audiencePanel, /بلا اسم/, 'مجهول الاسم يسمى صراحة')
assert.match(audiencePanel, /في قائمة|قوائم`/, 'عدد القوائم صار جملة لا صفراً شارداً')

/* أناقة بوابة اليوم في المقتطفات */
assert.match(controller, /«\$\{excerpt\}/, 'المقتطف اقتباس بين قوسي تنصيص')

/* المحرك المجاني في الخادم */
assert.match(serverSource, /callCloudflareStructured/, 'محرك CF المنظم موجود')
assert.match(serverSource, /callGeminiStructuredDirect/, 'مسار Gemini المباشر معزول')
assert.match(serverSource, /return callCloudflareStructured\(request, fetchImpl\)/, 'غياب المفتاح يذهب مجاناً مباشرة')
assert.match(serverSource, /wordTolerance/, 'نطاق قبول العدد موجود')

/* ─── جولة ٣١ يوليو الثانية: باب المتسللين، صمود الاستوديو، أفكار المجلس الخمس ─── */
const studioPanel = readFileSync(resolve(root, 'src/components/admin/PublishingStudio.tsx'), 'utf8')
const designStudio = readFileSync(resolve(root, 'src/components/admin/SocialDesignStudio.tsx'), 'utf8')
const visualSources = readFileSync(resolve(root, 'src/lib/external-visual-sources.ts'), 'utf8')
const audiencePanelRound2 = readFileSync(resolve(root, 'src/components/admin/AudienceStudio.tsx'), 'utf8')

/* المزامنة لا تُنشئ مجهولين: دفتر هاتفه الحقيقي فقط، والخادم يرفض بلا اسم */
assert.match(bridge, /isMyContact !== true\) return \[\]/, 'الجسر يزامن جهاته المحفوظة فقط')
assert.match(controller, /if \(!waName && !displayName\) continue/, 'الخادم لا يوطّن مجهول الاسم')
assert.match(controller, /autoCaptured/, 'عزل الملتقطين تلقائياً موجود')
assert.doesNotMatch(controller.slice(controller.indexOf("event === 'contacts-sync'"), controller.indexOf("event === 'contacts-sync'") + 1600), /source: 'whatsapp-sync'/, 'المزامنة توقفت عن دهس حقل المصدر')
assert.match(audiencePanelRound2, /أرقام التقطها واتساب تلقائياً/, 'قسم المعزولين في اللوحة')
assert.doesNotMatch(audiencePanelRound2, /delete.*audienceContacts|حذف الرقم/, 'لا حذف لأي رقم')

/* الاستوديو: مهلات المزودين + التدرج المرن + السقوط المتبادل بصمام */
assert.match(visualSources, /fetchWithDeadline/, 'مهلة صارمة على كل مزود')
assert.ok(visualSources.split('fetchWithDeadline(').length >= 4, 'المهلة مسلوكة في المزودين الثلاثة')
assert.match(visualSources, /مطابقة مرنة/, 'التدرج المرن بدل المجاعة')
assert.match(designStudio, /fromReady: true/, 'الجاهز الجائع يسقط للتوليد')
assert.match(designStudio, /fromGenerate: true/, 'التوليد الفاشل يسقط للجاهز')
assert.match(designStudio, /hop\.fromReady\) throw/, 'صمام يمنع التأرجح الأبدي')

/* أفكار المجلس الخمس حاضرة عضوياً */
assert.match(studioPanel, /data-waiting-room-bell/, '١) جرس غرفة الانتظار')
assert.match(studioPanel, /snoozeUntil/, 'تأجيل الجرس يُحفظ')
assert.match(studioPanel, /التقط مقترحاً من صندوق الوارد/, '٢) الوارد بنقرة')
assert.match(studioPanel, /adoptInboxSuggestion/, 'الوارد يملأ المصدر والسياق')
assert.match(studioPanel, /stubbornWins/, '٣) معايرة العناد')
assert.match(studioPanel, /Math\.min\(4, stubbornWins \* 2\)/, 'سقف العناد +٤ داخل ±٨')
assert.match(studioPanel, /voicedArticles/, '٤) الصوت في المحفظة')
assert.match(studioPanel, /relatedAudioCount/, 'عدّاد المواد المنطوقة')
assert.match(studioPanel, /data-weekly-board-session/, '٥) الجلسة الأسبوعية')
assert.match(studioPanel, /weeklySessionRows/, 'ترتيب الجلسة: المستحق ثم الأقوى')

console.log('المحرك المجاني وإصلاحات الجسر والبث: كل الاختبارات خضراء ✓')
