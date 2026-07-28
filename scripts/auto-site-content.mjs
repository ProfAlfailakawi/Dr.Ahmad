#!/usr/bin/env node
/**
 * نشر ذاتي موثوق لقسمي «رسائل على الهامش» و«أسئلة تصلني».
 *
 * - يعمل عدة مرات يومياً من GitHub Actions، لكنه ينشر وفق موعده فقط.
 * - يزرع تلقائياً حدّاً أولياً: أربع رسائل + عشرة أسئلة إذا كان الأرشيف أقل من ذلك.
 * - الرسائل: رسالة جديدة كل 3 أيام، من مقالات الدكتور وكتبه ولقاءاته، وبنبرات متنوّعة.
 * - الأسئلة: سؤال جديد كل يومين، عام وقصير جداً، من تخصصاته واهتماماته.
 *  * - يمنع تكرار المصدر والموضوع والنبرة، ويتعافى من تعطل تشغيل سابق.
 * - لا يقرأ البريد الشخصي ولا ينشر بيانات أشخاص؛ النصوص تُولد من أرشيف الدكتور نفسه.
 * - المختارات لا تُنشأ هنا إطلاقاً؛ مصدرها الوحيد رادار الإنترنت scripts/daily-radar.mjs.
 *
 * الاستخدام:
 *   npm run content:auto
 *   npm run content:auto -- --force
 *   npm run content:auto:self-test
 */
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const SELF_TEST = args.has("--self-test");

try {
  process.loadEnvFile(resolve(ROOT, ".env"));
} catch {
  /* اختياري */
}

const env = { ...process.env };
const PROJECT_ID = env.FIREBASE_PROJECT_ID || "drahmad-8e9e2";
const STATE_COLLECTION = "automation_state";
const STATE_DOC = "site-content-cycle";
const GENERATION_VERSION = "2026-07-21-v8-professional-automatic-inbox";
const now = new Date();

const integerEnv = (name, fallback) => {
  const value = Number.parseInt(env[name] || "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const MIN_LETTERS = integerEnv("AUTO_CONTENT_MIN_LETTERS", 4);
const MIN_FAQS = integerEnv("AUTO_CONTENT_MIN_FAQS", 10);
const MIN_PICKS = 0; // المختارات تُحدّث من الرادار الموثوق؛ لا تُولد من أرشيف الدكتور
const MAX_GENERATED_PER_KIND = integerEnv("AUTO_CONTENT_MAX_PER_KIND", 10);

const styles = [
  "تأمل هادئ",
  "اعتراض مهذب",
  "سؤال يفتح زاوية جديدة",
  "امتنان لفكرة",
  "مفارقة ذكية",
  "موقف تربوي مختصر",
  "وقفة إنسانية",
];

const topicFamilies = [
  "تكنولوجيا التعليم",
  "الذكاء الاصطناعي والتعليم",
  "التربية الأسرية",
  "الطفل والتكنولوجيا",
  "المعلم وتطوير الممارسة",
  "التقييم والقياس",
  "التفكير النقدي",
  "الهوية الرقمية",
  "أخلاقيات التقنية",
  "البحث العلمي",
  "التعليم الجامعي",
  "التعلم الإلكتروني",
  "المدارس الذكية",
  "التلعيب والألعاب التعليمية",
  "ذوو الاحتياجات الخاصة والتقنيات المساندة",
  "القيادة والابتكار",
  "الإعلام والمجتمع الرقمي",
  "الصحة النفسية في البيئة التعليمية",
];

const TOPIC_RULES = [
  {
    topic: "الذكاء الاصطناعي والتعليم",
    pattern: /ذكاء اصطناعي|خوارزمي|شات جي|روبوت|تعلم آلي/i,
  },
  {
    topic: "الطفل والتكنولوجيا",
    pattern: /طفل|أطفال|أبناء|هاتف|شاشة|ألعاب فيديو|منصات/i,
  },
  {
    topic: "المعلم وتطوير الممارسة",
    pattern: /معلّم|معلم|معلمين|هيئة التدريس|تدريس|صف دراسي/i,
  },
  {
    topic: "التقييم والقياس",
    pattern: /اختبار|امتحان|تقييم|قياس|درجة|درجات|تصحيح/i,
  },
  { topic: "التفكير النقدي", pattern: /تفكير|سؤال|نقد|تحليل|استدلال|عقل/i },
  {
    topic: "الهوية الرقمية",
    pattern: /هوية|خصوصية|بيانات|منصات اجتماعية|رقمي/i,
  },
  { topic: "أخلاقيات التقنية", pattern: /أخلاق|مسؤولية|تحيز|نزاهة|غش|خصوصية/i },
  {
    topic: "البحث العلمي",
    pattern: /بحث|باحث|دراسة|أكاديمي|جامعة|مجلة علمية/i,
  },
  {
    topic: "التعليم الجامعي",
    pattern: /جامعة|جامعي|كلية|طالب جامعي|هيئة التدريس/i,
  },
  {
    topic: "التعلم الإلكتروني",
    pattern: /تعلم إلكتروني|تعليم إلكتروني|عن بعد|مدمج|مودل|منصة تعليمية/i,
  },
  {
    topic: "المدارس الذكية",
    pattern: /مدرسة ذكية|مدارس ذكية|بنية تعليمية|فصل ذكي/i,
  },
  {
    topic: "التلعيب والألعاب التعليمية",
    pattern: /تلعيب|لعب|ألعاب تعليمية|تحفيز|نقاط/i,
  },
  {
    topic: "ذوو الاحتياجات الخاصة والتقنيات المساندة",
    pattern: /احتياجات خاصة|إعاقة|تقنيات مساندة|دمج/i,
  },
  {
    topic: "القيادة والابتكار",
    pattern: /قيادة|ابتكار|تحول|قرار|مؤسسة|تخطيط/i,
  },
  {
    topic: "الإعلام والمجتمع الرقمي",
    pattern: /إعلام|مجتمع|تواصل اجتماعي|خبر|محتوى رقمي/i,
  },
  {
    topic: "الصحة النفسية في البيئة التعليمية",
    pattern: /قلق|خوف|ضغط|نفسي|احتراق|تعب|سعادة/i,
  },
  { topic: "التربية الأسرية", pattern: /أسرة|والد|أب|أم|تربية|أبناء/i },
  {
    topic: "تكنولوجيا التعليم",
    pattern: /تكنولوجيا التعليم|تقنية تعليم|وسائل تعليم|تعليم رقمي/i,
  },
];

function relevantTopics(source) {
  const text = clean(
    `${source?.title || ""} ${source?.category || ""} ${source?.text || ""}`,
  );
  const matched = TOPIC_RULES.filter(({ pattern }) => pattern.test(text)).map(
    ({ topic }) => topic,
  );
  return matched.length ? [...new Set(matched)] : topicFamilies;
}

function chooseTopicForSource(source, usedTopics, salt = 0) {
  const relevant = relevantTopics(source);
  const unusedRelevant = relevant.filter((topic) => !usedTopics.has(topic));
  const unusedGlobal = topicFamilies.filter((topic) => !usedTopics.has(topic));
  const pool = unusedRelevant.length
    ? unusedRelevant
    : relevant.length
      ? relevant
      : unusedGlobal.length
        ? unusedGlobal
        : topicFamilies;
  return rotate(pool, `${source?.key || "source"}:topic:${salt}`);
}

const sourceTypeCycle = ["مقال", "كتاب", "لقاء"];
const clean = (value = "") =>
  String(value).replace(/\\'/g, "'").replace(/\s+/g, " ").trim();
const hash = (value) =>
  createHash("sha256").update(String(value)).digest("hex").slice(0, 18);
const isoDay = (date = new Date()) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * 86_400_000);
const sleep = (ms) =>
  new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const dayNumber = Math.floor(Date.now() / 86_400_000);

function grabArray(source, name) {
  return (
    (source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\n\\]`)) ||
      [])[1] || ""
  );
}

function loadSources() {
  // المصدر المنشور نفسه الذي تبنيه الواجهة؛ لا نقرأ النسخة الجذرية القديمة التي قد تحتوي مواد مستبعدة.
  const source = readFileSync(resolve(ROOT, "src/data.ts"), "utf8");
  const bodiesPath = resolve(ROOT, "src/data/bodies.json");
  const bodies = existsSync(bodiesPath)
    ? JSON.parse(readFileSync(bodiesPath, "utf8"))
    : {};

  const articles = [
    ...grabArray(source, "articles").matchAll(
      /\{ slug: '([^']+)', title: '([^']+)', date: '([^']*)', iso: '([^']*)', cat: '([^']*)',\s*excerpt: '([^']*)'/g,
    ),
  ]
    .map((match) => ({
      key: `article:${match[1]}`,
      type: "مقال",
      title: clean(match[2]),
      category: clean(match[5]),
      url: `/articles/${match[1]}`,
      text: clean(bodies[match[1]] || match[6]).slice(0, 5200),
    }))
    .filter((item) => item.title && item.text);

  const books = [
    ...grabArray(source, "books").matchAll(
      /\{ slug: '([^']+)'[\s\S]*?title: '([^']+)'[\s\S]*?isbn: '([^']*)'[\s\S]*?cover: '([^']*)'[\s\S]*?pdf: '([^']*)'[\s\S]*?desc: '([^']*)'/g,
    ),
  ]
    .map((match) => ({
      key: `book:${match[1]}`,
      type: "كتاب",
      title: clean(match[2]),
      category: "كتاب",
      url: `/publications/${match[1]}`,
      text: clean(match[6]),
    }))
    .filter((item) => item.title && item.text);

  const media = [
    ...grabArray(source, "media").matchAll(
      /\{ title: '([^']+)', outlet: '([^']+)', url: '([^']+)' \}/g,
    ),
  ]
    .map((match, index) => ({
      key: `media:${index}:${hash(match[1])}`,
      type: "لقاء",
      title: clean(match[1]),
      category: clean(match[2]),
      url: clean(match[3]),
      text: `لقاء بعنوان «${clean(match[1])}» في ${clean(match[2])}.`,
    }))
    .filter((item) => item.title);

  return [...articles, ...books, ...media];
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function due(nextAt) {
  if (FORCE) return true;
  const date = normalizeTimestamp(nextAt);
  return !date || date.getTime() <= Date.now();
}

function isPublished(item) {
  return (
    item?.published !== false &&
    item?.status !== "draft" &&
    item?.status !== "hidden"
  );
}

function createdToday(items) {
  const today = isoDay(now);
  return items.some((item) => {
    if (!item?.autoGenerated) return false;
    const date = normalizeTimestamp(item.createdAt);
    return date && isoDay(date) === today;
  });
}

function chooseUnusedText(items, used, salt = 0) {
  const available = items.filter((item) => !used.has(item));
  const pool = available.length ? available : items;
  return pool[(dayNumber + salt) % pool.length];
}

function chooseDiverseSource(items, usedKeys, salt = 0) {
  const unused = items.filter((item) => !usedKeys.has(item.key));
  const allPool = unused.length ? unused : items;
  if (!allPool.length) throw new Error("لا توجد مصادر محلية صالحة للتوليد.");

  for (let offset = 0; offset < sourceTypeCycle.length; offset += 1) {
    const preferred =
      sourceTypeCycle[(dayNumber + salt + offset) % sourceTypeCycle.length];
    const typePool = allPool.filter((item) => item.type === preferred);
    if (typePool.length)
      return typePool[(dayNumber * 3 + salt) % typePool.length];
  }
  return allPool[(dayNumber + salt) % allPool.length];
}

async function geminiJson(prompt) {
  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY أو GOOGLE_API_KEY مفقود");
  const models = env.GEMINI_MODEL
    ? [env.GEMINI_MODEL]
    : ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-pro-latest"];

  let lastError = "";
  for (let round = 0; round < 2; round += 1) {
    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.86,
            },
          }),
        },
      );
      if (response.ok) {
        const payload = await response.json();
        const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error(`لم يُرجع ${model} نصاً.`);
        return JSON.parse(text);
      }
      lastError = `${model} → ${response.status}: ${(await response.text()).slice(0, 180)}`;
      if (![404, 429, 500, 502, 503, 504].includes(response.status)) break;
    }
    if (round === 0) await sleep(12_000);
  }
  throw new Error(`فشل التوليد: ${lastError}`);
}

function validateLetter(output) {
  const message = clean(output?.message);
  const reply = clean(output?.reply);
  if (message.length < 180 || message.length > 850)
    throw new Error(`طول الرسالة غير صالح: ${message.length}`);
  if (reply.length < 35 || reply.length > 260)
    throw new Error(`طول الرد غير صالح: ${reply.length}`);
  if (/اسمي|بريدي|رقم هاتفي|أنا فلان|وصلتك هذه الرسالة من/i.test(message))
    throw new Error("الرسالة تحتوي تعريفاً شخصياً غير مطلوب.");
  return { message, reply };
}

function validateFaq(output) {
  const q = clean(output?.q);
  const a = clean(output?.a);
  if (q.length < 18 || q.length > 150)
    throw new Error(`طول السؤال غير صالح: ${q.length}`);
  if (a.length < 25 || a.length > 260)
    throw new Error(`طول الإجابة غير صالح: ${a.length}`);
  return { q, a };
}

/* ═══ التوليد التحريريّ — بلا نموذج لغويّ ═══
 *
 * كان هذا الباب «احتياطياً» يُلجأ إليه حين يتعذّر Gemini. ثم نفد رصيد النموذج
 * فصار هو الباب الوحيد — وهو لا يملك إلا سبعة قوالبَ للرسائل وقالباً واحداً
 * للأسئلة. فخرجت أسئلةٌ متطابقة حرفياً لا يتغيّر فيها إلا اسم الموضوع.
 *
 * والعلاج ليس قوالبَ أكثر — بل مصدرَ تنويعٍ حقيقيّاً: متونُ الدكتور نفسها.
 * فالرسالة تُبنى حول جملةٍ حقيقية من مقاله منقولةٍ حرفاً بحرف، يلفّها إطارُ
 * ربطٍ مجمَّد. والجواب في «أسئلة تصلني» جملةٌ من كلامه هو لا من كلامنا.
 *
 * والتنويع يصير حسابياً لا معدوداً: ١٦٤ مقالاً × جملٍ متعددة في كل مقال ×
 * ثمانيةِ مطالعَ × ثمانيةِ جسورٍ × ثمانيةِ خواتم. ولا يتكرر شيءٌ عملياً.
 */

/** جُمَلُ المتن الصالحة للاقتباس — لا الأولى دائماً كما كان */
function sourceSentences(source) {
  return clean(source?.text)
    .replace(/<[^>]+>/g, " ")
    .split(/(?<=[.!؟…])\s+/)
    .map((sentence) =>
      sentence
        .replace(/^[\s«»"'-]+|[\s«»"']+$/g, "")
        .replace(/[،؛:.!؟…]+$/g, "")
        .trim(),
    )
    .filter((sentence) => sentence.length >= 45 && sentence.length <= 230);
}

/* الدوران بالبصمة لا بالعشوائية: التشغيلة الواحدة تُعطي النتيجة نفسها إن
   أُعيدت، فلا يتغيّر المنشور تحت يد الدكتور بين معاينةٍ وتنفيذ. */
const rotate = (list, salt) => {
  if (!list.length) return undefined;
  const index = Number(BigInt(`0x${hash(salt)}`) % BigInt(list.length));
  return list[index];
};

/* اللقاءات ليس لها متنٌ عندنا — نصّها سطرٌ نصنعه نحن («لقاء بعنوان … في …»).
   واقتباسُه ونسبتُه إلى الدكتور كأنه فكرةٌ قالها تحريفٌ صغير، وأسوأ منه أن
   يُعرض جواباً في «أسئلة تصلني». فلا نقتبس إلا من متنٍ حقيقيّ. */
const hasProse = (source) =>
  source?.type === "مقال" ||
  (source?.type === "كتاب" && clean(source?.text).length >= 120);

function pickSentence(source, salt, topic = "") {
  if (!hasProse(source)) return "";
  const all = sourceSentences(source);
  if (!all.length) return "";
  const topicTokens = clean(topic)
    .split(/\s+/)
    .map((token) => token.replace(/[«»()،؛:.!?؟]/g, ""))
    .filter(
      (token) =>
        token.length >= 4 && !/^(التعليم|التربية|التقنية|الرقمية)$/.test(token),
    );
  /* عند السؤال نُقدّم الجملة الأقرب لموضوعه، ثم نوازن الطول. */
  const ranked = [...all].sort((a, b) => {
    const score = (sentence) =>
      topicTokens.reduce(
        (total, token) => total + (sentence.includes(token) ? 1 : 0),
        0,
      );
    return (
      score(b) - score(a) || Math.abs(a.length - 150) - Math.abs(b.length - 150)
    );
  });
  const bestScore = topicTokens.length
    ? topicTokens.reduce(
        (total, token) => total + (ranked[0]?.includes(token) ? 1 : 0),
        0,
      )
    : 0;
  const pool = ranked
    .filter((sentence) => {
      if (!bestScore) return true;
      return (
        topicTokens.reduce(
          (total, token) => total + (sentence.includes(token) ? 1 : 0),
          0,
        ) === bestScore
      );
    })
    .slice(0, Math.min(6, ranked.length));
  return rotate(
    pool.length ? pool : ranked.slice(0, 6),
    `${source.key}:${salt}`,
  );
}

function compactSourceExcerpt(source, limit = 235) {
  const sentence = pickSentence(source, "excerpt");
  if (!sentence)
    return "أن قيمة الفكرة لا تظهر في جمالها النظري فقط، بل في القرار أو الممارسة التي تغيّرها.";
  const excerpt = sentence.slice(0, limit).trim();
  return excerpt.length < sentence.length
    ? `${excerpt.replace(/[،؛:.!?؟\s]+$/g, "")}…`
    : excerpt;
}

const SOURCE_WORD = { مقال: "مقالك", كتاب: "كتابك", لقاء: "لقاءك" };

const LETTER_OPENERS = [
  (s) =>
    `توقفت طويلاً عند ${SOURCE_WORD[s.type] || "مادتك"} «${s.title}»، وبقيت عندي جملةٌ منه أعيد قراءتها:`,
  (s) =>
    `قرأت «${s.title}» على مهل، ولم أخرج منه بانطباعٍ واحد بل بجملةٍ ظلّت معي:`,
  (s) =>
    `في «${s.title}» عبارةٌ لخّصت ما كنت أحاول قوله منذ مدة ولا أُحسن صياغته:`,
  (s) => `عدت إلى «${s.title}» مرةً ثانية، والسبب سطرٌ فيه لم يفارقني:`,
  (s) =>
    `ما يميّز «${s.title}» أنه لا يكتفي بوصف ${s.category || "المسألة"}؛ ففيه هذا القول:`,
  (s) => `أرسل لك هذه بعد قراءة «${s.title}». أكثر ما بقي معي منه هذه الجملة:`,
  (s) => `كنت أظنّ المسألة في «${s.title}» معروفة، حتى وقفت عند هذا:`,
  (s) => `«${s.title}» من المواد التي تُقرأ مرتين. وفي الثانية توقفت هنا:`,
];

const LETTER_BRIDGES = [
  "وهذه الجملة تُغيّر ترتيب السؤال عندي: لم أعد أسأل عن الأداة أولاً، بل عمّا ستتركه في الإنسان.",
  "ولعلّ قيمتها أنها تنقل النقاش من الانبهار بالوسيلة إلى مساءلة أثرها.",
  "وهي تضع الإصبع على ما نتجاوزه غالباً حين نستعجل الحلول الجاهزة.",
  "وما إن قرأتها حتى تذكّرت مواقف كنت أظنّها متفرقة، فإذا هي مسألةٌ واحدة.",
  "وفيها معيارٌ عمليّ لا شعار: يمكن اختباره في الصف أو البيت ثم مراجعة أثره.",
  "وهي تُفرّق بين التغيير الذي يظهر في الشكل والتغيير الذي يظهر في الفهم.",
  "ولعلّ أصعب ما فيها أنها تُلزم القارئ بقرار، لا تكتفي بأن تُرضيه.",
  "وهي تُذكّر بأن كثرة الخيارات لا تعني بالضرورة أن قراراتنا صارت أفضل.",
];

const LETTER_CLOSERS = [
  "فشكراً لك؛ الكتابة التي تترك سؤالاً أنفع من التي تترك إعجاباً.",
  "وأحسب أن هذا النوع من الطرح هو ما نحتاجه اليوم أكثر من الشعارات الكبيرة.",
  "وأتمنى أن تعود إلى هذه الزاوية بتوسّع؛ فيها ما يستحق.",
  "وقد جعلتني أعيد النظر في ممارسةٍ كنت أراها بديهية.",
  "ولعلّ الأهم أنها قابلة للنقل من المقال إلى موقفٍ يوميّ بلا تعقيد.",
  "وأحببت أن أشكرك عليها، فقليلٌ ما يُكتب بهذا الوضوح.",
  "وسأحاول تطبيقها بصورتها الصغيرة قبل أن أحكم عليها.",
  "ويبقى السؤال مفتوحاً عندي — وهذا في ظنّي جزءٌ من قيمتها.",
];

/* جسورُ ما لا اقتباسَ فيه: تتحدّث عن المادة ولا تُشير إلى جملةٍ بعينها */
const LETTER_BRIDGES_PLAIN = [
  "وأكثر ما لفتني أن النقاش بقي عند الأثر في الإنسان، لا عند الأداة وحدها.",
  "ولعلّ قيمته أنه ينقل الحديث من الانبهار بالوسيلة إلى مساءلة نتيجتها.",
  "وفيه ما يضع الإصبع على ما نتجاوزه حين نستعجل الحلول الجاهزة.",
  "وقد جمع لي مواقف كنت أظنّها متفرقة، فإذا هي مسألةٌ واحدة.",
  "وفيه معيارٌ عمليّ لا شعار: يمكن اختباره ثم مراجعة أثره.",
  "وهو يُفرّق بوضوح بين التغيير الذي يظهر في الشكل والذي يظهر في الفهم.",
  "وأصعب ما فيه أنه يُلزم المتابع بقرار، لا يكتفي بأن يُرضيه.",
  "وهو يُذكّر بأن كثرة الخيارات لا تعني أن قراراتنا صارت أفضل.",
];

const REPLY_POOL = [
  "هذا هو المقصود: أن تتحول الفكرة من إعجابٍ عابر إلى سؤالٍ يراجع القرار والممارسة.",
  "المعيار عندي ثابت: هل أضافت الأداة إلى الإنسان فهماً وحريةً ومسؤولية؟ ما عدا ذلك تفاصيل.",
  "الفكرة تُقاس بأثرها لا بجمال صياغتها. وأثرها يظهر حين تتغيّر ممارسةٌ صغيرة.",
  "شكراً لك. وما دام السؤال قد بقي معك، فقد أدّى النصّ ما كُتب من أجله.",
  "نعم، ولهذا أُلحّ على البدء من الغاية: ماذا سيفعل المتعلم بعدها؟ ثم نختار الوسيلة.",
  "التقنية تتغيّر بسرعة، أما معيارنا في الحكم عليها فيجب أن يبقى ثابتاً.",
  "أصبتَ في موضع السؤال. والتجريب الصغير المُراجَع خيرٌ من قرارٍ كبير بلا مراجعة.",
  "هذا ما أحاول قوله دائماً: لا نُلغي الوسيلة، نضعها في موضعها من الغاية.",
];

/* ما لا متنَ له (اللقاءات) يُكتب عنه بلا اقتباس: نتحدث عن المادة لا ننسب
   إليها كلاماً. ومطالعُ هذه الحالة لا تنتهي بنقطتين تنتظران قولاً. */
const LETTER_OPENERS_PLAIN = [
  (s) => `تابعت «${s.title}»، وخرجت منه بأكثر مما توقعت.`,
  (s) => `استمعت إلى «${s.title}» مرتين، والثانية كانت أنفع من الأولى.`,
  (s) => `«${s.title}» من المواد التي تُعيد ترتيب السؤال عند المتابع.`,
  (s) => `وصلني «${s.title}» من صديق، وأنا الآن أرسله لغيري.`,
  (s) => `ما زلت أفكّر فيما طُرح في «${s.title}» بعد أيام من متابعته.`,
  (s) => `«${s.title}» تناول المسألة من زاويةٍ قلّ أن تُطرح عندنا.`,
  (s) => `أحببت في «${s.title}» أن الحديث ظلّ قريباً من الواقع لا من الشعارات.`,
  (s) => `بعد «${s.title}» صار عندي سؤالٌ أوضح مما كان قبله.`,
];

function fallbackLetter(source, style) {
  const salt = `${source.key}:${style}`;
  const quote = hasProse(source) ? compactSourceExcerpt(source) : "";
  /* الجسر يشير إلى «هذه الجملة» — فلا يصحّ إن لم تكن ثمّة جملةٌ مقتبسة.
     ولهذا جسرانِ لا واحد، وإلا أشار الردّ إلى غائب. */
  const opening = quote
    ? [rotate(LETTER_OPENERS, `o:${salt}`)(source), `«${quote}»`]
    : [rotate(LETTER_OPENERS_PLAIN, `o:${salt}`)(source)];
  const bridges = quote ? LETTER_BRIDGES : LETTER_BRIDGES_PLAIN;
  const message = [
    ...opening,
    rotate(bridges, `b:${salt}`),
    rotate(LETTER_CLOSERS, `c:${salt}`),
  ].join(" ");
  return validateLetter({ message, reply: rotate(REPLY_POOL, `r:${salt}`) });
}

/* ═══ الأسئلة — تلقائية، مرتبطة بالمصدر، وصالحة للنشر حتى بلا نموذج لغوي ═══
 *
 * يختار النظام موضوعاً يطابق المادة المنشورة، ثم يصوغ سؤالاً متنوعاً ويجيبه
 * بمبدأ تحريري واضح من معايير الموقع. لا يقتطع جملة عشوائية من منتصف مقال،
 * ولا ينسب إلى قارئ مجهول كلاماً لم يرسله، ولا يحتاج إلى تدخل يدوي.
 */
const FAQ_FRAMES = [
  (topic) => `ما الذي يجب أن نبدأ به قبل الحديث عن «${topic}»؟`,
  (topic) => `كيف نعرف أن «${topic}» أثّر فعلاً لا شكلاً؟`,
  (topic) => `ما أكثر خطأ يتكرر في «${topic}»؟`,
  (topic) => `أين يقف دور الإنسان في «${topic}»؟`,
  (topic) => `ما الفرق بين التحسين الحقيقي والتحسين الظاهري في «${topic}»؟`,
  (topic) => `ماذا نفعل حين تتعارض السرعة مع الجودة في «${topic}»؟`,
  (topic) => `ما الذي يغفل عنه كثيرون حين يتحدثون عن «${topic}»؟`,
  (topic) => `من أين نبدأ التغيير في «${topic}» إذا كانت الإمكانات محدودة؟`,
  (topic) => `هل «${topic}» مسؤولية المؤسسة وحدها أم الأسرة معها؟`,
  (topic) => `ما المعيار الذي نحكم به على نجاح «${topic}»؟`,
];

const FAQ_PRINCIPLES = {
  "تكنولوجيا التعليم":
    "ابدأ من هدف التعلم ثم اختر أبسط تقنية تخدمه؛ فالأداة الجيدة تُقاس بما تغيّره في الفهم والممارسة، لا بما تضيفه من بهرجة.",
  "الذكاء الاصطناعي والتعليم":
    "استخدم الذكاء الاصطناعي لتوسيع التفكير والمقارنة والتغذية الراجعة، لا ليحلّ محل المحاولة أو يقدّم ناتجاً لا يستطيع المتعلم شرحه.",
  "التربية الأسرية":
    "تبدأ التربية من اتفاق واضح بين القدوة والحدود والحوار؛ فالتوجيه المتناقض يربك الابن أكثر مما يصلحه كثرة النصح.",
  "الطفل والتكنولوجيا":
    "راقب ما ينتجه الطفل بعد الاستخدام، لا عدد الدقائق وحده؛ فالسؤال والمهارة والمشروع علامات تعلم، أما الاستهلاك الطويل بلا أثر فيحتاج مراجعة.",
  "المعلم وتطوير الممارسة":
    "يتطور المعلم حين يغيّر ممارسة صغيرة داخل الصف، يلاحظ أثرها، ثم يعدّلها؛ أما كثرة الدورات بلا تطبيق فلا تكفي.",
  "التقييم والقياس":
    "اجعل الدرجة مؤشراً ضمن أدلة متعددة، واطلب تفسيراً وتطبيقاً ومقارنة؛ فالفهم يظهر عندما تتحرك المعرفة في موقف جديد.",
  "التفكير النقدي":
    "ابنِ الحكم على سؤال ودليل ومقارنة بين البدائل، ثم اطلب من المتعلم أن يشرح سبب قراره لا أن يكرر النتيجة فقط.",
  "الهوية الرقمية":
    "تعامل مع الأثر الرقمي بوصفه امتداداً للهوية: ما ننشره وما نسمح بجمعه وما نصدقه يحتاج وعياً وحدوداً ومراجعة مستمرة.",
  "أخلاقيات التقنية":
    "اسأل قبل الاستخدام: من يستفيد، ومن قد يتضرر، وما البيانات التي تُجمع، وهل يستطيع الإنسان الاعتراض أو التصحيح؟",
  "البحث العلمي":
    "ابدأ بسؤال محدد ومصدر موثوق ومنهج يمكن مراجعته؛ فالقيمة ليست في كثرة المراجع، بل في سلامة الاستدلال ووضوح الحدود.",
  "التعليم الجامعي":
    "يرتفع أثر الجامعة عندما تربط المعرفة بمشكلة حقيقية، وتمنح الطالب فرصة للبحث والتطبيق والدفاع عن قراره.",
  "التعلم الإلكتروني":
    "لا تنقل المحاضرة نفسها إلى شاشة؛ صمّم مهمة وتفاعلاً وتغذية راجعة، ثم تأكد أن المتعلم يستطيع الإنجاز لا المشاهدة فقط.",
  "المدارس الذكية":
    "المدرسة الذكية ليست مبنى مليئاً بالأجهزة؛ هي منظومة تستخدم البيانات والتقنية لتحسين قرار تربوي واضح مع حماية الإنسان وخصوصيته.",
  "التلعيب والألعاب التعليمية":
    "استخدم عناصر اللعب لخدمة هدف محدد وتغذية راجعة ذات معنى، لا لتحويل التعلم إلى جمع نقاط ومكافآت فقط.",
  "ذوو الاحتياجات الخاصة والتقنيات المساندة":
    "ابدأ من حاجات المتعلم الفعلية وشاركه الاختيار، ثم اختبر سهولة الوصول والاستقلالية بدل الاكتفاء بتوفير الجهاز.",
  "القيادة والابتكار":
    "حوّل الفكرة إلى تجربة صغيرة لها مسؤول وموعد ومؤشر أثر؛ فالابتكار الذي لا يدخل التشغيل يبقى عرضاً جميلاً.",
  "الإعلام والمجتمع الرقمي":
    "افصل بين سرعة الانتشار وصدق المحتوى، وراجع المصدر والسياق والمصلحة قبل المشاركة؛ فالتفاعل ليس دليلاً على الموثوقية.",
  "الصحة النفسية في البيئة التعليمية":
    "اصنع بيئة تسمح بالخطأ والسؤال وطلب المساعدة، وراقب التغير المستمر في السلوك أو الأداء بدل تفسير كل تعثر على أنه كسل.",
};

const FAQ_TAILS = [
  "والاختبار الحقيقي هو أثر يمكن ملاحظته ومراجعته.",
  "ابدأ بنطاق صغير، ثم وسّع ما يثبت نفعه.",
  "وضوح الغاية قبل التنفيذ يمنع كثيراً من الهدر.",
  "لا تجعل سهولة الأداة بديلاً عن جودة القرار.",
  "الممارسة اليومية أصدق من الشعار عند قياس النجاح.",
  "راجِع النتيجة مع من يتأثر بها، لا مع من صمّمها فقط.",
  "ما لا يمكن تفسيره للمتعلم أو الأسرة يحتاج تبسيطاً قبل اعتماده.",
  "التوازن بين الفاعلية والإنسانية جزء من الجودة، لا إضافة لاحقة.",
];

function fallbackFaq(source, topic) {
  const salt = `${source?.key || "x"}:${topic}`;
  const q = rotate(FAQ_FRAMES, `q:${salt}`)(topic);
  const principle =
    FAQ_PRINCIPLES[topic] || FAQ_PRINCIPLES["تكنولوجيا التعليم"];
  const tail = rotate(FAQ_TAILS, `a:${salt}`);
  const a = principle.endsWith(tail) ? principle : `${principle} ${tail}`;
  return validateFaq({ q, a });
}

const pickKinds = new Set([
  "اقتباس وتأمل",
  "الرف المنسي",
  "أداة تستحق",
  "مفهوم ناشئ",
  "رؤية عميقة",
]);

function validatePick(output, source) {
  const ar = clean(output?.ar);
  const arNote = clean(output?.arNote);
  const en = clean(output?.en);
  const enNote = clean(output?.enNote);
  const kind = pickKinds.has(clean(output?.kind))
    ? clean(output.kind)
    : "رؤية عميقة";
  if (ar.length < 12 || ar.length > 170)
    throw new Error(`عنوان المختارة غير صالح: ${ar.length}`);
  if (arNote.length < 25 || arNote.length > 240)
    throw new Error(`ملاحظة المختارة غير صالحة: ${arNote.length}`);
  if (en.length < 10 || en.length > 190)
    throw new Error(`عنوان المختارة الإنجليزي غير صالح: ${en.length}`);
  if (enNote.length < 20 || enNote.length > 260)
    throw new Error(`ملاحظة المختارة الإنجليزية غير صالحة: ${enNote.length}`);
  return {
    kind,
    ar,
    arNote,
    en,
    enNote,
    source: `د. أحمد حسين الفيلكاوي · ${source.type}`,
    url: source.url,
  };
}

async function generateLetter(source, style) {
  const prompt = `أنت محرر عربي يكتب لموقع د. أحمد حسين الفيلكاوي، أستاذ تكنولوجيا التعليم والذكاء الاصطناعي.
اكتب رسالة قصيرة تبدو كتعليق قارئ ذكي على مادة للدكتور، بنبرة: «${style}».
المادة التي يجب أن تبني عليها النص حصراً:
النوع: ${source.type}
العنوان: ${source.title}
المجال: ${source.category}
النص: ${source.text}

أعد JSON فقط:
{"message":"...","reply":"..."}

قواعد ملزمة:
- الرسالة 70–125 كلمة، عربية بيضاء، إنسانية، ذكية، ولا تبدأ كل مرة بالعبارة نفسها.
- نوّع البناء: مرة ملاحظة، مرة سؤال، مرة امتنان، مرة اعتراض مهذب، ومرة مفارقة.
- يجوز أن تبدأ بـ«دكتور أحمد» أو تدخل في الفكرة مباشرة.
- لا تذكر اسماً أو بريداً أو مدينة أو جهة أو توقيعاً للكاتب.
- لا تدّعِ حادثة شخصية محددة، ولا شهادة نجاح، ولا نتيجة واقعية لم تقع.
- لا تقل إن الرسالة وصلت بالبريد، ولا تستخدم عبارة «أنا أحد قرائك».
- اربط الرسالة بفكرة حقيقية من المادة، ولا تنسخ منها فقرة طويلة.
- الرد 15–35 كلمة، بصوت د. أحمد، واضح وغير متكلّف.
- لا تستخدم وسوماً أو Markdown.`;
  try {
    return {
      ...validateLetter(await geminiJson(prompt)),
      generationMode: "ai",
    };
  } catch (error) {
    console.warn(
      `⚠ تعذر تحسين الرسالة بالذكاء الاصطناعي؛ استُخدمت الصياغة التحريرية الاحتياطية: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      ...fallbackLetter(source, style),
      generationMode: "editorial-fallback",
    };
  }
}

async function generateFaq(source, topic) {
  const prompt = `أنت مساعد تحريري لموقع د. أحمد حسين الفيلكاوي.
أنشئ سؤالاً عاماً قصيراً جداً في مجال «${topic}»، مستنداً إلى الفكرة الآتية من محتوى الدكتور:
النوع: ${source.type}
العنوان: ${source.title}
النص: ${source.text}

أعد JSON فقط:
{"q":"...","a":"..."}

القواعد:
- السؤال مستقل ومفهوم ومن تخصصات واهتمامات الدكتور، وليس خبراً آنياً.
- نوّع بين التربية، التعليم، التقنية، الذكاء الاصطناعي، الأسرة، الطفل، المعلم، البحث، القيادة والمجتمع الرقمي.
- الإجابة جملة أو جملتان فقط، عملية وواضحة، من 18 إلى 42 كلمة.
- لا تكرر عنوان المادة حرفياً.
- لا تستخدم ادعاءات طبية أو قانونية أو أرقاماً غير موجودة في النص.
- لا تستخدم Markdown.`;
  try {
    return { ...validateFaq(await geminiJson(prompt)), generationMode: "ai" };
  } catch (error) {
    console.warn(
      `⚠ تعذر تحسين السؤال بالذكاء الاصطناعي؛ استُخدمت الصياغة التحريرية الاحتياطية: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      ...fallbackFaq(source, topic),
      generationMode: "editorial-fallback",
    };
  }
}

async function generatePick(source) {
  const prompt = `أنت محرر ثنائي اللغة لقسم «المختارات» في موقع د. أحمد حسين الفيلكاوي.
حوّل المادة التالية إلى مختارة قصيرة تقود القارئ إلى المصدر الأصلي:
النوع: ${source.type}
العنوان: ${source.title}
المجال: ${source.category}
النص: ${source.text}

أعد JSON فقط:
{"kind":"رؤية عميقة أو مفهوم ناشئ أو الرف المنسي أو اقتباس وتأمل","ar":"...","arNote":"...","en":"...","enNote":"..."}

قواعد ملزمة:
- لا تخترع معلومة أو رقماً أو اقتباساً غير موجود.
- العنوان العربي واضح وجذاب، والملاحظة تشرح لماذا تستحق المادة وقت القارئ.
- الإنجليزية صياغة طبيعية وليست ترجمة حرفية ركيكة.
- لا تستخدم Markdown، ولا تذكر أن النص مولد آلياً.
- إذا كانت المادة لقاءً فصنّفها «رؤية عميقة»، وإذا كانت كتاباً يجوز «الرف المنسي»، وإذا كانت مقالاً اختر الأنسب.`;
  return validatePick(await geminiJson(prompt), source);
}

async function firebaseContext() {
  const saPath = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || "sa.json");
  if (!existsSync(saPath)) throw new Error(`ملف حساب الخدمة مفقود: ${saPath}`);
  const [
    { initializeApp, cert, getApps },
    { getFirestore, Timestamp, FieldValue },
  ] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/firestore"),
  ]);
  const serviceAccount = JSON.parse(readFileSync(saPath, "utf8"));
  const app =
    getApps()[0] ||
    initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
  return { db: getFirestore(app), Timestamp, FieldValue };
}

async function recentDocs(db, collectionName, limit = 80) {
  try {
    const snapshot = await db
      .collection(collectionName)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    }));
  } catch {
    const snapshot = await db.collection(collectionName).limit(limit).get();
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    }));
  }
}

async function run() {
  const sources = loadSources();
  if (SELF_TEST) {
    const articles = sources.filter((item) => item.type === "مقال").length;
    const books = sources.filter((item) => item.type === "كتاب").length;
    const media = sources.filter((item) => item.type === "لقاء").length;
    if (articles < 100 || books < 5 || media < 3)
      throw new Error(`مصادر غير كافية: ${articles}/${books}/${media}`);

    /* ═══ حراسةُ التنويع ═══
     *
     * القالب القديم كان يكتب السؤال نفسه في كل مرة («كيف نعرف أن تطبيق س
     * يحقق أثراً حقيقياً؟») بالإجابة نفسها. ولم يكن ثمّة اختبارٌ يكشف ذلك،
     * فمرّ شهوراً. هذا الاختبار يقيس التنويع رقمياً ويمنع عودته صامتاً.
     */
    const prose = sources.filter((item) => item.type === "مقال");
    const letterSamples = prose
      .slice(0, 60)
      .map((source, index) =>
        fallbackLetter(source, styles[index % styles.length]),
      );
    const uniqueLetters = new Set(letterSamples.map((letter) => letter.message))
      .size;
    if (uniqueLetters < letterSamples.length)
      throw new Error(`رسائل مكرّرة: ${uniqueLetters}/${letterSamples.length}`);

    const faqSamples = prose
      .slice(0, 60)
      .map((source, index) =>
        fallbackFaq(source, chooseTopicForSource(source, new Set(), index)),
      );
    const uniqueQuestions = new Set(faqSamples.map((faq) => faq.q)).size;
    const uniqueAnswers = new Set(faqSamples.map((faq) => faq.a)).size;
    if (uniqueQuestions < 24)
      throw new Error(`أسئلة قليلة التنويع: ${uniqueQuestions}/60`);
    if (uniqueAnswers < 36)
      throw new Error(`أجوبة قليلة التنويع: ${uniqueAnswers}/60`);

    /* بوابة جودة الاحتياط التحريري: لا جواب مبتور، ولا أحرف لاتينية،
       ولا صياغة قصيرة تُشبه عنواناً بدلاً من جواب. */
    faqSamples.forEach((faq) => {
      if (faq.a.length < 70 || /[A-Za-z]/.test(faq.a))
        throw new Error(
          `★ جواب احتياطي غير صالح للنشر: «${faq.a.slice(0, 60)}…»`,
        );
    });

    /* اللقاءات لا تُقتبس: نصّها سطر وصفي لا كلام قاله الضيف. */
    for (const interview of sources
      .filter((item) => item.type === "لقاء")
      .slice(0, 5)) {
      const letter = fallbackLetter(interview, styles[0]);
      if (letter.message.includes("«لقاء بعنوان"))
        throw new Error("★ اقتُبس سطر مصنوع كأنه كلام الدكتور");
      const topic = chooseTopicForSource(interview, new Set(), 0);
      validateFaq(fallbackFaq(interview, topic));
    }

    const selected = [0, 1, 2].map((index) =>
      chooseDiverseSource(sources, new Set(), index + 2),
    );
    console.log(
      JSON.stringify(
        {
          ok: true,
          version: GENERATION_VERSION,
          total: sources.length,
          articles,
          books,
          media,
          bootstrap: { letters: MIN_LETTERS, faqs: MIN_FAQS },
          variety: {
            sampled: 60,
            uniqueLetters,
            uniqueQuestions,
            uniqueAnswers,
            engine: "professional deterministic fallback (no LLM)",
          },
          fallback: {
            letter: fallbackLetter(selected[0], styles[0]),
            faq: fallbackFaq(selected[1], topicFamilies[0]),
          },
          samples: selected.map((item) => ({
            type: item.type,
            title: item.title,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const { db, Timestamp, FieldValue } = await firebaseContext();
  const stateRef = db.collection(STATE_COLLECTION).doc(STATE_DOC);
  const stateSnap = await stateRef.get();
  const state = stateSnap.exists ? stateSnap.data() : {};

  try {
    const [recentLetters, recentFaqs, recentPicks] = await Promise.all([
      recentDocs(db, "site_inbox"),
      recentDocs(db, "site_faqs"),
      recentDocs(db, "site_picks"),
    ]);

    const publishedLetters = recentLetters.filter(isPublished);
    const publishedFaqs = recentFaqs.filter(isPublished);
    const publishedPicks = recentPicks.filter(isPublished);
    const letterDeficit = Math.max(0, MIN_LETTERS - publishedLetters.length);
    const faqDeficit = Math.max(0, MIN_FAQS - publishedFaqs.length);
    const pickDeficit = Math.max(0, MIN_PICKS - publishedPicks.length);
    const letterDue =
      due(state?.nextLetterAt) && !createdToday(publishedLetters);
    const faqDue = due(state?.nextFaqAt) && !createdToday(publishedFaqs);
    const pickDue = due(state?.nextPickAt) && !createdToday(publishedPicks);
    const letterTarget = Math.min(
      MAX_GENERATED_PER_KIND,
      Math.max(letterDeficit, letterDue ? 1 : 0),
    );
    const faqTarget = Math.min(
      MAX_GENERATED_PER_KIND,
      Math.max(faqDeficit, faqDue ? 1 : 0),
    );
    const pickTarget = 0; // متعمد: site_picks المحلي متوقف نهائياً

    const usedSourceKeys = new Set([
      ...recentLetters.map((item) => item.sourceKey).filter(Boolean),
      ...recentFaqs.map((item) => item.sourceKey).filter(Boolean),
      ...recentPicks.map((item) => item.sourceKey).filter(Boolean),
    ]);
    const usedStyles = new Set(
      recentLetters
        .slice(0, styles.length)
        .map((item) => item.tone)
        .filter(Boolean),
    );
    const usedTopics = new Set(
      recentFaqs
        .slice(0, topicFamilies.length)
        .map((item) => item.topicFamily)
        .filter(Boolean),
    );

    let published = 0;
    let lettersPublished = 0;
    let faqsPublished = 0;
    let picksPublished = 0;

    for (let index = 0; index < letterTarget; index += 1) {
      const source = chooseDiverseSource(sources, usedSourceKeys, 11 + index);
      const style = chooseUnusedText(styles, usedStyles, 7 + index);
      const letter = await generateLetter(source, style);
      const id = `auto-letter-${isoDay(now)}-${hash(`${source.key}:${style}`)}`;
      await db
        .collection("site_inbox")
        .doc(id)
        .set(
          {
            ...letter,
            tone: style,
            sourceKey: source.key,
            sourceType: source.type,
            sourceTitle: source.title,
            sourcePath: source.url,
            autoGenerated: true,
            generationVersion: GENERATION_VERSION,
            status: "published",
            published: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: false },
        );
      published += 1;
      lettersPublished += 1;
      usedSourceKeys.add(source.key);
      usedStyles.add(style);
      console.log(`✔ رسالة جديدة: ${source.type} · ${source.title} · ${style}`);
    }

    for (let index = 0; index < faqTarget; index += 1) {
      const source = chooseDiverseSource(sources, usedSourceKeys, 29 + index);
      const topic = chooseTopicForSource(source, usedTopics, 17 + index);
      const faq = await generateFaq(source, topic);
      const id = `auto-faq-${isoDay(now)}-${hash(`${source.key}:${topic}`)}`;
      await db
        .collection("site_faqs")
        .doc(id)
        .set(
          {
            ...faq,
            topicFamily: topic,
            sourceKey: source.key,
            sourceType: source.type,
            sourceTitle: source.title,
            sourcePath: source.url,
            autoGenerated: true,
            generationVersion: GENERATION_VERSION,
            status: "published",
            published: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: false },
        );
      published += 1;
      faqsPublished += 1;
      usedSourceKeys.add(source.key);
      usedTopics.add(topic);
      console.log(`✔ سؤال جديد: ${faq.q} · ${topic}`);
    }

    for (let index = 0; index < pickTarget; index += 1) {
      const source = chooseDiverseSource(sources, usedSourceKeys, 47 + index);
      const pick = await generatePick(source);
      const id = `auto-pick-${isoDay(now)}-${hash(source.key)}`;
      await db
        .collection("site_picks")
        .doc(id)
        .set(
          {
            ...pick,
            sourceKey: source.key,
            sourceType: source.type,
            sourceTitle: source.title,
            sourcePath: source.url,
            autoGenerated: true,
            generationVersion: GENERATION_VERSION,
            added: isoDay(now),
            status: "published",
            published: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: false },
        );
      published += 1;
      picksPublished += 1;
      usedSourceKeys.add(source.key);
      console.log(`✔ مختارة جديدة: ${source.type} · ${source.title}`);
    }

    const statePatch = {
      generationVersion: GENERATION_VERSION,
      updatedAt: FieldValue.serverTimestamp(),
      lastRunAt: FieldValue.serverTimestamp(),
      lastSuccessAt: FieldValue.serverTimestamp(),
      lastStatus: "ok",
      lastPublishedCount: published,
      lastLettersPublished: lettersPublished,
      lastFaqsPublished: faqsPublished,
      lastPicksPublished: picksPublished,
      minimumLetters: MIN_LETTERS,
      minimumFaqs: MIN_FAQS,
      minimumPicks: MIN_PICKS,
    };

    if (lettersPublished > 0) {
      statePatch.lastLetterAt = FieldValue.serverTimestamp();
      statePatch.nextLetterAt = Timestamp.fromDate(addDays(now, 3));
    }
    if (faqsPublished > 0) {
      statePatch.lastFaqAt = FieldValue.serverTimestamp();
      statePatch.nextFaqAt = Timestamp.fromDate(addDays(now, 2));
    }
    if (picksPublished > 0) {
      statePatch.lastPickAt = FieldValue.serverTimestamp();
      statePatch.nextPickAt = Timestamp.fromDate(addDays(now, 2));
    }

    await stateRef.set(statePatch, { merge: true });

    if (published) {
      console.log(
        `\n✔ نُشر ${published} عنصر تلقائياً: ${lettersPublished} رسالة، ${faqsPublished} سؤال.`,
      );
    } else {
      const nextLetter =
        normalizeTimestamp(state?.nextLetterAt)?.toISOString() || "غير محدد";
      const nextFaq =
        normalizeTimestamp(state?.nextFaqAt)?.toISOString() || "غير محدد";
      console.log(
        `\n✔ لا نشر الآن؛ الأرشيف سليم. الرسالة التالية: ${nextLetter} · السؤال التالي: ${nextFaq}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await stateRef
      .set(
        {
          generationVersion: GENERATION_VERSION,
          lastRunAt: FieldValue.serverTimestamp(),
          lastStatus: "error",
          lastError: message.slice(0, 500),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      .catch(() => {});
    throw error;
  }
}

try {
  await run();
} catch (error) {
  console.error(
    `✖ فشل النشر التلقائي: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
