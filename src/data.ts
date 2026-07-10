// ⚠️ روابط الموقع القديم معطّلة مؤقتاً.
// عند بناء الصفحات الداخلية، غيّر LINK_OUT إلى true.
export const LINK_OUT = false

/** صوت المتصفّح الآلي رديء للعربية. اجعله true فقط إن لم تولّد ملفات MP3. */
export const ALLOW_BROWSER_TTS = false

// نصوص المقالات الكاملة — تُملأ بتشغيل: npm run import
import bodies from './data/bodies.json'

export const profile = {
  name: 'أحمد الفيلكاوي',
  fullName: 'أحمد حسين الفيلكاوي',
  eyebrow: 'أستاذ تكنولوجيا التعليم',
  tagline: 'مؤلفٌ وباحثٌ ومستشار — في التعليم والتقنية والفكر.',
  aboutHeading: 'أُبقي الإنسان\nفي قلب الآلة.',
  about:
    'حاصل على درجة دكتوراه الفلسفة في التربية، تخصص تكنولوجيا التعليم من جامعة شمال كولورادو. أستاذ مشارك في كلية التربية الأساسية (PAAET) وأستاذ منتدب في كلية التربية بجامعة الكويت. خبير ومستشار في وزارة الإعلام والمجلس الوطني للثقافة والفنون والآداب ومكتبة الكويت الوطنية والهيئة العامة للشباب.',
  facts: [
    'دكتوراه — جامعة شمال كولورادو',
    'PAAET · جامعة الكويت',
    '٩ كتب منشورة',
    '١٨ بحثاً محكّماً',
    'كاتب في جريدة الجريدة',
    'مستشار — وزارة الإعلام',
    'أستاذ مشارك منذ ٢٠٢٠',
  ],
}


export const books = [
  { slug: 'encyclopedia', title: 'موسوعة تكنولوجيا التعليم', isbn: '978-99966-1-281-7',
    cover: '/covers/encyclopedia.png',
    pdf: '/files/encyclopedia.pdf',
    desc: 'عمل مرجعي شامل في تكنولوجيا التعليم — كتاب ورقي تفاعلي.' },
  { slug: 'teaching', title: 'مناهج وطرق التدريس (تكنولوجيا التعليم)', isbn: '978-9921-0-2023-6',
    cover: '/covers/teaching.png',
    pdf: '/files/teaching.pdf',
    desc: 'مناهج وطرق التدريس الحديثة في ضوء تكنولوجيا التعليم.' },
  { slug: 'mega-data', title: 'حوكمة الذكاء الاصطناعي والبيانات الضخمة', isbn: '978-9921-0-2013-7',
    cover: '/covers/mega-data.png',
    pdf: '/files/mega-data.pdf',
    desc: 'حوكمة الذكاء الاصطناعي وإدارة البيانات الضخمة في التعليم.' },
  { slug: 'handy-tech', title: 'تكنولوجيا ذوي الاحتياجات الخاصة', isbn: '978-9921-0-2015-1',
    cover: '/covers/handy-tech.png',
    pdf: '/files/handy-tech.pdf',
    desc: 'التقنيات المساعِدة وإتاحة التعليم لذوي الاحتياجات الخاصة.' },
  { slug: 'smart-school', title: 'المدارس الذكية', isbn: '978-9921-0-2022-9',
    cover: '/covers/smart-school.png',
    pdf: '/files/smart-school.pdf',
    desc: 'نماذج المدارس الذكية وبيئاتها الرقمية.' },
  { slug: 'virtual-world', title: 'العالم الافتراضي', isbn: '978-9921-0-2020-5',
    cover: '/covers/virtual-world.png',
    pdf: '/files/virtual-world.pdf',
    desc: 'الواقع الافتراضي وبيئاته التعليمية.' },
  { slug: 'kids-tech', title: 'الطفل والتكنولوجيا', isbn: '978-9921-0-2021-2',
    cover: '/covers/kids-tech.png',
    pdf: '/files/kids-tech.pdf',
    desc: 'أثر التكنولوجيا على الطفولة والتعلّم المبكر.' },
  { slug: 'gamification', title: 'التلعيب Gamification وعالم الألعاب', isbn: '978-9921-0-2019-9',
    cover: '/covers/gamification.png',
    pdf: '/files/gamification.pdf',
    desc: 'التلعيب والألعاب التعليمية وتوظيفها في التعلّم.' },
  { slug: 'digital-education', title: 'التعليم ومتطلبات العصر.. (التعلم الرقمي)', isbn: '978-9921-0-2018-2',
    cover: '/covers/digital-education.png',
    pdf: '/files/digital-education.pdf',
    desc: 'التعلّم الرقمي ومتطلبات القرن الحادي والعشرين.' },
]

export const papers = [
  { slug: 'ms-teams-development-application-trends-as-a-quality-education-in-light-of-the-epidemiological-challenges-covid-19-in-kuwait-2', title: 'اتجاهات تطبيق Ms Teams كتعليمٍ نوعي في ضوء تحديات جائحة كوفيد-19 في الكويت', meta: 'MS Teams · Quality Education', journal: 'Global Journal of Educational Studies · 8(2) 2022 · ص ١٤٤–١٦٧', source: 'https://ideas.repec.org/s/mth/gjes88.html', url: 'https://dr-alfailakawi.com/scholarly_contributi/ms-teams-development-application-trends-as-a-quality-education-in-light-of-the-epidemiological-challenges-covid-19-in-kuwait-2/' },
  { slug: 'the-reality-of-using-smart-device-applications-in-learning-applications-by-university-students-at-the-college-of-basic-education-in-kuwait-2', title: 'واقع استخدام تطبيقات الأجهزة الذكية في التعلّم لدى طلبة كلية التربية الأساسية', meta: 'Smart Device Applications', journal: 'Global Journal of Educational Studies · 8(2) 2022 · ص ١٠٢–١٢٦', source: 'https://ideas.repec.org/a/mth/gjes88/v8y2022i2p102-126.html', url: 'https://dr-alfailakawi.com/scholarly_contributi/the-reality-of-using-smart-device-applications-in-learning-applications-by-university-students-at-the-college-of-basic-education-in-kuwait-2/' },
  { slug: 'trends-of-college-of-basic-education-students-towards-the-use-of-photography-to-develop-learning-skills-in-kuwait-2', title: 'اتجاهات طلبة كلية التربية الأساسية نحو استخدام التصوير لتنمية مهارات التعلّم', meta: 'Photography · Learning Skills', journal: 'Global Journal of Educational Studies · 8(2) 2022 · ص ١٨٧–٢٠٧', source: 'https://ideas.repec.org/s/mth/gjes88.html', url: 'https://dr-alfailakawi.com/scholarly_contributi/trends-of-college-of-basic-education-students-towards-the-use-of-photography-to-develop-learning-skills-in-kuwait-2/' },
  { slug: 'the-importance-of-adopting-learning-management-systems-lms-to-enhance-the-quality-of-teaching-among-university-professors-in-kuwait-2', title: 'أهمية تبنّي أنظمة إدارة التعلّم (LMS) لتعزيز جودة التدريس لدى أساتذة الجامعة', meta: 'LMS · Teaching Quality', url: 'https://dr-alfailakawi.com/scholarly_contributi/the-importance-of-adopting-learning-management-systems-lms-to-enhance-the-quality-of-teaching-among-university-professors-in-kuwait-2/' },
  { slug: 'the-role-of-technological-creative-photography-in-contemporary-education-frameworks-in-developing-the-knowledge-skills-and-abilities-of-university-professors-at-the-college-of-basic-education-in-kuw-2', title: 'دور التصوير الإبداعي التكنولوجي في تنمية معارف ومهارات أساتذة كلية التربية الأساسية', meta: 'Creative Photography · Faculty', url: 'https://dr-alfailakawi.com/scholarly_contributi/the-role-of-technological-creative-photography-in-contemporary-education-frameworks-in-developing-the-knowledge-skills-and-abilities-of-university-professors-at-the-college-of-basic-education-in-kuw-2/' },
  { slug: 'university-students-perceptions-at-the-college-of-basic-education-regarding-the-use-of-interactive-blackboard-technology-in-education-in-kuwait-for-the-academic-year-2020-2021-2', title: 'تصورات طلبة كلية التربية الأساسية نحو استخدام السبّورة التفاعلية ٢٠٢٠/٢٠٢١', meta: 'Interactive Whiteboard', url: 'https://dr-alfailakawi.com/scholarly_contributi/university-students-perceptions-at-the-college-of-basic-education-regarding-the-use-of-interactive-blackboard-technology-in-education-in-kuwait-for-the-academic-year-2020-2021-2/' },
  { slug: 'perceptions-of-university-students-at-the-college-of-basic-education-toward-implementing-moodle-in-managing-e-courses-to-enhance-learning-in-kuwait-2', title: 'تصورات طلبة كلية التربية الأساسية نحو تطبيق Moodle في إدارة المقررات الإلكترونية', meta: 'Moodle · E-Courses', url: 'https://dr-alfailakawi.com/scholarly_contributi/perceptions-of-university-students-at-the-college-of-basic-education-toward-implementing-moodle-in-managing-e-courses-to-enhance-learning-in-kuwait-2/' },
  { slug: 'the-impact-of-the-working-environment-and-learning-science-in-the-electronic-learning-systems-used-in-education-2', title: 'أثر بيئة العمل وعلوم التعلّم في أنظمة التعلّم الإلكتروني المستخدمة في التعليم', meta: 'Working Environment · Learning Science', url: 'https://dr-alfailakawi.com/scholarly_contributi/the-impact-of-the-working-environment-and-learning-science-in-the-electronic-learning-systems-used-in-education-2/' },
  { slug: 'investigating-the-role-of-e-learning-management-systems-in-the-learning-process-from-the-point-of-view-of-the-faculty-at-the-faculty-of-basic-education-in-kuwait-2', title: 'دور أنظمة إدارة التعلّم الإلكتروني في العملية التعليمية من وجهة نظر هيئة التدريس', meta: 'E-Learning Management Systems', url: 'https://dr-alfailakawi.com/scholarly_contributi/investigating-the-role-of-e-learning-management-systems-in-the-learning-process-from-the-point-of-view-of-the-faculty-at-the-faculty-of-basic-education-in-kuwait-2/' },
  { slug: 'how-important-is-the-use-of-e-learning-management-systems-in-building-a-smart-university-in-kuwait-2', title: 'أهمية أنظمة إدارة التعلّم الإلكتروني في بناء الجامعة الذكية في الكويت', meta: 'Smart University', url: 'https://dr-alfailakawi.com/scholarly_contributi/how-important-is-the-use-of-e-learning-management-systems-in-building-a-smart-university-in-kuwait-2/' },
  { slug: 'the-reality-of-using-cloud-computing-in-university-education-from-the-point-of-view-of-faculty-members-in-kuwait-2', title: 'واقع استخدام الحوسبة السحابية في التعليم الجامعي من وجهة نظر هيئة التدريس', meta: 'Cloud Computing', url: 'https://dr-alfailakawi.com/scholarly_contributi/the-reality-of-using-cloud-computing-in-university-education-from-the-point-of-view-of-faculty-members-in-kuwait-2/' },
  { slug: 'the-availability-of-e-learning-qualifications-among-faculty-members-at-the-faculty-of-basic-education-in-kuwait-2', title: 'مدى توافر كفايات التعلّم الإلكتروني لدى أعضاء هيئة التدريس بكلية التربية الأساسية', meta: 'E-Learning Qualifications', url: 'https://dr-alfailakawi.com/scholarly_contributi/the-availability-of-e-learning-qualifications-among-faculty-members-at-the-faculty-of-basic-education-in-kuwait-2/' },
  { slug: 'obstacles-to-the-employment-of-education-technology-and-means-for-students-with-special-needs-from-the-point-of-view-of-faculty-members-at-the-public-authority-for-applied-2', title: 'معوّقات توظيف تكنولوجيا التعليم لذوي الاحتياجات الخاصة من وجهة نظر هيئة التدريس', meta: 'Ed-Tech · Special Needs', url: 'https://dr-alfailakawi.com/scholarly_contributi/obstacles-to-the-employment-of-education-technology-and-means-for-students-with-special-needs-from-the-point-of-view-of-faculty-members-at-the-public-authority-for-applied-2/' },
  { slug: 'faculty-members-degree-of-awareness-of-augmented-reality-concept-in-the-college-of-basic-education-public-authority-for-applied-education-and-training-in-kuwait-2', title: 'درجة وعي أعضاء هيئة التدريس بمفهوم الواقع المعزّز في كلية التربية الأساسية', meta: 'Augmented Reality Awareness', url: 'https://dr-alfailakawi.com/scholarly_contributi/faculty-members-degree-of-awareness-of-augmented-reality-concept-in-the-college-of-basic-education-public-authority-for-applied-education-and-training-in-kuwait-2/' },
  { slug: 'faculty-attitudes-edtech', title: 'اتجاهات الهيئة التدريسية نحو استخدام تكنولوجيا التعليم في كلية التربية الأساسية', meta: 'Faculty Attitudes · Ed-Tech', url: 'https://dr-alfailakawi.com/scholarly_contributi/%d8%a7%d8%aa%d8%ac%d8%a7%d9%87%d8%a7%d8%aa-%d8%a7%d9%84%d9%87%d9%8a%d8%a6%d8%a9-%d8%a7%d9%84%d8%aa%d8%af%d8%b1%d9%8a%d8%b3%d9%8a%d8%a9-%d9%86%d8%ad%d9%88-%d8%a7%d8%b3%d8%aa%d8%ae%d8%af%d8%a7%d9%85-2/' },
  { slug: 'multimedia-higher-education', title: 'فاعلية استخدام أعضاء هيئة التدريس للوسائط المتعددة في التعليم الجامعي', meta: 'Multimedia in Higher Education', url: 'https://dr-alfailakawi.com/scholarly_contributi/%d9%81%d8%a7%d8%b9%d9%84%d9%8a%d8%a9-%d8%a7%d8%b3%d8%aa%d8%ae%d8%af%d8%a7%d9%85-%d8%a3%d8%b9%d8%b6%d8%a7%d8%a1-%d9%87%d9%8a%d8%a6%d8%a9-%d8%a7%d9%84%d8%aa%d8%af%d8%b1%d9%8a%d8%b3-%d9%84%d9%84%d9%88-2/' },
  { slug: 'web-navigation-learning-skills', title: 'فاعلية الإبحار في المواقع الإلكترونية على تحسين مهارات الطلبة نحو التعلّم', meta: 'Web Navigation · Learning Skills', url: 'https://dr-alfailakawi.com/scholarly_contributi/%d9%81%d8%a7%d8%b9%d9%84%d9%8a%d8%a9-%d8%a7%d9%84%d8%a8%d8%ad%d8%a7%d8%b1-%d9%81%d9%8a-%d8%a7%d9%84%d9%88%d8%a7%d9%82%d8%b9-%d8%a7%d9%84%d9%84%d9%83%d8%aa%d8%b1%d9%88%d9%86%d9%8a%d8%a9-%d8%b9%d9%84-2/' },
  { slug: 'elearning-research-skills', title: 'أهمية التعلّم الإلكتروني في اكتساب مهارات البحث العلمي لدى طلبة البكالوريوس والدراسات العليا', meta: 'E-Learning · Research Skills', url: 'https://dr-alfailakawi.com/scholarly_contributi/%d8%a3%d9%87%d9%85%d9%8a%d8%a9-%d8%a7%d9%84%d8%aa%d8%b9%d9%84%d9%85-%d8%a7%d9%84%d8%a5%d9%84%d9%83%d8%aa%d8%b1%d9%88%d9%86%d9%8a-%d9%81%d9%8a-%d8%a7%d9%83%d8%aa%d8%b3%d8%a7%d8%a8-%d9%85%d9%87%d8%a7-2/' },
]

export const essays = [
  { tag: 'التعليم', title: 'ورقةٌ تتخرّج… والعقل غائب', quote: '«نُتقن فنّ توقيع أسمائنا… وننسى كيف نكتب فكرة.»' },
  { tag: 'مجتمع', title: 'أثرياء الوهم', quote: '«ما نراه بهرجةٌ بلا أساس؛ مسؤوليةُ كلٍّ منّا أن يتحقّق.»' },
  { tag: 'هوية', title: 'جيلٌ بلا جذور', quote: '«الهويةُ الثقافية ليست تفصيلاً تراثياً؛ بل عاملُ حمايةٍ حقيقي.»' },
]


export const socials = [
  { label: 'LinkedIn', url: 'https://www.linkedin.com/in/prof-ahmad-alfailakawi-5922251a5' },
  { label: 'X', url: 'https://twitter.com/drahmadkw' },
  { label: 'Instagram', url: 'https://www.instagram.com/DrAhmadkw/' },
  { label: 'YouTube', url: 'https://youtube.com/@drahmadalfailakawi' },
]

export const links = {
  booking: 'http://schedule.dr-alfailakawi.com/',
  cv: '/files/cv.pdf',
}

// المقالات الفكرية الكاملة (٧٢ مقالاً) — مسحوبة من الموقع مع روابط النشر الأصلي
export const articles = [
  { slug: 'how-do-we-assess-without-breaking-the-human-beingarabic', title: 'كيف نقيس دون أن نكسر الإنسان', date: '٢٤ أبريل ٢٠٢٦', iso: '2026-04-24', cat: 'التعليم',
    excerpt: 'القياس ضروري، نعم. لكن المشكلة تبدأ حين ننسى أن ما نقيسه هو تعلّمٌ عند إنسان، لا رقمٌ في جدول.',
    url: 'https://dr-alfailakawi.com/signature_articles/how-do-we-assess-without-breaking-the-human-beingarabic/', source: '' },
  { slug: 'success-that-does-not-bring-joy-to-its-ownerarabic', title: 'النجاح الذي لا يفرح صاحبه', date: '١٧ أبريل ٢٠٢٦', iso: '2026-04-17', cat: 'التعليم',
    excerpt: 'تظهر النتيجة، ترتفع الزغاريد أو تنهال التهاني، ويبتسم الطالب كما ينبغي أن يبتسم… لكن شيئاً في داخله لا يتحرّك.',
    url: 'https://dr-alfailakawi.com/signature_articles/success-that-does-not-bring-joy-to-its-ownerarabic/', source: 'https://www.aljarida.com/article/129142' },
  { slug: 'when-the-exam-becomes-the-goalarabic', title: 'حين يصبح الامتحان هو الهدف', date: '١٠ أبريل ٢٠٢٦', iso: '2026-04-10', cat: 'التعليم',
    excerpt: 'في ليالي الامتحانات يتغيّر شكل البيت. تخفّ الضحكات، وتعلو الهمسات، ويصبح الوقت فجأةً عدوّاً يركض أسرع من الطالب.',
    url: 'https://dr-alfailakawi.com/signature_articles/when-the-exam-becomes-the-goalarabic/', source: 'https://www.aljarida.com/article/128511' },
  { slug: 'expectations-that-shape-a-studentarabic', title: 'التوقّعات التي تصنع طالباً', date: '٣ أبريل ٢٠٢٦', iso: '2026-04-03', cat: 'التعليم',
    excerpt: 'بعض الطلاب لا يسقطون لأنهم عاجزون… بل لأن أحداً أقنعهم، بصمتٍ طويل، أنهم أقلّ مما يمكن أن يكونوا.',
    url: 'https://dr-alfailakawi.com/signature_articles/expectations-that-shape-a-studentarabic/', source: 'https://www.aljarida.com/article/127850' },
  { slug: 'the-classroom-that-fears-mistakesarabic', title: 'الصفُّ الذي يخاف من الخطأ', date: '٢٧ مارس ٢٠٢٦', iso: '2026-03-27', cat: 'التعليم',
    excerpt: 'توقّفنا أسبوعين، وانشغلنا بالحرب، وبالقلق الذي يعلو مع الأخبار، وبالوطن حين يُختبر في سمائه وداخله.',
    url: 'https://dr-alfailakawi.com/signature_articles/the-classroom-that-fears-mistakesarabic/', source: 'https://www.aljarida.com/article/127175' },
  { slug: 'the-homeland-is-not-a-point-of-view-in-times-of-crisisarabic', title: 'الوطن ليس وجهةَ نظرٍ وقتَ الأزمات', date: '١٣ مارس ٢٠٢٦', iso: '2026-03-13', cat: 'مجتمع',
    excerpt: 'في الأيام العادية، يستطيع كثيرون أن يخلطوا بين الرأي والانتماء، بين التحليل والولاء، بين الحضور في النقاش والحضور في الوطن.',
    url: 'https://dr-alfailakawi.com/signature_articles/the-homeland-is-not-a-point-of-view-in-times-of-crisisarabic/', source: 'https://www.aljarida.com/article/125811' },
  { slug: 'aggression-in-the-sky-and-steadfastness-withinarabic', title: 'العدوان في السماء… والثبات في الداخل', date: '٦ مارس ٢٠٢٦', iso: '2026-03-06', cat: 'مجتمع',
    excerpt: 'حين تعلو صفارات الإنذار، لا يرتجف الصوت وحده… ترتجف معه لحظةٌ داخل القلب.',
    url: 'https://dr-alfailakawi.com/signature_articles/aggression-in-the-sky-and-steadfastness-withinarabic/', source: 'https://www.aljarida.com/article/125110' },
  { slug: 'when-the-teacher-knows-why-he-teachesarabic', title: 'حين يعرف المعلّم لماذا يعلّم', date: '٢٧ فبراير ٢٠٢٦', iso: '2026-02-27', cat: 'التعليم',
    excerpt: 'دخل المعلّم الصفّ كعادته. شرح الدرس بإتقان، رتّب الأفكار، أنهى الأهداف المحددة في خطته. لم يكن هناك خطأٌ ظاهر.',
    url: 'https://dr-alfailakawi.com/signature_articles/when-the-teacher-knows-why-he-teachesarabic/', source: 'https://www.aljarida.com/article/124284' },
  { slug: 'children-who-know-what-is-required-but-do-not-know-whyarabic-2', title: 'أبناءٌ يعرفون المطلوب… ويجهلون لماذا', date: '٢٠ فبراير ٢٠٢٦', iso: '2026-02-20', cat: 'التربية',
    excerpt: 'في أحد الصفوف، رفعتُ سؤالاً بسيطاً: لماذا تتعلّم؟ لم يتأخر الجواب: «علشان أنجح.» «علشان أجيب نسبة.»',
    url: 'https://dr-alfailakawi.com/signature_articles/children-who-know-what-is-required-but-do-not-know-whyarabic-2/', source: 'https://www.aljarida.com/article/123774' },
  { slug: 'a-new-kind-of-fatigue-in-old-expressionsarabic', title: 'تعبٌ جديد بعبارات قديمة', date: '١٣ فبراير ٢٠٢٦', iso: '2026-02-13', cat: 'مجتمع',
    excerpt: 'نقول: «ضغط»، «إرهاق»، «روتين»… كأنها كلماتٌ كافية لشرح ما يحدث لنا. لكن التعب الذي نعيشه اليوم ليس مجرد زيادة.',
    url: 'https://dr-alfailakawi.com/signature_articles/a-new-kind-of-fatigue-in-old-expressionsarabic/', source: 'https://www.aljarida.com/article/123104' },
  { slug: 'in-farewell-to-abdullah-ismail-al-kandariarabic', title: 'في وداع عبد الله إسماعيل الكندري', date: '٦ فبراير ٢٠٢٦', iso: '2026-02-06', cat: 'مجتمع',
    excerpt: 'بعض الناس حين يرحلون لا يُطفئون ضوءاً واحداً، بل يُغيّرون شكل العتمة في قلوب من عرفوهم.',
    url: 'https://dr-alfailakawi.com/signature_articles/in-farewell-to-abdullah-ismail-al-kandariarabic/', source: 'https://www.aljarida.com/article/122452' },
  { slug: 'children-who-know-what-is-required-but-do-not-know-whyarabic', title: 'أبناءٌ يعرفون المطلوب… ويجهلون لماذا', date: '٣٠ يناير ٢٠٢٦', iso: '2026-01-30', cat: 'التربية',
    excerpt: 'في المدارس والبيوت نرى مشهداً يتكرر بهدوءٍ مخيف: أبناءٌ يحفظون المطلوب، يُنجزون الواجب، ويعرفون كيف ينجحون… لكنهم يتلعثمون.',
    url: 'https://dr-alfailakawi.com/signature_articles/children-who-know-what-is-required-but-do-not-know-whyarabic/', source: 'https://www.aljarida.com/article/121715' },
  { slug: 'when-seriousness-becomes-a-mask-for-escapearabic', title: 'حين تصبح الجدية قناعاً للهروب', date: '٢٣ يناير ٢٠٢٦', iso: '2026-01-23', cat: 'مجتمع',
    excerpt: 'نركض كثيراً، ونسمّي الركض التزاماً. نملأ يومنا بالمهام، ونسمّي الامتلاء إنجازاً.',
    url: 'https://dr-alfailakawi.com/signature_articles/when-seriousness-becomes-a-mask-for-escapearabic/', source: 'https://www.aljarida.com/article/121017' },
  { slug: 'the-return-that-fails-to-fix-what-came-before-itarabic', title: 'العودة التي لا تُصلِح ما قبلها', date: '٩ يناير ٢٠٢٦', iso: '2026-01-09', cat: 'مجتمع',
    excerpt: 'ليست المشكلة في العودة… بل في الوهم الذي نعلّقه عليها. نعود بعد الإجازة بوجوهٍ أكثر نشاطاً.',
    url: 'https://dr-alfailakawi.com/signature_articles/the-return-that-fails-to-fix-what-came-before-itarabic/', source: 'https://www.aljarida.com/article/119714' },
  { slug: 'the-year-that-doesnt-begin-with-the-calendararabic', title: 'السنة التي لا تبدأ من التقويم', date: '٢ يناير ٢٠٢٦', iso: '2026-01-02', cat: 'مجتمع',
    excerpt: 'ليس كلُّ عامٍ جديدٍ يبدأ حين تتبدّل الأرقام. بعض السنوات تُولد في الداخل حين ينهزم الوهم ويصحو المعنى.',
    url: 'https://dr-alfailakawi.com/signature_articles/the-year-that-doesnt-begin-with-the-calendararabic/', source: 'https://www.aljarida.com/article/119173' },
  { slug: 'when-truth-died-and-the-narrative-survivedarabic', title: 'حين ماتت الحقيقة ونجت الرواية', date: '٢٦ ديسمبر ٢٠٢٥', iso: '2025-12-26', cat: 'إعلام',
    excerpt: 'نحن لا نعيش أزمة معلومات… نحن نعيش أزمة ثقة. في زمنٍ صار فيه الدليل متعباً، والرواية خفيفة كزرّ «مشاركة».',
    url: 'https://dr-alfailakawi.com/signature_articles/when-truth-died-and-the-narrative-survivedarabic/', source: 'https://www.aljarida.com/article/118554' },
  { slug: 'a-generation-without-rootsarabic', title: 'جيلٌ بلا جذور', date: '١٩ ديسمبر ٢٠٢٥', iso: '2025-12-19', cat: 'هوية',
    excerpt: 'هذا جيلٌ يعرف كثيراً عن العالم… وقليلاً عن نفسه. يتنقّل بإصبعه بين قاراتٍ لا يعيش فيها.',
    url: 'https://dr-alfailakawi.com/signature_articles/a-generation-without-rootsarabic/', source: 'https://www.aljarida.com/article/117895' },
  { slug: 'a-society-that-fears-the-different-scheduledarabbic', title: 'المجتمع الذي يخاف من المختلف', date: '١٢ ديسمبر ٢٠٢٥', iso: '2025-12-12', cat: 'مجتمع',
    excerpt: 'المجتمع الذي يخاف من المختلف يربّي أبناءه على فضيلة واحدة: أن يختفوا في الصف.',
    url: 'https://dr-alfailakawi.com/signature_articles/a-society-that-fears-the-different-scheduledarabbic/', source: 'https://www.aljarida.com/article/117250' },
  { slug: 'the-human-who-forgot-himselfarabic', title: 'الإنسان الذي نسي نفسه', date: '٥ ديسمبر ٢٠٢٥', iso: '2025-12-05', cat: 'مجتمع',
    excerpt: 'نعيش في زمنٍ يعرف فيه الإنسان كلَّ شيءٍ عن العالم… إلا نفسه.',
    url: 'https://dr-alfailakawi.com/signature_articles/the-human-who-forgot-himselfarabic/', source: 'https://www.aljarida.com/article/116598' },
  { slug: 'intelligence-without-a-consciencearabic', title: 'ذكاءٌ بلا ضمير', date: '٢٨ نوفمبر ٢٠٢٥', iso: '2025-11-28', cat: 'تقنية',
    excerpt: 'كان الناس قديماً يخافون من جهلهم… اليوم نخاف من ذكائنا. لا لأن الآلات بدأت تفكّر، بل لأن الإنسان بدأ يتنازل.',
    url: 'https://dr-alfailakawi.com/signature_articles/intelligence-without-a-consciencearabic/', source: 'https://www.aljarida.com/article/115957' },
  { slug: 'the-success-that-destroyed-us-2', title: 'النجاح الذي دمّرنا', date: '٢١ نوفمبر ٢٠٢٥', iso: '2025-11-21', cat: 'مجتمع',
    excerpt: 'لم نُخلق لنركض طوال الوقت، لكننا حوّلنا الركض إلى طقسٍ يومي، وعبدنا القمّة حتى نسينا الطريق.',
    url: 'https://dr-alfailakawi.com/signature_articles/the-success-that-destroyed-us-2/', source: 'https://www.aljarida.com/article/115332' },
  { slug: 'when-i-evaluate-my-daughters-school-before-it-evaluates-the-2m', title: 'حين أختبرُ مدرسةَ بناتي… قبل أن تختبرَهنّ', date: '١٤ نوفمبر ٢٠٢٥', iso: '2025-11-14', cat: 'التربية',
    excerpt: 'لماذا نُسلِّم أبناءنا لمدارس لا نعرفها إلا من الإعلانات؟ لماذا نجعل القبول امتحاناً للطفل؟',
    url: 'https://dr-alfailakawi.com/signature_articles/when-i-evaluate-my-daughters-school-before-it-evaluates-the-2m/', source: 'https://www.aljarida.com/article/114668' },
  { slug: 'laughing-while-burning-2', title: 'يضحك وهو يحترق', date: '٧ نوفمبر ٢٠٢٥', iso: '2025-11-07', cat: 'مجتمع',
    excerpt: 'في كل مقطع «ريل» يضحك جيلٌ كامل… ولا يرى أن ضحكته تذوب ببطء.',
    url: 'https://dr-alfailakawi.com/signature_articles/laughing-while-burning-2/', source: 'https://www.aljarida.com/article/113991' },
  { slug: 'the-excellence-epidemic-or-the-cult-of-grades-2', title: 'عقولنا في عُلب ونتساءل: أين الإبداع؟', date: '٣١ أكتوبر ٢٠٢٥', iso: '2025-10-31', cat: 'التعليم',
    excerpt: 'مدارس تنتج… ولا تبتكر. في كل صباح، يدخل الطلبة إلى صفوف متشابهة: نفس الترتيب، نفس المقاعد، نفس السبورة.',
    url: 'https://dr-alfailakawi.com/signature_articles/the-excellence-epidemic-or-the-cult-of-grades-2/', source: 'https://www.aljarida.com/article/113369' },
  { slug: 'the-blackboard-that-no-longer-sees-anyone-2', title: 'السبورة التي لم تعد ترى أحداً!', date: '٢٤ أكتوبر ٢٠٢٥', iso: '2025-10-24', cat: 'التعليم',
    excerpt: 'كانت ترى الوجوه… تحفظ الأسماء… وتُبحر مع العقول. أما اليوم، فالسبورة نفسها أصبحت مجرد شاشة صمّاء.',
    url: 'https://dr-alfailakawi.com/signature_articles/the-blackboard-that-no-longer-sees-anyone-2/', source: 'https://www.aljarida.com/article/112767' },
  { slug: 'students-minds-are-on-vacation-while-chatgpt-works-full-time-2', title: 'عقول الطلاب في إجازة… وChatGPT يشتغل بدوام كامل!', date: '١٧ أكتوبر ٢٠٢٥', iso: '2025-10-17', cat: 'تقنية',
    excerpt: 'في زمن الواجبات الذكية، لم يعد السؤال: «هل كتب الطالب؟» بل: «من كتب؟»',
    url: 'https://dr-alfailakawi.com/signature_articles/students-minds-are-on-vacation-while-chatgpt-works-full-time-2/', source: 'https://www.aljarida.com/article/112110' },
  { slug: 'the-teacher-the-last-to-know-2', title: 'المعلّم… آخرُ من يعلم!', date: '١٠ أكتوبر ٢٠٢٥', iso: '2025-10-10', cat: 'التعليم',
    excerpt: 'تهميشٌ ناعم… لإقصاءٍ صامت. في زمن تُوزّع فيه المناهج بالتوصيل السريع، وتُطبخ السياسات التعليمية خلف الأبواب المغلقة.',
    url: 'https://dr-alfailakawi.com/signature_articles/the-teacher-the-last-to-know-2/', source: 'https://www.aljarida.com/article/111417' },
  { slug: 'dr-jasem-malik-the-lesson-that-never-ends-2', title: 'د. جاسم ملك… الحصّة التي لا تنتهي', date: '٣ أكتوبر ٢٠٢٥', iso: '2025-10-03', cat: 'التعليم',
    excerpt: 'ليس كل من يقف أمام السبورة معلّماً، بعضهم ناقل للمعلومة… وبعضهم صانع للإنسان.',
    url: 'https://dr-alfailakawi.com/signature_articles/dr-jasem-malik-the-lesson-that-never-ends-2/', source: 'https://www.aljarida.com/article/110766' },
  { slug: 'the-mind-present-in-absence-absent-in-presence-2', title: 'العقل حاضر في الغياب… وغائب في الحضور!', date: '٢٦ سبتمبر ٢٠٢٥', iso: '2025-09-26', cat: 'التعليم',
    excerpt: 'في كل صباح، تُسجّل الأسماء. فلان؟ موجود. فلانة؟ حاضرة. لكن لا أحد يسأل: هل حضر العقل؟',
    url: 'https://dr-alfailakawi.com/signature_articles/the-mind-present-in-absence-absent-in-presence-2/', source: 'https://www.aljarida.com/article/110108' },
  { slug: 'when-a-student-wishes-for-death-before-the-first-bell-2', title: 'حين يتمنى الطالب الموت… قبل أول جرس!', date: '١٩ سبتمبر ٢٠٢٥', iso: '2025-09-19', cat: 'التعليم',
    excerpt: 'في صباح أول يوم دراسي، قال المعلم لطلابه: «كل عام وأنتم بخير وعوداً حميداً»، فإذا بأحدهم يرد.',
    url: 'https://dr-alfailakawi.com/signature_articles/when-a-student-wishes-for-death-before-the-first-bell-2/', source: 'https://www.aljarida.com/article/109403' },
  { slug: 'we-handed-them-the-phone-so-theyd-leave-us-alone-2', title: 'سلّمناه الهاتف… ليستريح منا!', date: '١٢ سبتمبر ٢٠٢٥', iso: '2025-09-12', cat: 'التربية',
    excerpt: 'في زاوية من البيت، يجلس الطفل مشدوهاً أمام شاشة صغيرة، عيناه مشدودتان، فمه نصف مفتوح، وجسده لا يتحرك.',
    url: 'https://dr-alfailakawi.com/signature_articles/we-handed-them-the-phone-so-theyd-leave-us-alone-2/', source: 'https://www.aljarida.com/article/108711' },
  { slug: 'the-republic-of-degrees-and-the-fall-of-thought-2', title: 'جمهورية الشهادات… وسقوط الفكر!', date: '٥ سبتمبر ٢٠٢٥', iso: '2025-09-05', cat: 'التعليم',
    excerpt: 'في نظامنا التعليمي، المهم أن تُنجز الورقة، لا أن تفهمها. أن تُكتب الرسالة، لا أن تُغيّر صاحبها.',
    url: 'https://dr-alfailakawi.com/signature_articles/the-republic-of-degrees-and-the-fall-of-thought-2/', source: 'https://www.aljarida.com/article/108037' },
  { slug: 'freedom-without-thinking-and-openness-without-awareness-2', title: 'حُرية بلا تفكير… وانفتاح بلا وعي!', date: '٢٩ أغسطس ٢٠٢٥', iso: '2025-08-29', cat: 'مجتمع',
    excerpt: 'لم نعد نناقش المفاهيم، بل نُصفق للشعارات؛ الحُرية أصبحت كلمة يُستدعى بها كل انفلات.',
    url: 'https://dr-alfailakawi.com/signature_articles/freedom-without-thinking-and-openness-without-awareness-2/', source: 'https://www.aljarida.com/article/107391' },
  { slug: 'do-we-contain-or-raise-2', title: 'هل نحتوي… أم نربّي؟', date: '٢٢ أغسطس ٢٠٢٥', iso: '2025-08-22', cat: 'التربية',
    excerpt: 'يعتقد كثير من الآباء أنهم يربّون أبناءهم… لكنهم في الحقيقة فقط «يحتوونهم».',
    url: 'https://dr-alfailakawi.com/signature_articles/do-we-contain-or-raise-2/', source: 'https://www.aljarida.com/article/106768' },
  { slug: 'artificial-intelligence-teaches-while-the-human-mind-is-pushed-aside-2', title: 'الذكاء الاصطناعي يُدرّس… والعقل البشري يُقصى', date: '١٥ أغسطس ٢٠٢٥', iso: '2025-08-15', cat: 'تقنية',
    excerpt: 'في بعض الفصول، تحوّل المعلم إلى مراقب، والطالب إلى ناقل، وتقدّمت الشاشة خطوة… وتراجع العقل خطوتين.',
    url: 'https://dr-alfailakawi.com/signature_articles/artificial-intelligence-teaches-while-the-human-mind-is-pushed-aside-2/', source: 'https://www.aljarida.com/article/106154' },
  { slug: 'i-write-to-awaken-you-not-to-discourage-you-2', title: 'أكتب لأوقظك… لا لأحبطك!', date: '٨ أغسطس ٢٠٢٥', iso: '2025-08-08', cat: 'مجتمع',
    excerpt: 'ما أكتبه ليس تنمُّراً، بل هو حُب قاسٍ. هو ذات المفهوم الذي تُدرِّسه جامعات التربية في الغرب.',
    url: 'https://dr-alfailakawi.com/signature_articles/i-write-to-awaken-you-not-to-discourage-you-2/', source: 'https://www.aljarida.com/article/105490' },
  { slug: 'he-passed-the-exam-but-failed-the-question-2', title: 'نجح في الامتحان… وفشل في السؤال!', date: '١ أغسطس ٢٠٢٥', iso: '2025-08-01', cat: 'التعليم',
    excerpt: 'كل يوم، يدخل الطفل فصله بابتسامةٍ عفوية، ويخرج بورقة تقييم. الابتسامة تذبل تدريجياً، والورقة تكبر.',
    url: 'https://dr-alfailakawi.com/signature_articles/he-passed-the-exam-but-failed-the-question-2/', source: 'https://www.aljarida.com/article/104894' },
  { slug: 'from-the-schoolyard-to-the-food-court-2', title: 'من الساحة المدرسية… إلى ساحة المطاعم!', date: '٢٥ يوليو ٢٠٢٥', iso: '2025-07-25', cat: 'التربية',
    excerpt: 'في السابق، كانت ساحات المدارس تنبض بالحياة بعد الدوام الرسمي. الطالب يركض من الفصل إلى المسرح.',
    url: 'https://dr-alfailakawi.com/signature_articles/from-the-schoolyard-to-the-food-court-2/', source: 'https://www.aljarida.com/article/104261' },
  { slug: 'we-breastfeed-them-with-tenderness-and-deprive-them-of-education', title: 'نُرضعهم حناناً… ونحرمهم تربية!', date: '١٨ يوليو ٢٠٢٥', iso: '2025-07-18', cat: 'التربية',
    excerpt: 'نحتفل بضحكتهم، نغمرهم بالهدايا، نلبي كل طلب، ثم نُفاجأ بأنهم لا يحترمون، لا يصبرون، ولا يعرفون حدوداً.',
    url: 'https://dr-alfailakawi.com/signature_articles/we-breastfeed-them-with-tenderness-and-deprive-them-of-education/', source: 'https://www.aljarida.com/article/103628' },
  { slug: 'i-earned-more-than-harvard-but-it-doesnt-teach-brains', title: 'ربحت أكثر من «هارفارد»… لكنها لا تدرّس عقلاً!', date: '١١ يوليو ٢٠٢٥', iso: '2025-07-11', cat: 'التعليم',
    excerpt: 'في زمنٍ صارت فيه بعض الجامعات الخاصة تُحقّق أرباحاً تفوق ما تحقّقه جامعة هارفارد، لم تعد المفارقة مضحكة.',
    url: 'https://dr-alfailakawi.com/signature_articles/i-earned-more-than-harvard-but-it-doesnt-teach-brains/', source: 'https://www.aljarida.com/article/103086' },
  { slug: 'excellent-in-grades-lost-in-decision', title: 'ممتاز في الدرجات… ضائع في القرار!', date: '٤ يوليو ٢٠٢٥', iso: '2025-07-04', cat: 'التعليم',
    excerpt: 'كان يبتسم، لكن صوته خافت. يحمل ورقة نجاحه بيده، ويُخفي في قلبه سؤالاً لم يُجب عنه أحد.',
    url: 'https://dr-alfailakawi.com/signature_articles/excellent-in-grades-lost-in-decision/', source: 'https://www.aljarida.com/article/102372' },
  { slug: 'we-graduated-with-a-degree-but-the-language-was-lost-2', title: 'تخرَّجنا بشهادة… لكن ضاعت اللغة!', date: '٢٧ يونيو ٢٠٢٥', iso: '2025-06-27', cat: 'هوية',
    excerpt: 'نتقن توقيع الأسماء، وننسى كيف نكتب فكرة. في حفلات التخرُّج، تُرفع القبعات، وتُوزَّع الشهادات، وتُصفِّق الجماهير.',
    url: 'https://dr-alfailakawi.com/signature_articles/we-graduated-with-a-degree-but-the-language-was-lost-2/', source: 'https://www.aljarida.com/article/101723' },
  { slug: 'a-corona-graduate-and-his-education-account-hasnt-been-closed-yet-2', title: 'خرّيج «كورونا»… وحسابه في التعليم لم يُغلق بعد!', date: '٢٠ يونيو ٢٠٢٥', iso: '2025-06-20', cat: 'التعليم',
    excerpt: 'ليس هذا المقال تهجماً… بل نداء للمراجعة. جيلٌ كامل مرّ من بوابات التخرج دون أن يطرق باب الفهم بصدق.',
    url: 'https://dr-alfailakawi.com/signature_articles/a-corona-graduate-and-his-education-account-hasnt-been-closed-yet-2/', source: 'https://www.aljarida.com/article/101112' },
  { slug: 'rest-is-taught-and-the-mind-is-on-permanent-vacation-2', title: 'الراحة تُدرّس… والفكر في إجازة دائمة!', date: '١٣ يونيو ٢٠٢٥', iso: '2025-06-13', cat: 'التعليم',
    excerpt: 'جيل مريح، لكنه لا يتحمَّل وزن فكرة. في زمن أصبحت الراحة شعاراً تربوياً، بات السؤال الأخطر: هل نحن نُعلّم؟',
    url: 'https://dr-alfailakawi.com/signature_articles/rest-is-taught-and-the-mind-is-on-permanent-vacation-2/', source: 'https://www.aljarida.com/article/100449' },
  { slug: 'coming-soon-a-certificate-without-a-mind-2', title: 'قريباً: شهادة بدون عقل!', date: '٦ يونيو ٢٠٢٥', iso: '2025-06-06', cat: 'التعليم',
    excerpt: 'الورق يتخرّج… والعقل غائب. في زمن الشهادات، لا أحد يسأل: ما الذي تعلّمه هذا الخريج فعلاً؟',
    url: 'https://dr-alfailakawi.com/signature_articles/coming-soon-a-certificate-without-a-mind-2/', source: 'https://www.aljarida.com/article/99298' },
  { slug: 'a-certificate-of-excellence-for-a-lifeless-doll-2', title: 'شهادة امتياز… لدمية بلا وعي!', date: '٣٠ مايو ٢٠٢٥', iso: '2025-05-30', cat: 'التعليم',
    excerpt: 'في حفلات التخرّج، نُصفّق طويلاً لصاحب الامتياز، ونهديه شهادة مطرّزة وميدالية براقة، ونلتقط معه الصورة المثالية.',
    url: 'https://dr-alfailakawi.com/signature_articles/a-certificate-of-excellence-for-a-lifeless-doll-2/', source: 'https://www.aljarida.com/article/99298' },
  { slug: 'when-cheating-becomes-intelligence-and-honesty-becomes-stupidity-2', title: 'حين يصبح الغش ذكاءً… والصدق غباءً', date: '٢٣ مايو ٢٠٢٥', iso: '2025-05-23', cat: 'التعليم',
    excerpt: 'في زوايا الصفوف، لم يعد الغش سلوكاً معيباً… بل مهارة تُتداول بصمت.',
    url: 'https://dr-alfailakawi.com/signature_articles/when-cheating-becomes-intelligence-and-honesty-becomes-stupidity-2/', source: 'https://www.aljarida.com/article/98677' },
  { slug: 'we-prepare-our-children-for-success-and-leave-them-empty-handed-2', title: 'نعجن أبناءنا للنجاح… ونُخرجهم فارغين', date: '١٦ مايو ٢٠٢٥', iso: '2025-05-16', cat: 'التربية',
    excerpt: 'عقولٌ مُخمّرة بالضغط… وأرواحٌ بلا نكهة في مدارسنا. يُعامَل الطفل كما تُعامَل العجينة.',
    url: 'https://dr-alfailakawi.com/signature_articles/we-prepare-our-children-for-success-and-leave-them-empty-handed-2/', source: 'https://www.aljarida.com/article/98051' },
  { slug: 'a-generation-that-knows-everything-and-understands-nothing', title: 'جيل يعرف كل شيء… ولا يفهم شيئاً', date: '٩ مايو ٢٠٢٥', iso: '2025-05-09', cat: 'مجتمع',
    excerpt: 'في زمنٍ تسكن فيه المعلومة طرف الإبهام، وتُستدعى باللمس لا بالكدّ، نشأ جيل يعرف كل شيء… ولا يفهم شيئاً.',
    url: 'https://dr-alfailakawi.com/signature_articles/a-generation-that-knows-everything-and-understands-nothing/', source: 'https://www.aljarida.com/article/97388' },
  { slug: 'graduates-in-the-time-of-corona', title: 'خريجو زمن الكورونا.. ولكن!', date: '١٧ يوليو ٢٠٢١', iso: '2021-07-17', cat: 'التعليم',
    excerpt: 'أجلس كثيراً مع نفسي.. وبعض الوقت مع الأصدقاء والزملاء — فقد أصبح اللقاء عن بعد في الغالب — نتحدث عن أبنائنا.',
    url: 'https://dr-alfailakawi.com/signature_articles/graduates-in-the-time-of-corona/', source: 'https://www.alqabas.com/article/5856923' },
  { slug: 'ethical-hacking-culture', title: 'ثقافة الاختراق الأخلاقي.. قراصنة على خلق', date: '٢٥ مايو ٢٠٢١', iso: '2021-05-25', cat: 'تقنية',
    excerpt: 'يرتعب الخلق من الاختراقات التي تحدث لهم من الغرباء، فالهاكرز أشخاص مجهولون يهدفون للعبث والقرصنة.',
    url: 'https://dr-alfailakawi.com/signature_articles/ethical-hacking-culture/', source: 'https://www.alqabas.com/article/5850376' },
  { slug: 'turning-video-game-obsession-into-creative-meditation-2', title: 'تحويل هوس ألعاب الفيديو إلى تأمل خلاق', date: '١٧ أبريل ٢٠٢١', iso: '2021-04-17', cat: 'التربية',
    excerpt: 'يخبرني الكثير من المعارف والأصدقاء أن أبناءهم الصغار والكبار لديهم هوس في لعب الفيديو.',
    url: 'https://dr-alfailakawi.com/signature_articles/turning-video-game-obsession-into-creative-meditation-2/', source: 'https://www.alqabas.com/article/5845745' },
  { slug: 'past-mistakes-still-persist-in-the-age', title: 'أخطاء الماضي مازالت في زمن التعليم الإلكتروني', date: '٢٠ مارس ٢٠٢١', iso: '2021-03-20', cat: 'التعليم',
    excerpt: 'نجتمع متباعدين في مجالس عديدة.. وأسمع العجب.. منهم من يتحدث عن مستوى أبنائه بعد تفعيل مدرس خصوصي.',
    url: 'https://dr-alfailakawi.com/signature_articles/past-mistakes-still-persist-in-the-age/', source: 'https://www.alqabas.com/article/5842334' },
  { slug: 'the-media-is-a-vital-partner-in-the-educational-process', title: 'الإعلام الشريك العضيد للعملية التعليمية', date: '١١ يناير ٢٠٢١', iso: '2021-01-11', cat: 'إعلام',
    excerpt: 'كنت أشارك عدداً من الأصدقاء المقربين الحديث عن دور الإعلام في التعليم.. وتحاورنا بهذا الدور العظيم.',
    url: 'https://dr-alfailakawi.com/signature_articles/the-media-is-a-vital-partner-in-the-educational-process/', source: 'https://www.alqabas.com/article/5831454' },
  { slug: 'private-lesson-in-the-age-of-digital-educational-intelligence', title: 'الدروس الخصوصية.. في زمن الذكاء التعليمي الرقمي', date: '١٧ ديسمبر ٢٠٢٠', iso: '2020-12-17', cat: 'التعليم',
    excerpt: 'ذهبنا هنا وهناك، وكنا نذهب إلى المدارس والجامعات، ونرى أبناءنا على نفس الطريق.',
    url: 'https://dr-alfailakawi.com/signature_articles/private-lesson-in-the-age-of-digital-educational-intelligence/', source: 'https://www.alqabas.com/article/5825899' },
  { slug: 'e-learning-culture-2', title: 'ثقافة التعليم الإلكتروني', date: '٨ ديسمبر ٢٠٢٠', iso: '2020-12-08', cat: 'التعليم',
    excerpt: 'أينما جلست ضمن قواعد السلامة المعتادة أجد من يتحدث عن مواقف التربية والتعليم عن التعليم الإلكتروني.',
    url: 'https://dr-alfailakawi.com/signature_articles/e-learning-culture-2/', source: 'https://www.alqabas.com/article/5823187' },
  { slug: 'lets-work-towards-scientific-research', title: 'لنعمل من أجل بحث علمي', date: '١٢ مايو ٢٠٢٠', iso: '2020-05-12', cat: 'بحث',
    excerpt: 'تتفعّل في وقتنا الراهن في ظل أزمة وباء الكورونا (COVID-19) مراكز ومختبرات البحوث للتصدي لهذا الوباء القاتل.',
    url: 'https://dr-alfailakawi.com/signature_articles/lets-work-towards-scientific-research/', source: 'https://www.alqabas.com/article/5773666' },
  { slug: 'e-learning-initiatives-and-solutions-2', title: 'مبادرات وحلول للتعليم الإلكتروني', date: '٢٧ أبريل ٢٠٢٠', iso: '2020-04-27', cat: 'التعليم',
    excerpt: 'بعد إغلاق المدارس والجامعات وفقاً للتدابير الوقائية والاحتياطية للسيطرة على انتشار فيروس كورونا.',
    url: 'https://dr-alfailakawi.com/signature_articles/e-learning-initiatives-and-solutions-2/', source: 'https://www.alqabas.com/article/5770536' },
  { slug: 'alternative-plans-for-distance-education', title: 'الخطط البديلة للتعليم عن بعد', date: '٢٤ مارس ٢٠٢٠', iso: '2020-03-24', cat: 'التعليم',
    excerpt: 'قلت التجمعات التي كنا نحظى بها من قبل.. والجميع أصبحوا يخشون الخروج من منازلهم بعد العمل.',
    url: 'https://dr-alfailakawi.com/signature_articles/alternative-plans-for-distance-education/', source: 'https://www.alqabas.com/article/5763008' },
  { slug: 'eliminating-the-education-epidemic', title: 'القضاء على وباء التعليم.. بالحزم والعزم', date: '٣ مارس ٢٠٢٠', iso: '2020-03-03', cat: 'التعليم',
    excerpt: 'يعيش العالم كابوس فيروس كورونا.. وليس للناس حديث إلا عن هذا الوباء القاتل.',
    url: 'https://dr-alfailakawi.com/signature_articles/eliminating-the-education-epidemic/', source: 'https://www.alqabas.com/article/5757000' },
  { slug: 'competency-based-approach-to-the-trash', title: 'منهج الكفايات.. بطريقه إلى المهملات كسابقيه', date: '٦ فبراير ٢٠٢٠', iso: '2020-02-06', cat: 'التعليم',
    excerpt: 'نعيش في دولتنا مع وزارة التربية والتعليم نتخبّط بالمناهج.. عثرة وراء عثرة.',
    url: 'https://dr-alfailakawi.com/signature_articles/competency-based-approach-to-the-trash/', source: 'https://www.alqabas.com/article/5749297' },
  { slug: 'smartphone-child-a-creative-mind-or-a-child-being-driven', title: 'طفل الهواتف الذكية.. عقل خلاق أم طفل يساق؟!', date: '١ فبراير ٢٠٢٠', iso: '2020-02-01', cat: 'التربية',
    excerpt: 'سمعت ابني يتحدث لصديقه ويقول «أنا ذكي دون منازع.. نحن أطفال الهواتف الذكية».. تفكرت كثيراً.',
    url: 'https://dr-alfailakawi.com/signature_articles/smartphone-child-a-creative-mind-or-a-child-being-driven/', source: 'https://www.alqabas.com/article/5747496' },
  { slug: 'social-media-and-the-arts-of-learning-crime', title: '«السوشيال ميديا» وفنون تعلم الجريمة «على أصولها»', date: '١٨ يناير ٢٠٢٠', iso: '2020-01-18', cat: 'مجتمع',
    excerpt: 'كنت في منزل أحد الأصدقاء.. وكان أولاده يلعبون تارة.. ويقلبون الهواتف الذكية تارة أخرى.',
    url: 'https://dr-alfailakawi.com/signature_articles/social-media-and-the-arts-of-learning-crime/', source: 'https://www.alqabas.com/article/5743729' },
  { slug: 'the-social-media-swamp-and-plastic-surgery-addiction-2', title: 'مستنقع «السوشيال ميديا» وإدمان عمليات التجميل', date: '٢٨ نوفمبر ٢٠١٩', iso: '2019-11-28', cat: 'مجتمع',
    excerpt: 'عالم السوشيال ميديا يُدخل الفرد منا في متاهات يصعب الخروج منها.. وقد يدمنها البعض.',
    url: 'https://dr-alfailakawi.com/signature_articles/the-social-media-swamp-and-plastic-surgery-addiction-2/', source: 'https://www.alqabas.com/article/5729757' },
  { slug: 'lets-achieve-a-higher-level-of-quality-education', title: 'لنصل إلى مستوى جودة تعليم عالٍ!', date: '١٧ نوفمبر ٢٠١٩', iso: '2019-11-17', cat: 'التعليم',
    excerpt: 'سعدنا كثيراً عندما بدأ العمل في الجامعة الجديدة (الشدادية).. وبهرنا بالفخامة المعمارية.',
    url: 'https://dr-alfailakawi.com/signature_articles/lets-achieve-a-higher-level-of-quality-education/', source: 'https://www.alqabas.com/article/5726348' },
  { slug: 'the-teacher-what-do-you-know-about-the-teacher', title: 'المعلم.. وما أدراك ما المعلم', date: '٤ نوفمبر ٢٠١٩', iso: '2019-11-04', cat: 'التعليم',
    excerpt: 'التقيت مع صديق لي فوجدته غاضباً محتداً بعض الشيء، مرسوماً على وجهه الحزن.',
    url: 'https://dr-alfailakawi.com/signature_articles/the-teacher-what-do-you-know-about-the-teacher/', source: 'https://www.alqabas.com/article/5722716' },
  { slug: 'social-media-and-false-wealth', title: 'السوشيال ميديا.. والثراء الكاذب', date: '١٢ أكتوبر ٢٠١٩', iso: '2019-10-12', cat: 'مجتمع',
    excerpt: 'هراء.. نعم، هراء.. هذا ردي لكل من يتحدث عن ثراء الفاشينستات (رجالاً ونساءً).. هذا الثراء الفاحش.',
    url: 'https://dr-alfailakawi.com/signature_articles/social-media-and-false-wealth/', source: 'https://www.alqabas.com/article/5715916' },
  { slug: 'todays-childs-confusion-between-education-and-care', title: 'حيرة طفل اليوم.. ما بين التربية والرعاية', date: '٥ سبتمبر ٢٠١٩', iso: '2019-09-05', cat: 'التربية',
    excerpt: 'ما إن نجلس في مجلس إلا ونجد من يكون غائباً عن المجلس بفكره.. حائراً كحيرة طفل اليوم.',
    url: 'https://dr-alfailakawi.com/signature_articles/todays-childs-confusion-between-education-and-care/', source: 'https://www.alqabas.com/article/5704736' },
  { slug: 'are-our-phones-listening', title: 'تلفوناتنا تسمع؟!', date: '٢٩ أغسطس ٢٠١٩', iso: '2019-08-29', cat: 'تقنية',
    excerpt: 'في كل مكان أجتمع به مع الأهل أو الأصدقاء والزملاء، أجدهم يتحدثون عن طفرات تحصل وكأنها من الوهم.',
    url: 'https://dr-alfailakawi.com/signature_articles/are-our-phones-listening/', source: 'https://www.alqabas.com/article/5703000' },
  { slug: 'in-their-opinion-surgery-is-a-male-specialty-2', title: 'الجراحة برأيهم تخصص رجولي..؟!', date: '١٥ أغسطس ٢٠١٩', iso: '2019-08-15', cat: 'مجتمع',
    excerpt: 'اشتعلت مواقع التواصل والناس بمختلف الدول غضباً على تصريح جازم بالنفي.',
    url: 'https://dr-alfailakawi.com/signature_articles/in-their-opinion-surgery-is-a-male-specialty-2/', source: 'https://www.alqabas.com/article/5698972' },
  { slug: 'have-mercy-on-us-social-media-giants-2', title: 'ارحمونا يا فطاحلة السوشيال ميديا..!', date: '٣٠ يوليو ٢٠١٩', iso: '2019-07-30', cat: 'مجتمع',
    excerpt: 'كنت في عزاء أحد الأقارب، فوجدت أحد الأشخاص بعكازه وقد أصابته جلطة حسب كلامه قبل فترة.',
    url: 'https://dr-alfailakawi.com/signature_articles/have-mercy-on-us-social-media-giants-2/', source: 'https://www.alqabas.com/article/5694832' },
  { slug: 'the-open-market-for-acquiring-degrees-a-scientific-or-ethical-crisis', title: 'السوق المفتوح لاقتناء الشهادات أزمة علمية أم أخلاقية؟', date: '٢٢ يونيو ٢٠١٩', iso: '2019-06-22', cat: 'التعليم',
    excerpt: 'عدنا والعود أحمد، بعد الغياب نعود لنرصد أهم الموضوعات التي نتبادل فيها الآراء ووجهات النظر.',
    url: 'https://dr-alfailakawi.com/signature_articles/the-open-market-for-acquiring-degrees-a-scientific-or-ethical-crisis/', source: 'https://www.alqabas.com/article/682808' },
]

export const articleCats = ['الكل','التعليم','التربية','مجتمع','تقنية','هوية','إعلام','بحث']

/** المقالات مع نصوصها الكاملة (إن وُجدت في bodies.json) */
export type Article = (typeof articles)[number] & { body?: string }
export const articlesWithBody: Article[] = articles.map((a) => ({
  ...a,
  body: (bodies as Record<string, string>)[a.slug] || undefined,
}))

/** إحصاءات حيّة — تُحسب من المحتوى نفسه، لا تُكتب يدوياً */
export const stats = {
  articles: articles.length,
  words: Object.values(bodies as Record<string, string>).reduce((n, t) => n + t.trim().split(/\s+/).length, 0),
  years: new Set(articles.map((a) => a.iso.slice(0, 4))).size,
}

// الظهور الإعلامي — لقاءات تلفزيونية (مسحوبة من الموقع)
export const media = [
  { title: 'لقاء في برنامج «معاكم» على تلفزيون دولة الكويت حول مشروع التعليم عن بعد', outlet: 'تلفزيون الكويت', url: 'https://www.youtube.com/watch?v=ydhZ9IcGaVc' },
  { title: 'لقاء في تلفزيون الكويت — تكنولوجيا التعليم', outlet: 'تلفزيون الكويت', url: 'https://www.youtube.com/watch?v=MdMDpX9jwTU' },
  { title: 'برنامج «البيت العود» على قناة إثراء — مفهوم تكنولوجيا التعليم', outlet: 'قناة إثراء', url: 'https://www.youtube.com/watch?v=UsO9ju--z2M' },
  { title: 'برنامج «مساء الخير يا كويت» — حديث حول تكنولوجيا التعليم', outlet: 'تلفزيون الكويت', url: 'https://www.youtube.com/watch?v=x_nNolE8DuM' },
  { title: 'برنامج «حدد مسارك» — نصائح للشباب (٢): المهارات', outlet: 'حدد مسارك', url: 'https://www.youtube.com/watch?v=cOlGZibqDiw' },
  { title: 'برنامج «حدد مسارك» — نصائح للشباب', outlet: 'حدد مسارك', url: 'https://www.youtube.com/watch?v=-6BvLvZqTik' },
]

// المشاريع التقنية
export const projects = [
  { title: 'E-Attendance', desc: 'أول برنامج عربي لحضور الطلبة عبر تقنية QR Code — متوفر في App Store و Google Play.' },
  { title: 'نظام الجدول الدراسي', desc: 'أول برنامج في الكويت لتسهيل إعداد الجدول الدراسي للكليات والأقسام العلمية.' },
]

// أطروحة الدكتوراه
export const doctorate = {
  title: 'Education Management and Design System: Use of Internet-based Social Learning Network as a Tool to Support High School Teaching Staff in Kuwait',
  university: 'جامعة شمال كولورادو — غريلي، كولورادو',
  note: 'دكتوراه الفلسفة في التربية، تخصص تكنولوجيا التعليم — بدرجة امتياز مع مرتبة الشرف.',
}

// أبرز العضويات الدولية
export const memberships = [
  'الجمعية الدولية لتكنولوجيا التعليم (ISTE)',
  'جمعية الاتصالات التربوية والتكنولوجيا (AECT)',
  'Golden Key International Honour Society',
  'Pi Lambda Theta — الأكثر انتقائية في التربية',
  'جمعية التعليم عن بُعد الأمريكية (USDLA)',
  'رابطة أمريكا الشمالية للتربية البيئية (NAAEE)',
  'مركز مايكروسوفت للمعلمين (MIE)',
  'رابطة القيادة التربوية (ALE)',
]

// المؤتمرات والزيارات العلمية
export const conferences = [
  { title: 'المؤتمر الدولي للتعليم عن بعد والتعلّم الافتراضي', place: 'ميلانو، إيطاليا' },
  { title: 'مؤتمر المجتمعات والتكنولوجيا (C&T)', place: 'ميونخ، ألمانيا' },
  { title: 'التكنولوجيا في عالم التعليم', place: 'كوالالمبور، ماليزيا' },
  { title: 'كيف يمكن للتكنولوجيا أن تخدم العملية التعليمية', place: 'دبي، الإمارات' },
  { title: 'التكنولوجيا في الاقتصاد والمؤسسات', place: 'إسطنبول، تركيا' },
  { title: 'Maker Faire Kuwait — كلمة رئيسية', place: 'الكويت' },
  { title: 'Mini Maker Faire Dubai — كلمة رئيسية', place: 'الإمارات' },
  { title: 'مؤتمر جامعة قطر — كلمة رئيسية', place: 'قطر' },
]

// المناصب الاستشارية
export const advisory = [
  { role: 'خبير ومستشار مكتب الوزير', org: 'وزارة الإعلام' },
  { role: 'مستشار', org: 'المجلس الوطني للثقافة والفنون والآداب' },
  { role: 'مستشار', org: 'مكتبة الكويت الوطنية' },
  { role: 'خبير ومستشار — المشرف العام لبرنامج «مثمر»', org: 'الهيئة العامة للشباب' },
  { role: 'مستشار معرض الصنّاع العالمي Maker Faire', org: 'الشركة الكويتية للاستثمار' },
  { role: 'مدرب ومستشار', org: 'أكاديمية الصنّاع' },
]

// ✨ «الأحدث» — بطاقة واحدة في الصفحة الرئيسية.
// حدّثها عند نشر أي جديد (مقال / فيديو / بحث). لاحقاً: تُحسب تلقائياً من Firestore.
export const latest = {
  kind: 'مقال',                    // مقال · فيديو · بحث · كتاب
  title: articles[0].title,
  to: '/articles',                 // مسار الصفحة الداخلية
}

/* ============================================================
   المختارات — «من اختياراتي» (بنية الموقع القديم)
   عنصر واحد فقط لكل تصنيف = الأحدث. أضِف/عدّل هنا، أو اربطه بـ Firestore.
   ============================================================ */
export type Pick = {
  cat: string          // اسم التصنيف
  group: string        // المجموعة
  title: string        // العنوان أو الاقتباس
  note?: string        // سطر توضيحي
  url?: string         // رابط خارجي (اختياري)
  date?: string        // تاريخ التحديث
}

export const curatedGroups = [
  { key: 'reading',  label: 'غرفة القراءة',              cats: ['كتاب الشهر', 'مقالة تستحق القراءة', 'بحث علمي'] },
  { key: 'watch',    label: 'شاهد واستمع',                cats: ['فيديو مختار', 'مقطع صوتي', 'من منصة X'] },
  { key: 'thought',  label: 'فكر وتأمّل',                 cats: ['اقتباس وتأمّل', 'تجربة فكرية', 'سؤال مزلزل', 'إعادة صياغة', 'حكمة صامتة', 'ما وراء الفكرة'] },
  { key: 'visual',   label: 'المنطقة البصرية',            cats: ['رؤية بصرية', 'إنفوجرافيك', 'خريطة ذهنية', 'خريطة المعنى', 'صورة تغني عن الكلام'] },
  { key: 'ai',       label: 'الذكاء الاصطناعي والأدوات',  cats: ['أداة الأسبوع', 'ركن الملخصات', 'مفهوم ناشئ', 'رصد الاتجاهات', 'منصة أوصي بها'] },
  { key: 'insights', label: 'رؤى منتقاة',                 cats: ['من بريدي الوارد', 'مكتبة صغيرة', 'مكتبة صغيرة: الذكاء الاصطناعي والمجتمع', 'ما وراء الاقتباس', 'رؤية خاطفة'] },
  { key: 'society',  label: 'التعليم والمجتمع',           cats: ['المصطلح الذي أُسيء فهمه', 'ما لا تعلّمه المدارس', 'تسليط الضوء على الابتكار', 'إحياء اللغة العربية', 'قابل للنقاش'] },
]

// ✏️ املأ هذه القائمة بمختاراتك. اتركها فارغة وسيظهر «قريباً» بأناقة.
export const picks: Pick[] = [
  { cat: 'اقتباس وتأمّل', group: 'thought', title: '«التعليم إيقادُ شعلة، لا ملءُ وعاء.»', note: 'وليم بتلر ييتس' },
  { cat: 'كتاب الشهر', group: 'reading', title: 'موسوعة تكنولوجيا التعليم', note: 'عملٌ مرجعي في تكنولوجيا التعليم' },
  { cat: 'سؤال مزلزل', group: 'thought', title: 'ماذا لو كان الامتحان يقيس الخوف، لا الفهم؟' },
  { cat: 'أداة الأسبوع', group: 'ai', title: 'أدوات الذكاء الاصطناعي في إعداد الدروس', note: 'توصية أسبوعية' },
]

/* ============================================================
   السيرة الأكاديمية الكاملة (من الموقع الأصلي)
   ============================================================ */
export const bio = {
  intro:
    'حاصل على درجة دكتوراه الفلسفة في التربية، تخصص تكنولوجيا التعليم. صاحب مهارات ممتازة في التدريس وحل المشكلات، وتطوير وإدارة المشاريع، وإعداد وتطوير المناهج، فضلاً عن جمع البيانات والبحث والتحليل، مع القدرة على التحدث بطلاقة بالإنجليزية والعربية.',

  education: [
    { degree: 'دكتوراه الفلسفة في التربية — تكنولوجيا التعليم', org: 'جامعة شمال كولورادو، غريلي، كولورادو', note: 'بدرجة امتياز مع مرتبة الشرف' },
    { degree: 'ماجستير في تكنولوجيا التعليم', org: 'جامعة شمال كولورادو', note: 'بدرجة امتياز مع مرتبة الشرف' },
    { degree: 'بكالوريوس التربية في تكنولوجيا التعليم', org: 'الهيئة العامة للتعليم التطبيقي والتدريب (PAAET)', note: 'بدرجة امتياز مع مرتبة الشرف' },
  ],

  teaching: [
    { role: 'أستاذ مشارك — يناير ٢٠٢٠ حتى الآن', org: 'كلية التربية الأساسية · PAAET' },
    { role: 'أستاذ مساعد — حتى يناير ٢٠٢٠', org: 'كلية التربية الأساسية · PAAET' },
    { role: 'أستاذ منتدب في كلية التربية', org: 'جامعة الكويت' },
  ],

  work: [
    { role: 'خبير ومستشار مكتب الوزير', org: 'وزارة الإعلام' },
    { role: 'مستشار', org: 'المجلس الوطني للثقافة والفنون والآداب' },
    { role: 'مستشار', org: 'مكتبة الكويت الوطنية' },
    { role: 'خبير ومستشار', org: 'الهيئة العامة للشباب', items: ['المشرف العام لبرنامج «مثمر» الوطني', 'عضو اللجنة العليا للمبادرات', 'عضو جائزة الكويت للتميز والإبداع الشبابي', 'عضو فريق ابتكار', 'مدير المجتمع في وادي الشباب'] },
    { role: 'مستشار معرض الصنّاع العالمي Maker Faire', org: 'الشركة الكويتية للاستثمار' },
    { role: 'مدرب ومستشار', org: 'أكاديمية الصنّاع', items: ['الإدارة والقيادة', 'التعليم', 'تكنولوجيا التعليم'] },
  ],

  committees: [
    'عضو رابطة أعضاء هيئة التدريس — الكويت',
    'عضو اللجنة العليا للتحول الرقمي — PAAET',
    'مقرر لجنة تطوير البرامج والمناهج — قسم تكنولوجيا التعليم',
    'عضو لجنة البحوث — كلية التربية الأساسية',
    'عضو لجنة ضبط الجودة والاعتماد الأكاديمي',
    'عضو لجنة البعثات — قسم تكنولوجيا التعليم',
    'عضو لجنة البحث العلمي — قسم تكنولوجيا التعليم',
    'عضو لجنة الجدول وسير الامتحانات',
    'محكّم في عدة أبحاث ودراسات أكاديمية',
    'محكّم في مسابقة Heading Global',
    'عضو جمعية المعلمين الكويتية',
    'عضو جمعية الصحفيين الكويتية',
    'مدير قطاع التعليم والمناهج — Big Brains',
    'مدير البرمجة والشبكات — CTG',
  ],

  workshops: [
    'المهارات تدمّر العقل — عمّان',
    'أوقفوا التعلم عن بعد حالاً — الكويت',
    'التطبيقات التربوية والتعليمية — الكويت',
    'العمل الجماعي الإبداعي — بنك الكويت المركزي',
    'التسويق التكنولوجي — غرفة التجارة والصناعة',
    'تكنولوجيا التعليم — وزارة الشباب',
    'التكنولوجيا الأسرية — ملتقى ديسكفري الثاني',
    'روح الفريق الواحد — الدورة التأسيسية لإعداد المذيعين',
    'مهارات الاتصال — الكويت وكوالالمبور',
    'مهارات التخطيط الاستراتيجي — الكويت',
    'صنع القرار — الكويت والسعودية',
    'مهارات إدارة الوقت — الكويت والسعودية',
  ],

  certifications: [
    'معتمد من Microsoft Innovative Educator (MIE)',
    'تعلّم التصميم في القرن الحادي والعشرين (21CLD) — الدورات ١–٧',
    'سلسلة Microsoft Teams — الدورات ١–٥',
    'Minecraft Education — المسار الكامل + ساعة تميّز',
    'مستويات STEM الأول والثاني والثالث',
    'LEGO® MINDSTORMS® Education EV3 — المسار الكامل',
    'تطبيقات التعليم الذكي — جامعة حمدان، الإمارات',
    'الرخصة الدولية لقيادة الحاسب الآلي (ICDL)',
    'إنترنت الأشياء — الكويت',
    'التصنيع الرقمي التعليمي — الكويت',
    'أدوات التلعيب التعليمية التكنولوجية — الكويت',
    'أساسيات الصحة النفسية — الكويت',
  ],

  skills: ['تحليل البرمجيات', 'فوتوشوب', 'تحرير الفيديو', 'MAC · WIN', 'تحليل البحوث والبيانات (SPSS)'],
}

/* ============================================================
   📸 الصور الاحترافية
   ضع الملفات في: src/assets/  ثم فعّل الأسطر أدناه في الصفحات.
   المقاسات المثالية:
     hero     — عمودي 4:5  (1600×2000) — بورتريه درامي
     about    — أفقي 3:2   (2000×1333) — أثناء المحاضرة
     books    — أفقي 16:9  (2400×1350) — الكتب التسعة مصفوفة
     cv       — عمودي 3:4  (1200×1600) — رسمي هادئ
   الصيغة: .webp (جودة ٨٢). احتفظ بنسخة .jpg احتياطية.
   ============================================================ */
export const photos = {
  hero: '',    // مثال: '/src/assets/hero.webp'
  about: '',
  books: '',
  cv: '',
}

/* ============================================================
   اللقاءات القادمة — أضِف لقاءً هنا فيظهر تلقائياً.
   اتركها فارغة وتظهر رسالة أنيقة بدل فراغ ميّت.
   ============================================================ */
export type Event = {
  title: string
  org: string
  place: string
  date: string        // للعرض
  iso: string         // YYYY-MM-DD — للترتيب وحساب «انقضى»
  time?: string
  url?: string        // رابط التسجيل
  kind?: string       // محاضرة · ورشة · مؤتمر · لقاء
}

export const upcoming: Event[] = [
  // مثال (احذفه واستبدله):
  // { title: 'ورشة: الذكاء الاصطناعي في التقييم التربوي', org: 'كلية التربية الأساسية',
  //   place: 'الكويت', date: '١٢ سبتمبر ٢٠٢٦', iso: '2026-09-12', time: '٦:٠٠ م',
  //   kind: 'ورشة', url: 'https://schedule.dr-alfailakawi.com/' },
]

/* ============================================================
   من بريدي الوارد
   ============================================================ */
export const testimonials = [
  { quote: 'أعجبني قولك إن التعليم ليس معلومات بل صناعة معنى، هذه جملة أحتفظ بها على مكتبي.' },
  { quote: 'دكتور أحمد، مقالتك الأخيرة جعلتني أعيد التفكير في طريقة تربية أطفالي، شكراً لأنك تكتب بهذا العمق.' },
]

export const inboxLinks = [
  { title: 'معهد استشراف المستقبل — Dell (٢٠١٧)',
    note: 'العصر التالي لشراكات الإنسان–الآلة · تقدير: ٨٥٪ من وظائف ٢٠٣٠ لم تُخترع بعد',
    url: 'https://www.delltechnologies.com/content/dam/delltechnologies/assets/perspectives/2030/pdf/SR1940_IFTFforDellTechnologies_Human-Machine_070517_readerhigh-res.pdf' },
  { title: 'محاضرة TED — كيف نعيد تعريف النجاح في المدارس',
    note: 'نظرية العلامات الخمس',
    url: 'https://www.ted.com/talks/elizabeth_caslin_redefining_student_success_using_the_5_labels_theory' },
  { title: 'تقرير اليونسكو ٢٠٢٤ — مستقبل التعليم في العالم',
    note: 'وثيقة مرجعية',
    url: 'https://unesdoc.unesco.org/ark:/48223/pf0000381794' },
]

export const faqs = [
  { q: 'ما أفضل طريقة لتعريف الطفل بالتكنولوجيا دون أن يدمنها؟',
    a: 'القاعدة الذهبية: شارك قبل أن تراقب. اجعل التكنولوجيا وسيلة للخلق والإبداع لا مجرد ترفيه.' },
  { q: 'هل التعليم التقليدي انتهى؟',
    a: 'التعليم التقليدي لم ينتهِ، لكنه يحتاج إلى ثورة فكرية تجعل الطالب محور العملية التعليمية لا مجرد متلقٍّ.' },
  { q: 'كيف أختار تخصصي الجامعي في زمن يتغيّر بسرعة؟',
    a: 'ابدأ من قيمك قبل ميولك، ثم اربط ذلك بالاتجاهات العالمية وسوق العمل المستقبلي. لا تجعل الشهادة هدفاً، بل وسيلة لاكتساب مهارات حياتية ومهنية.' },
]

/* ============================================================
   حول الموقع — بنصّه الأصلي
   ============================================================ */
export const aboutSite = {
  hero: 'مرحباً بك في فضاءٍ مُنتقى بعناية… حيث لكل قسم غاية، ولكل اختيار فلسفة.',
  sections: [
    { title: 'الرؤية والهدف',
      body: 'هذا الموقع ليس مجرد سيرة ذاتية… بل تجربة فكرية، ومختبر تربوي مفتوح. أنشأته ليكون نافذتي الصادقة إلى القارئ النبيل، والباحث عن المعنى، وصاحب القرار الذي لا تكتبه الأرقام دون بصيرة.' },
    { title: 'لماذا هذا الموقع؟',
      body: 'لأني أؤمن أن الكلمة يجب أن تتحرّر من أرشيف المجلات والمؤتمرات… وتصل إلى يد من يحتاجها. ولأن التعليم اليوم بحاجة إلى صوت مختلف… لا يساير، بل يُثير.' },
  ],
  distinct: [
    'يُعرض فيه مشروعي الأكاديمي والفكري بلغة قريبة وعميقة.',
    'يضمّ مقالاتي الشخصية والفكرية المنشورة في الصحافة والمجلات العلمية، لا مقالات عامة أو ترويجية.',
    'يتضمّن أرشيفاً مختاراً من اللقاءات والدورات والمحاضرات والمقاطع المؤثرة.',
    'يُقدّم قسماً نادراً بعنوان «من اختياراتي» — مواقع ومصادر وأدوات ومفاهيم موثوقة، مختارة بعين ناقدة لا تُروّج بل تُرشّد.',
  ],
  audience: [
    'للطالب الذي يحتاج إلى دليل موثوق في عالم مشتّت',
    'للمعلم الذي يبحث عن تطوير حقيقي يتجاوز الدورات المكرّرة',
    'للمهتم بالتعليم، الذي لم يجد بعد ما «يَهُزّهُ» بصدق',
    'ولصاحب القرار الذي يبحث عن فكر مؤسسي… لا انفعالي',
  ],
  creed: [
    'هذا الموقع لا يضع كل شيء، بل يختار الأهم.',
    'لا يقدّم كل ما يُنشر، بل ما يستحق أن يُحفّز، يُربك، ويُفكّر.',
    'لا يدّعي الكمال… بل يُمثّل محاولة ناضجة لتقريب الفكر من الحياة.',
  ],
}

/* الموقع الجغرافي */
export const place = {
  label: 'كلية التربية الأساسية — بوابة ٧',
  city: 'الكويت',
  mapEmbed:
    'https://maps.google.com/maps?q=%D9%83%D9%84%D9%8A%D8%A9%20%D8%A7%D9%84%D8%AA%D8%B1%D8%A8%D9%8A%D8%A9%20%D8%A7%D9%84%D8%A3%D8%B3%D8%A7%D8%B3%D9%8A%D8%A9%20%D8%A8%D9%88%D8%A7%D8%A8%D9%87%D8%A7%20gate%207&t=m&z=15&output=embed&iwloc=near',
}

/* النشرة البريدية — ضع رابط المزوّد (Mailchimp / Buttondown / Formspree) */
export const NEWSLETTER_ENDPOINT = '' // مثال: 'https://formspree.io/f/xxxxxxx'

/* بيانات الموقع لمحرّكات البحث */
export const site = {
  url: 'https://dr-alfailakawi.com',
  title: 'د. أحمد الفيلكاوي — أستاذ تكنولوجيا التعليم',
  description:
    'الموقع الرسمي للدكتور أحمد حسين الفيلكاوي، أستاذ تكنولوجيا التعليم المشارك. تسعة كتب، ثمانية عشر بحثاً محكّماً، واثنان وسبعون مقالاً في التعليم والتقنية والمجتمع.',
  ogImage: '/og.png',
}
