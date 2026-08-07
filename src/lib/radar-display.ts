/**
 * طبقة العرض العربية للمختارات والرادار.
 * تبقى أسماء المصادر والنصوص الأصلية محفوظة في البيانات للتحقق والرابط،
 * بينما لا تظهر في الواجهة أحرف لاتينية أو تواريخ خام.
 */
const SOURCE_LABELS: Record<string, string> = {
  "Times Kuwait": "تايمز الكويت",
  "Times Kuwait — Education": "تايمز الكويت — التعليم",
  "MIT Technology Review": "مجلة معهد ماساتشوستس للتكنولوجيا",
  EdSurge: "إدسيرج",
  Edutopia: "إديوتوبيا",
  "The Hechinger Report": "تقرير هيتشنغر",
  ScienceDaily: "ساينس ديلي",
  "MIT News": "أخبار معهد ماساتشوستس للتكنولوجيا",
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
  MIT: "معهد ماساتشوستس للتكنولوجيا",
  CAST: "مؤسسة كاست",
  "TED (2006)": "منصة تِد — 2006",
  "Stanford HAI": "معهد ستانفورد للذكاء الاصطناعي المتمحور حول الإنسان",
  OECD: "منظمة التعاون الاقتصادي والتنمية",
  "George Lucas Educational Foundation": "مؤسسة جورج لوكاس التعليمية",
  "Carol Dweck — Stanford (2006)": "كارول دويك — جامعة ستانفورد، 2006",
  "Ken Robinson (2015)": "كين روبنسون — 2015",
  "Cal Newport (2016)": "كال نيوبورت — 2016",
  "Nicholas Carr (2010) — نهائي بوليتزر":
    "نيكولاس كار — 2010، من نهائيات بوليتزر",
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
  [/\bSTEM\b/gi, "العلوم والتكنولوجيا والهندسة والرياضيات"],
];

/* ترجمات بشرية مثبتة للمواد التي وصلت قبل تشديد بوابة التعريب. لا نعرض
   عبارةً عامة مكان العنوان: إما ترجمة عربية حقيقية، أو لا تُنشر البطاقة. */
const KNOWN_TITLES: Record<string, string> = {
  "These Hip-Hop Artists Were Already Teaching":
    "فنانو الهيب هوب هؤلاء كانوا يمارسون التعليم بالفعل",
  "OPINION: The days of ‘good guy’ capitalists are over. College students are right to turn against the tech elites":
    "رأي: انتهى زمن «الرأسمالي الطيب»… ومن حق طلبة الجامعات مساءلة نخب التكنولوجيا",
  "OPINION: The days of 'good guy' capitalists are over. College students are right to turn against the tech elites":
    "رأي: انتهى زمن «الرأسمالي الطيب»… ومن حق طلبة الجامعات مساءلة نخب التكنولوجيا",
  "PRINCIPAL VOICE: Our off-track high school students weren’t terribly interested in school until we dug into hands-on learning":
    "صوت مدير مدرسة: لم يستعد طلابنا المتعثرون اهتمامهم بالدراسة إلا بالتعلّم التطبيقي",
  "PRINCIPAL VOICE: Our off-track high school students weren't terribly interested in school until we dug into hands-on learning":
    "صوت مدير مدرسة: لم يستعد طلابنا المتعثرون اهتمامهم بالدراسة إلا بالتعلّم التطبيقي",
};

const KNOWN_NOTES: Record<string, string> = {
  "These Hip-Hop Artists Were Already Teaching":
    "برنامج جامعي جديد يمنح فناني الهيب هوب اعتماداً أكاديمياً لنقل خبراتهم المجتمعية والواقعية إلى الصفوف الدراسية.",
  "OPINION: The days of ‘good guy’ capitalists are over. College students are right to turn against the tech elites":
    "قراءة نقدية في تحوّل نظرة الجيل الجديد إلى قادة شركات التكنولوجيا وعلاقتهم بالجامعات والمجتمع.",
  "OPINION: The days of 'good guy' capitalists are over. College students are right to turn against the tech elites":
    "قراءة نقدية في تحوّل نظرة الجيل الجديد إلى قادة شركات التكنولوجيا وعلاقتهم بالجامعات والمجتمع.",
  "PRINCIPAL VOICE: Our off-track high school students weren’t terribly interested in school until we dug into hands-on learning":
    "تجربة مدرسية أعادت إشراك طلاب كانوا بعيدين عن المسار الدراسي عبر تعلّم عملي مرتبط بالحياة والعمل.",
  "PRINCIPAL VOICE: Our off-track high school students weren't terribly interested in school until we dug into hands-on learning":
    "تجربة مدرسية أعادت إشراك طلاب كانوا بعيدين عن المسار الدراسي عبر تعلّم عملي مرتبط بالحياة والعمل.",
};

const GENERIC_AR = [
  /^مادة حديثة(?: موثوقة)?(?: حول| في)/,
  /^التقطها الرادار/,
  /^اختارها الرادار/,
  /^مادة حديثة قيد المراجعة/,
];

function cleanArabic(value: unknown) {
  let text = String(value || "").replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of COMMON_TERMS) text = text.replace(pattern, replacement);
  if (!text || !ARABIC.test(text) || LATIN.test(text) || GENERIC_AR.some((pattern) => pattern.test(text))) return "";
  return text;
}

export function radarArabicTitle(ar: unknown, en: unknown = "") {
  const genuine = cleanArabic(ar);
  if (genuine) return genuine;
  return KNOWN_TITLES[String(en || "").trim()] || "";
}

export function radarArabicNote(arNote: unknown, en: unknown = "") {
  const genuine = cleanArabic(arNote);
  if (genuine) return genuine;
  return KNOWN_NOTES[String(en || "").trim()] || "";
}

/** للتوافق مع الاستدعاءات القديمة: لا يُنشئ نصاً عاماً بعد الآن. */
export function radarTextArabic(value: unknown, fallback = "") {
  return cleanArabic(value) || fallback;
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
