/**
 * «من اختياراتي» — مخزون المعرفة المنسَّق
 *
 * الهيكل: إيقاع ثلاثي
 *   يومي   ← «جديد اليوم»: عنصر يتبدل كل يوم تلقائياً من هذا المخزون
 *   أسبوعي ← «سؤال يُقلق التعليم» (صفحته المستقلة /questions)
 *   شهري  ← «كتاب الشهر»: يتبدل أول كل شهر من رف الكتب
 *
 * القواعد الصارمة:
 *   · كل عنصر بالعربية والإنجليزية
 *   · كل عنصر من مصدر موثوق مُسمّى (لا مجهول، لا منحول)
 *   · الأسماء أدناه إحياء لأركان الموقع القديم — بالعربية هذه المرة
 *
 * ملف مستقل عمداً: يُحمَّل فقط مع صفحة المختارات (كسولة).
 */

export type CurioKind = 'اقتباس وتأمل' | 'الرف المنسي' | 'أداة تستحق' | 'مفهوم ناشئ' | 'رؤية عميقة' | 'كتاب الشهر'

export type Curio = {
  kind: CurioKind
  ar: string           // العنوان/النص بالعربية
  arNote?: string      // سطر توضيحي عربي
  en: string           // English title/text
  enNote?: string      // English one-liner
  source: string       // المصدر الموثوق — يظهر دائماً
  url?: string         // رابط المصدر إنوُجد — الكرت كله يقود إليه
}

export const CURATED_EPOCH = '2026-07-01'

/* ─── المخزون اليومي (يتناوب عنصر كل يوم) ─── */
export const curatedBank: Curio[] = [
  /* اقتباس وتأمل */
  { kind: 'اقتباس وتأمل',
    ar: '«العقل ليس وعاءً يُملأ، بل نارٌ تُوقَد.»',
    arNote: 'يُنسب خطأً لييتس — أصله عند بلوتارخ قبل ألفي عام.',
    en: '“The mind is not a vessel to be filled, but a fire to be kindled.”',
    enNote: 'Commonly misattributed to Yeats — the idea is Plutarch’s.',
    source: 'بلوتارخ — «في الإصغاء» (Moralia)' },
  { kind: 'اقتباس وتأمل',
    ar: '«التعليم ليس إعداداً للحياة؛ التعليم هو الحياة ذاتها.»',
    en: '“Education is not preparation for life; education is life itself.”',
    source: 'جون ديوي — «عقيدتي التربوية» (١٨٩٧)',
    url: 'https://en.wikisource.org/wiki/My_Pedagogic_Creed' },
  { kind: 'اقتباس وتأمل',
    ar: '«لا أحد يُعلِّم أحداً، ولا أحد يتعلم وحده؛ الناس يتعلمون معاً، يتوسطهم العالم.»',
    en: '“No one teaches another, nor is anyone self-taught; people teach each other, mediated by the world.”',
    source: 'باولو فريري — «تربية المقهورين» (١٩٧٠)',
    url: 'https://en.wikipedia.org/wiki/Pedagogy_of_the_Oppressed' },
  { kind: 'اقتباس وتأمل',
    ar: '«إنّ الشدة على المتعلمين مُضرّةٌ بهم.»',
    arNote: 'عنوان فصل كامل في المقدمة — قبل ستة قرون من علم النفس التربوي.',
    en: '“Severity toward students does them harm.”',
    enNote: 'A full chapter title in the Muqaddimah — six centuries before educational psychology.',
    source: 'ابن خلدون — «المقدمة» (١٣٧٧م)' },
  { kind: 'اقتباس وتأمل',
    ar: '«العلمُ بلا عملٍ جنون، والعملُ بغير علمٍ لا يكون.»',
    en: '“Knowledge without action is madness; action without knowledge is void.”',
    source: 'أبو حامد الغزالي — «أيها الولد»' },
  { kind: 'اقتباس وتأمل',
    ar: '«لا يمكنك أن تعلّم الناس كل ما يحتاجونه؛ أفضل ما تفعله أن تضعهم حيث يجدون ما يحتاجونه حين يحتاجونه.»',
    en: '“You can’t teach people everything they need to know. The best you can do is position them where they can find what they need to know when they need to know it.”',
    source: 'سيمور بابرت — رائد البنائية وأبو لغة «لوغو»',
    url: 'https://en.wikipedia.org/wiki/Seymour_Papert' },

  /* الرف المنسي — كلاسيكيات تستحق العودة */
  { kind: 'الرف المنسي',
    ar: '«الديمقراطية والتعليم» — جون ديوي (١٩١٦)',
    arNote: 'الكتاب الذي أسس فلسفة التعليم الحديثة — متاح كاملاً مجاناً.',
    en: 'Democracy and Education — John Dewey (1916)',
    enNote: 'The book that founded modern philosophy of education — free full text.',
    source: 'Project Gutenberg',
    url: 'https://www.gutenberg.org/ebooks/852' },
  { kind: 'الرف المنسي',
    ar: '«مجتمع بلا مدارس» — إيفان إيليتش (١٩٧١)',
    arNote: 'أجرأ نقد للمؤسسة المدرسية — يقرأه اليوم جيل التعلم الذاتي فيجده نبوءة.',
    en: 'Deschooling Society — Ivan Illich (1971)',
    enNote: 'The boldest critique of schooling — today’s self-learners read it as prophecy.',
    source: 'Ivan Illich',
    url: 'https://en.wikipedia.org/wiki/Deschooling_Society' },
  { kind: 'الرف المنسي',
    ar: '«تربية المقهورين» — باولو فريري (١٩٧٠)',
    arNote: 'لماذا يكون التعليم إما أداة إخضاع أو ممارسة للحرية.',
    en: 'Pedagogy of the Oppressed — Paulo Freire (1970)',
    enNote: 'Why education is either an instrument of conformity or the practice of freedom.',
    source: 'Paulo Freire',
    url: 'https://en.wikipedia.org/wiki/Pedagogy_of_the_Oppressed' },
  { kind: 'الرف المنسي',
    ar: 'فصول التعليم في «المقدمة» — ابن خلدون (١٣٧٧م)',
    arNote: 'في تدرج التعليم، وضرر الشدة، وأن الملَكة لا تحصل إلا بالممارسة.',
    en: 'The education chapters of the Muqaddimah — Ibn Khaldun (1377)',
    enNote: 'On gradual instruction, the harm of severity, and skill through practice.',
    source: 'ابن خلدون' },
  { kind: 'الرف المنسي',
    ar: '«التسلية حتى الموت» — نيل بوستمان (١٩٨٥)',
    arNote: 'كُتب قبل الشاشات الذكية بعقود — ويقرأ حاضرنا حرفياً.',
    en: 'Amusing Ourselves to Death — Neil Postman (1985)',
    enNote: 'Written decades before smartphones — it reads our present literally.',
    source: 'Neil Postman',
    url: 'https://en.wikipedia.org/wiki/Amusing_Ourselves_to_Death' },

  /* أداة تستحق */
  { kind: 'أداة تستحق',
    ar: 'NotebookLM — تحاور مصادرك البحثية',
    arNote: 'ترفع مراجعك فيحاورك فيها، ويحوّلها بودكاست — من غوغل، مجاناً.',
    en: 'NotebookLM — converse with your own sources',
    enNote: 'Upload references, question them, get an audio overview — by Google, free.',
    source: 'Google',
    url: 'https://notebooklm.google.com' },
  { kind: 'أداة تستحق',
    ar: 'Zotero — مكتبة الباحث المفتوحة',
    arNote: 'إدارة المراجع والاقتباس بضغطة — المعيار الأكاديمي المفتوح منذ ٢٠٠٦.',
    en: 'Zotero — the open research library',
    enNote: 'Reference management and one-click citation — the open academic standard since 2006.',
    source: 'Corporation for Digital Scholarship',
    url: 'https://www.zotero.org' },
  { kind: 'أداة تستحق',
    ar: 'Connected Papers — خريطة بصرية لأي بحث',
    arNote: 'أدخل ورقة واحدة فيرسم شجرة الأبحاث المرتبطة بها — كنز لمراجعات الأدبيات.',
    en: 'Connected Papers — a visual map of any paper',
    enNote: 'Enter one paper, get the graph of related work — a literature-review treasure.',
    source: 'Connected Papers',
    url: 'https://www.connectedpapers.com' },
  { kind: 'أداة تستحق',
    ar: 'Semantic Scholar — بحث علمي يفهم الأوراق',
    arNote: 'محرك أكاديمي بالذكاء الاصطناعي من معهد ألن — ٢٠٠+ مليون ورقة.',
    en: 'Semantic Scholar — AI-powered scientific search',
    enNote: 'By the Allen Institute — 200M+ papers, with TLDR summaries.',
    source: 'Allen Institute for AI',
    url: 'https://www.semanticscholar.org' },
  { kind: 'أداة تستحق',
    ar: 'Khan Academy — صف مجاني لكل البشر',
    arNote: 'من الحساب للاقتصاد — النموذج الذي أثبت أن التعليم الجيد يمكن أن يكون مجانياً.',
    en: 'Khan Academy — a free classroom for everyone',
    enNote: 'The model that proved quality education can be free.',
    source: 'Khan Academy (غير ربحية)',
    url: 'https://www.khanacademy.org' },
  { kind: 'أداة تستحق',
    ar: 'MIT OpenCourseWare — مقررات MIT كاملة بلا رسوم',
    arNote: 'منذ ٢٠٠١: أعرق تجربة «تعليم مفتوح» في العالم.',
    en: 'MIT OpenCourseWare — full MIT courses, free',
    enNote: 'Since 2001: the world’s pioneering open-education experiment.',
    source: 'MIT',
    url: 'https://ocw.mit.edu' },

  /* مفهوم ناشئ */
  { kind: 'مفهوم ناشئ',
    ar: 'الحِمل المعرفي — Cognitive Load',
    arNote: 'الذاكرة العاملة محدودة؛ الدرس الجيد يحترم حدودها بدل أن يغرقها.',
    en: 'Cognitive Load',
    enNote: 'Working memory is finite; good teaching respects its limits instead of flooding it.',
    source: 'جون سويلر (١٩٨٨)',
    url: 'https://en.wikipedia.org/wiki/Cognitive_load' },
  { kind: 'مفهوم ناشئ',
    ar: 'منطقة النمو القريب — ZPD',
    arNote: 'التعلم يحدث في المسافة بين ما يستطيعه الطالب وحده وما يستطيعه بمساعدة.',
    en: 'Zone of Proximal Development',
    enNote: 'Learning happens between what a student can do alone and with guidance.',
    source: 'ليف فيغوتسكي',
    url: 'https://en.wikipedia.org/wiki/Zone_of_proximal_development' },
  { kind: 'مفهوم ناشئ',
    ar: 'التصميم الشامل للتعلم — UDL',
    arNote: 'صمم الدرس لأقصى تنوع من البداية، بدل ترقيعه لاحقاً لذوي الاحتياجات.',
    en: 'Universal Design for Learning',
    enNote: 'Design for the widest variety of learners upfront — not as an afterthought.',
    source: 'CAST',
    url: 'https://www.cast.org' },
  { kind: 'مفهوم ناشئ',
    ar: 'محو أمية الذكاء الاصطناعي — AI Literacy',
    arNote: 'ليس تعلم البرمجة، بل فهم ما تفعله الخوارزميات بنا — مهارة القرن الجديدة.',
    en: 'AI Literacy',
    enNote: 'Not coding — understanding what algorithms do to us. The new century’s literacy.',
    source: 'اليونسكو',
    url: 'https://www.unesco.org/en/artificial-intelligence' },
  { kind: 'مفهوم ناشئ',
    ar: 'أثر بجماليون — توقعات المعلم تصنع الطالب',
    arNote: 'تجربة روزنتال الشهيرة: حين توقّع المعلمون التفوق من طلاب عشوائيين… تفوقوا فعلاً.',
    en: 'The Pygmalion Effect — teacher expectations shape students',
    enNote: 'Rosenthal’s classic study: students randomly labeled “bloomers” actually bloomed.',
    source: 'روزنتال وجيكوبسون (١٩٦٨)',
    url: 'https://en.wikipedia.org/wiki/Pygmalion_effect' },

  /* رؤية عميقة */
  { kind: 'رؤية عميقة',
    ar: '«إعادة تصور مستقبلنا معاً» — عقد اجتماعي جديد للتعليم',
    arNote: 'تقرير اليونسكو المرجعي عن تعليم ما بعد ٢٠٥٠.',
    en: 'Reimagining Our Futures Together — a new social contract for education',
    enNote: 'UNESCO’s landmark report on education beyond 2050.',
    source: 'اليونسكو (٢٠٢١)',
    url: 'https://unesdoc.unesco.org/ark:/48223/pf0000379707' },
  { kind: 'رؤية عميقة',
    ar: '«هل تقتل المدارس الإبداع؟» — كين روبنسون',
    arNote: 'أكثر محاضرة مشاهدةً في تاريخ TED — ولها سبب.',
    en: '“Do Schools Kill Creativity?” — Sir Ken Robinson',
    enNote: 'The most-watched TED talk in history — for a reason.',
    source: 'TED (٢٠٠٦)',
    url: 'https://www.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity' },
  { kind: 'رؤية عميقة',
    ar: 'مؤشر الذكاء الاصطناعي السنوي — أين وصلنا فعلاً؟',
    arNote: 'التقرير الأدق عالمياً عن حالة الذكاء الاصطناعي، بالأرقام لا بالضجيج.',
    en: 'The AI Index — where AI actually stands',
    enNote: 'The most rigorous annual account of AI progress — numbers, not hype.',
    source: 'Stanford HAI',
    url: 'https://hai.stanford.edu/ai-index' },
  { kind: 'رؤية عميقة',
    ar: '«التعليم في لمحة» — أضخم مقارنة دولية سنوية',
    arNote: 'مؤشرات التعليم في ٥٠+ دولة: الإنفاق، المعلمون، النواتج.',
    en: 'Education at a Glance — the largest annual international comparison',
    enNote: 'Indicators across 50+ countries: spending, teachers, outcomes.',
    source: 'OECD',
    url: 'https://www.oecd.org/education/education-at-a-glance/' },
  { kind: 'رؤية عميقة',
    ar: 'Edutopia — ما الذي ينجح فعلاً داخل الصف؟',
    arNote: 'من مؤسسة جورج لوكاس التعليمية: ممارسات مبنية على البحث لا على الموضة.',
    en: 'Edutopia — what actually works in classrooms',
    enNote: 'By the George Lucas Educational Foundation: research-based practice, not fashion.',
    source: 'George Lucas Educational Foundation',
    url: 'https://www.edutopia.org' },
]

/* ─── كتاب الشهر (يتبدل أول كل شهر) ─── */
export const monthlyBooks: Curio[] = [
  { kind: 'كتاب الشهر',
    ar: '«عقلية النمو» — كارول دويك',
    arNote: 'الذكاء ليس قدراً: كيف يغيّر إيمان الطالب بقابليته للنمو كلَّ شيء.',
    en: 'Mindset — Carol Dweck',
    enNote: 'Intelligence is not fate: how a growth belief changes everything.',
    source: 'Carol Dweck — Stanford (٢٠٠٦)',
    url: 'https://en.wikipedia.org/wiki/Mindset_(book)' },
  { kind: 'كتاب الشهر',
    ar: '«مدارس مبدعة» — كين روبنسون',
    arNote: 'الثورة الهادئة التي تعيد التعليم من المصنع إلى البستان.',
    en: 'Creative Schools — Ken Robinson',
    enNote: 'The grassroots revolution moving education from factory to garden.',
    source: 'Ken Robinson (٢٠١٥)',
    url: 'https://en.wikipedia.org/wiki/Creative_Schools' },
  { kind: 'كتاب الشهر',
    ar: '«العمل العميق» — كال نيوبورت',
    arNote: 'التركيز صار أندر العملات — وهذا دليل استرداده.',
    en: 'Deep Work — Cal Newport',
    enNote: 'Focus is the scarcest currency — this is its recovery manual.',
    source: 'Cal Newport (٢٠١٦)',
    url: 'https://en.wikipedia.org/wiki/Deep_Work' },
  { kind: 'كتاب الشهر',
    ar: '«المياه الضحلة» — نيكولاس كار',
    arNote: 'ماذا يفعل الإنترنت بأدمغتنا؟ الكتاب الذي فتح هذا السؤال.',
    en: 'The Shallows — Nicholas Carr',
    enNote: 'What the internet is doing to our brains — the book that opened the question.',
    source: 'Nicholas Carr (٢٠١٠) — نهائي بوليتزر',
    url: 'https://en.wikipedia.org/wiki/The_Shallows_(book)' },
  { kind: 'كتاب الشهر',
    ar: '«كيف يتعلم الناس» — خلاصة علم التعلم',
    arNote: 'ما يقوله الدماغ والعقل والخبرة عن التعليم — متاح كاملاً مجاناً.',
    en: 'How People Learn — the science of learning distilled',
    enNote: 'Brain, mind, experience, and school — free full text.',
    source: 'الأكاديميات الوطنية الأمريكية',
    url: 'https://nap.nationalacademies.org/catalog/9853/how-people-learn-brain-mind-experience-and-school-expanded-edition' },
  { kind: 'كتاب الشهر',
    ar: '«أيها الولد» — أبو حامد الغزالي',
    arNote: 'رسالة قصيرة في جدوى العلم: ماذا ينفع من العلم إن لم يُغيّرك؟',
    en: 'Ayyuha al-Walad (Dear Beloved Son) — Al-Ghazali',
    enNote: 'A short epistle on knowledge that transforms — or fails you.',
    source: 'الغزالي (القرن الخامس الهجري)' },
]

/* ─── منطق الإيقاع ─── */
const DAY = 24 * 60 * 60 * 1000

/** عنصر اليوم — يتبدل كل منتصف ليل تلقائياً */
export function todaysPick(extra: Curio[] = []): Curio {
  const bank = [...curatedBank, ...extra]
  const days = Math.max(0, Math.floor((Date.now() - new Date(CURATED_EPOCH).getTime()) / DAY))
  return bank[days % bank.length]
}

/** كتاب الشهر — يتبدل أول كل شهر */
export function thisMonthsBook(): Curio {
  const now = new Date()
  const epoch = new Date(CURATED_EPOCH)
  const months = Math.max(0, (now.getFullYear() - epoch.getFullYear()) * 12 + (now.getMonth() - epoch.getMonth()))
  return monthlyBooks[months % monthlyBooks.length]
}

/** أسماء الأركان المُحياة — للفلاتر */
export const curioKinds: CurioKind[] = ['اقتباس وتأمل', 'الرف المنسي', 'أداة تستحق', 'مفهوم ناشئ', 'رؤية عميقة']
