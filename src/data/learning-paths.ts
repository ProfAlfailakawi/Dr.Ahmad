/**
 * مسارات التعلّم — تسلسلاتٌ منتقاة بعناية تمزج المقال والحلقة المسموعة ومدخل
 * الموسوعة وفصل الكتاب في ترتيبٍ واحد يُقرأ من أوله إلى آخره.
 *
 * كل خطوة تشير إلى مادةٍ حقيقية موجودة في الموقع بمعرّفها الثابت، وتحمل عنوانها
 * كما هو في مصدره. الحارس scripts/test-learning-paths.mjs يُسقط البناء إن غاب
 * معرّفٌ أو تغيّر عنوانه — فلا يُنشر مسارٌ يقود إلى صفحةٍ مفقودة.
 *
 * هذا الملف بياناتٌ خالصة بلا استيراد: يقرؤه التطبيق ومولّد الصفحات الساكنة معاً.
 *
 * صيغة المرجع (ref) لكل نوع:
 *   article       ← slug المقال في src/data.ts
 *   podcast       ← slug الحلقة في src/data/listen-index.json (حلقات «مجلس الفكرة»)
 *   encyclopedia  ← `door-N/U` : الباب ورقم الفصل في src/data/encyclopedia-structure.json
 *   book          ← `slug#cNN` : الكتاب ومعرّف الفصل في src/data/book-knowledge.json
 */

export type LearningStepKind = 'article' | 'podcast' | 'encyclopedia' | 'book'

export type LearningStep = {
  kind: LearningStepKind
  ref: string
  /** العنوان كما هو في مصدره — يتحقق منه الحارس حرفاً بحرف. */
  title: string
  /** لماذا هذه الخطوة هنا، بجملةٍ واحدة. */
  note: string
  /** زمنٌ تقريبي بالدقائق. */
  minutes: number
  /** سؤال الحلقة المسموعة كما نُطق فيها (للحلقات فقط). */
  question?: string
}

export type LearningPath = {
  id: string
  title: string
  /** سطرٌ واحد يعرّف السؤال الذي يجيب عنه المسار. */
  intro: string
  /** لمن هذا المسار. */
  audience: string
  steps: LearningStep[]
}

export const learningPaths: LearningPath[] = [
  {
    id: 'ai-and-the-learner',
    title: 'الذكاء الاصطناعي والمتعلّم',
    intro: 'متى يكون الذكاء الاصطناعي عوناً على الفهم، ومتى يصير بديلاً عنه؟ مسارٌ يبدأ من الصف وينتهي عند الأخلاق والحوكمة.',
    audience: 'للمعلّم وولي الأمر وكل من يتساءل عن مكان العقل البشري في زمن الآلة.',
    steps: [
      {
        kind: 'article',
        ref: 'artificial-intelligence-teaches-while-the-human-mind-is-pushed-aside-2',
        title: 'الذكاء الاصطناعي يُدرّس… والعقل البشري يُقصى',
        note: 'نقطة البداية: ما الذي يخسره العقل حين تتولّى الآلة التدريس؟',
        minutes: 5,
      },
      {
        kind: 'podcast',
        ref: 'students-minds-are-on-vacation-while-chatgpt-works-full-time-2',
        title: 'عقول الطلاب في إجازة… وChatGPT يشتغل بدوام كامل!',
        question: 'هل نخرج من يجيد استخدام اللغة، أم من يفكر بها؟',
        note: 'حوارٌ مسموع يختبر الفكرة على تجربة الطالب اليومية مع أدوات الكتابة الآلية.',
        minutes: 5,
      },
      {
        kind: 'encyclopedia',
        ref: 'door-4/5',
        title: 'التكنولوجيا كأداة للتغيير',
        note: 'الإطار العلمي: التقنية أداةُ تغيير تُقاس بأثرها في التعلّم، لا غايةٌ في ذاتها.',
        minutes: 10,
      },
      {
        kind: 'book',
        ref: 'mega-data#c06',
        title: 'أخلاقيات الذكاء الاصطناعي',
        note: 'من السؤال التربوي إلى السؤال الأخلاقي: ما الذي ينبغي للخوارزمية أن تفعله؟',
        minutes: 15,
      },
      {
        kind: 'podcast',
        ref: 'intelligence-without-a-consciencearabic',
        title: 'ذكاءٌ بلا ضمير',
        question: 'من يعلمهم لماذا يفترض أن يفعلوا ذلك؟',
        note: 'خاتمة المسار: الذكاء وحده لا يكفي ما لم يصحبه ضمير.',
        minutes: 4,
      },
    ],
  },
  {
    id: 'the-digital-teacher',
    title: 'المعلّم في العصر الرقمي',
    intro: 'من مفهوم التعليم الإلكتروني إلى ملامح المعلّم الذي تحتاجه البيئة الرقمية، ثم العودة إلى السؤال الأول: لماذا نعلّم؟',
    audience: 'للمعلّم في الميدان، ولطالب كلية التربية، ولمن يقود التحوّل الرقمي في مدرسته.',
    steps: [
      {
        kind: 'encyclopedia',
        ref: 'door-2/5',
        title: 'التعليم الإلكتروني والتعليم عن بُعد',
        note: 'المفاهيم قبل الرأي: ما التعليم الإلكتروني، وما الذي يميّزه عن التعليم عن بُعد؟',
        minutes: 10,
      },
      {
        kind: 'article',
        ref: 'e-learning-culture-2',
        title: 'ثقافة التعليم الإلكتروني',
        note: 'المنصّة وحدها لا تصنع تعليماً؛ تحتاج ثقافةً تحتضنها.',
        minutes: 5,
      },
      {
        kind: 'podcast',
        ref: 'past-mistakes-still-persist-in-the-age',
        title: 'أخطاء الماضي مازالت في زمن التعليم الإلكتروني',
        question: 'ما الحاجة إلى مدرس خصوصي؟',
        note: 'كيف تنتقل عاداتنا القديمة معنا إلى الأدوات الجديدة.',
        minutes: 4,
      },
      {
        kind: 'book',
        ref: 'digital-education#c10',
        title: 'المعلم الرقمي لبيئة تعليمية رقمية',
        note: 'ملامح المعلّم الذي تحتاجه البيئة الرقمية، ومهاراته، وطريق تطويرها.',
        minutes: 15,
      },
      {
        kind: 'article',
        ref: 'when-the-teacher-knows-why-he-teachesarabic',
        title: 'حين يعرف المعلّم لماذا يعلّم',
        note: 'العودة إلى الجوهر: المعنى قبل الأداة.',
        minutes: 5,
      },
    ],
  },
  {
    id: 'the-child-and-the-screen',
    title: 'الطفل والشاشة',
    intro: 'رحلةٌ بين فضول الطفل والجهاز الذكي: متى تكون الشاشة أداة نموّ، ومتى تقوده بدل أن يقودها؟',
    audience: 'لولي الأمر أولاً، ثم للمعلّم الذي يستقبل أطفال هذا الجيل كل صباح.',
    steps: [
      {
        kind: 'article',
        ref: 'we-handed-them-the-phone-so-theyd-leave-us-alone-2',
        title: 'سلّمناه الهاتف… ليستريح منا!',
        note: 'البداية من البيت: لماذا نسلّم الهاتف، وماذا نستلم في المقابل؟',
        minutes: 5,
      },
      {
        kind: 'podcast',
        ref: 'smartphone-child-a-creative-mind-or-a-child-being-driven',
        title: 'طفل الهواتف الذكية.. عقل خلاق أم طفل يساق؟!',
        question: 'لماذا لا نرى هذا الذكاء والعقول الخلاقة في دروسهم؟',
        note: 'هل يصنع الهاتف عقلاً خلّاقاً، أم طفلاً يُساق؟',
        minutes: 4,
      },
      {
        kind: 'book',
        ref: 'kids-tech#c05',
        title: 'تأثير التكنولوجيا على الأطفال والمراهقين',
        note: 'ما تقوله الدراسات عن أثر التقنية في نموّ الطفل وسلوكه.',
        minutes: 15,
      },
      {
        kind: 'encyclopedia',
        ref: 'door-3/6',
        title: 'الأجهزة الذكية في التعليم',
        note: 'الوجه الآخر للجهاز نفسه: أداةُ تعلّم حين يُحسن توظيفها.',
        minutes: 10,
      },
      {
        kind: 'podcast',
        ref: 'turning-video-game-obsession-into-creative-meditation-2',
        title: 'تحويل هوس ألعاب الفيديو إلى تأمل خلاق',
        question: 'أين الدافع الذي يجعلهم يصنعون بدل أن يكونوا مهووسين؟',
        note: 'من الاستهلاك إلى الصناعة: كيف يتحوّل اللعب إلى إبداع.',
        minutes: 4,
      },
    ],
  },
  {
    id: 'beyond-the-grade',
    title: 'ما وراء الدرجة',
    intro: 'حين يصير الامتحان هو الهدف يضيع الفهم في الطريق. مسارٌ يعيد القياس إلى وظيفته: مرآةً للتعلّم لا مصدراً للخوف.',
    audience: 'للمعلّم والطالب وولي الأمر، ولكل من يصمّم اختباراً أو ينتظر نتيجته.',
    steps: [
      {
        kind: 'podcast',
        ref: 'when-the-exam-becomes-the-goalarabic',
        title: 'حين يصبح الامتحان هو الهدف',
        question: 'هل نستعد لامتحان، أم نستعد لمعركة تثبت من نحن؟',
        note: 'البداية من السؤال: كيف انقلبت الوسيلة غاية؟',
        minutes: 4,
      },
      {
        kind: 'article',
        ref: 'he-passed-the-exam-but-failed-the-question-2',
        title: 'نجح في الامتحان… وفشل في السؤال!',
        note: 'الفرق بين اجتياز الاختبار وفهم السؤال.',
        minutes: 5,
      },
      {
        kind: 'encyclopedia',
        ref: 'door-4/2',
        title: 'مستويات بلوم وتكنولوجيا التعليم',
        note: 'أداةٌ لقياس ما هو أعمق من الحفظ: مستويات التفكير من التذكّر إلى الإبداع.',
        minutes: 10,
      },
      {
        kind: 'book',
        ref: 'teaching#c06',
        title: 'تصميم التدريس',
        note: 'كيف يُصمَّم الدرس من البداية ليقيس الفهم لا الاسترجاع.',
        minutes: 15,
      },
      {
        kind: 'article',
        ref: 'the-classroom-that-fears-mistakesarabic',
        title: 'الصفُّ الذي يخاف من الخطأ',
        note: 'خاتمة المسار: الخطأ جزءٌ من التعلّم، لا عيبٌ فيه.',
        minutes: 5,
      },
    ],
  },
]
