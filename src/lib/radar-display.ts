/**
 * طبقة العرض العربية للمختارات والرادار.
 * تبقى أسماء المصادر والنصوص الأصلية محفوظة في البيانات للتحقق والرابط،
 * بينما لا تظهر في الواجهة أحرف لاتينية أو تواريخ خام.
 */
const SOURCE_LABELS: Record<string, string> = {
  "Times Kuwait": "تايمز الكويت",
  "Times Kuwait — Education": "تايمز الكويت — التعليم",
  "MIT Technology Review": "مجلة معهد ماساتشوستس للتقنية",
  EdSurge: "إدسيرج",
  Edutopia: "إديوتوبيا",
  "The Hechinger Report": "تقرير هيتشنغر",
  ScienceDaily: "ساينس ديلي",
  "MIT News": "أخبار معهد ماساتشوستس للتقنية",
  "The Conversation": "ذا كونفرسيشن",
  Reuters: "رويترز",
  "Project Gutenberg": "مشروع غوتنبرغ",
  "Ivan Illich": "إيفان إيليتش",
  "Paulo Freire": "باولو فريري",
  "Neil Postman": "نيل بوستمان",
  Google: "غوغل",
  "Corporation for Digital Scholarship": "مؤسسة المنح الرقمية",
  "Connected Papers": "كونكتد بيبرز",
  "Allen Institute for AI": "معهد ألن للذكاء الاصطناعي",
  "Khan Academy (غير ربحية)": "أكاديمية خان — مؤسسة غير ربحية",
  MIT: "معهد ماساتشوستس للتقنية",
  CAST: "مؤسسة كاست",
  "TED (2006)": "منصة تِد — ٢٠٠٦",
  "Stanford HAI": "معهد ستانفورد للذكاء الاصطناعي المتمحور حول الإنسان",
  OECD: "منظمة التعاون الاقتصادي والتنمية",
  "George Lucas Educational Foundation": "مؤسسة جورج لوكاس التعليمية",
  "Carol Dweck — Stanford (2006)": "كارول دويك — جامعة ستانفورد، ٢٠٠٦",
  "Ken Robinson (2015)": "كين روبنسون — ٢٠١٥",
  "Cal Newport (2016)": "كال نيوبورت — ٢٠١٦",
  "Nicholas Carr (2010) — نهائي بوليتزر":
    "نيكولاس كار — ٢٠١٠، من نهائيات بوليتزر",
  "بلوتارخ — «في الإصغاء» (Moralia)": "بلوتارخ — «في الإصغاء» من كتاب الأخلاق",
};

const LATIN = /[A-Za-z]/;
const ARABIC = /[\u0600-\u06ff]/;
const COMMON_TERMS: Array<[RegExp, string]> = [
  [/\bChatGPT\b/gi, "شات جي بي تي"],
  [/\bNotebookLM\b/gi, "نوتبوك إل إم"],
  [/\bGoogle\b/gi, "غوغل"],
  [/\bMicrosoft\b/gi, "مايكروسوفت"],
  [/\bOpenAI\b/gi, "أوبن إيه آي"],
  [/\bAI\b/gi, "الذكاء الاصطناعي"],
  [/\bLMS\b/gi, "نظام إدارة التعلّم"],
  [/\bSTEM\b/gi, "العلوم والتقنية والهندسة والرياضيات"],
];

/** آخر حاجز عرض: السجلات القديمة أو المتعثرة لا تستطيع إعادة عنوان إنجليزي للزائر. */
export function radarTextArabic(value: unknown, fallback: string) {
  let text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return fallback;
  for (const [pattern, replacement] of COMMON_TERMS)
    text = text.replace(pattern, replacement);
  if (LATIN.test(text)) {
    text = text
      .replace(/[A-Za-z][A-Za-z0-9+.#/_-]*/g, "")
      .replace(/\s+([،؛:.!?؟])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return ARABIC.test(text) ? text : fallback;
}

export function radarSourceArabic(value = "") {
  const source = String(value || "").trim();
  if (!source) return "مصدر موثوق";
  if (SOURCE_LABELS[source]) return SOURCE_LABELS[source];

  // بعض السجلات القديمة تحفظ اسم المصدر متبوعاً بتاريخ أو وصف.
  const [head, ...tail] = source.split(" · ");
  if (SOURCE_LABELS[head]) {
    const suffix = tail.join(" · ").trim();
    const safeSuffix = suffix && !LATIN.test(suffix) ? suffix : "";
    return safeSuffix
      ? `${SOURCE_LABELS[head]} · ${safeSuffix}`
      : SOURCE_LABELS[head];
  }

  // لا نعيد الأحرف اللاتينية إلى صفحة اشترط مالكها أن تكون عربية بالكامل.
  return LATIN.test(source) ? "مصدر دولي موثوق" : source;
}

export function radarDateArabic(iso = "") {
  if (!iso) return "حديث";
  try {
    const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "حديث";
    return date.toLocaleDateString("ar-KW-u-nu-arab", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "حديث";
  }
}
