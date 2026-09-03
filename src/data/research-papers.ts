export type ResearchPaper = {
  slug: string
  title: string
  /** ترجمة عربية تظهر بخط رفيع تحت العنوان الإنجليزي — قابلة للتحرير من لوحة التحكم */
  titleAr?: string
  meta: string
  abstractAr: string
  journal: string
  source?: string
  pdf?: string
  researchgate?: string
  scholar?: string
  coAuthors?: string
  doi?: string
  reviewStatus?: string
  studyType?: string
  methodology?: string
  sample?: string
  researchQuestion?: string
  keyFinding?: string
  contribution?: string
  applications?: string
  limitations?: string
  keywords?: string
  orcid?: string
  repository?: string
  year?: string
  metadataText?: string
  pdfText?: string
  analysisText?: string
  analysisFingerprint?: string
  analysisSources?: string
  analyzedAt?: string
  url: string
  verification?: 'verified' | 'needs-manual-review'
}

const coAuthor = 'د. عبدالعزيز دخيل العنزي'

export const researchPapers: ResearchPaper[] = [
  {
    slug: 'faculty-attitudes-edtech',
    title: 'اتجاهات الهيئة التدريسية نحو استخدام تكنولوجيا التعليم في كلية التربية الأساسية في الهيئة العامة للتعليم التطبيقي والتدريب بدولة الكويت',
    meta: 'تكنولوجيا التعليم · اتجاهات أعضاء هيئة التدريس',
    abstractAr: 'هدفت الدراسة إلى تقصي اتجاهات أعضاء هيئة التدريس نحو استخدام تكنولوجيا التعليم في كلية التربية الأساسية بالهيئة العامة للتعليم التطبيقي والتدريب في دولة الكويت. استخدم الباحثان المنهج الوصفي المسحي، وأعدّا استبانة لقياس اتجاهات أعضاء هيئة التدريس بعد التحقق من صدقها وثباتها، ثم طبقاها على عينة من أعضاء الهيئة التدريسية. تناولت الأداة الجوانب المرتبطة بأهمية تكنولوجيا التعليم، ومستوى الاستخدام، والاستعداد المهني، والمعوقات التي قد تحد من توظيفها. وأظهرت النتائج صورة ميدانية لاتجاهات أفراد العينة نحو استخدام التكنولوجيا في التدريس الجامعي، بما يساعد على تحديد احتياجات التدريب والدعم المؤسسي اللازمة لزيادة الاستخدام الفعّال داخل الكلية.',
    journal: 'مجلة العلوم التربوية، كلية الدراسات العليا للتربية، جامعة القاهرة · 2017',
    sample: 'تكونت عينة الدراسة من 246 عضواً من أعضاء هيئة التدريس في كلية التربية الأساسية بدولة الكويت.',
    year: '2017',
    source: 'https://doi.org/10.21608/SSJ.2017.50847',
    pdf: 'https://search.shamaa.org/PDF/Articles/EGJes/JesVol25No1P2Y2017/jes_2017-v25-n1-p2_001-030.pdf',
    researchgate: 'https://www.researchgate.net/publication/342135278_atjahat_alhyyt_altdrysyt_nhw_astkhdam_tknwlwjya_altlym_fy_klyt_altrbyt_alasasyt_fy_alhyyt_alamt_lltlym_alttbyqy_waltdryb_bdwlt_alkwyt_The_study_aimed_at_exploring_faculty_members_trends_toward_the_use',
    coAuthors: coAuthor,
    doi: '10.21608/SSJ.2017.50847',
    url: '/research/faculty-attitudes-edtech',
    verification: 'verified',
  },
  {
    slug: 'multimedia-higher-education',
    title: 'فاعلية استخدام أعضاء هيئة التدريس للوسائط المتعددة في التعليم الجامعي من وجهة نظر الطلبة في كلية التربية الأساسية بدولة الكويت',
    meta: 'الوسائط المتعددة · التعليم الجامعي',
    abstractAr: 'هدفت هذه الدراسة إلى التعرف على فاعلية استخدام أعضاء هيئة التدريس للوسائط المتعددة في التعليم الجامعي من وجهة نظر الطلبة في كلية التربية الأساسية بدولة الكويت. استخدم الباحثان المنهج الوصفي المسحي، وقاما بإعداد استبانة لقياس فاعلية استخدام أعضاء هيئة التدريس للوسائط من خلال تقصي وجهة نظر الطلبة في ضوء عدد من المتغيرات وهي: الجنس، والمستوى الدراسي لدى الطلبة، والتحصيل. تكونت الاستبانة من (35) فقرة، وتم التحقق من صدق وثبات الأداة وكانت القيمة مقبولة لغايات الدراسة بعد تحكيمها. تكونت عينة الدراسة من (395) طالباً وطالبة في كلية التربية الأساسية، اختيرت العينة بالطريقة العشوائية. أظهرت نتائج الدراسة فاعلية استخدام أعضاء هيئة التدريس للوسائط المتعددة في التعليم الجامعي من وجهة نظر الطلبة بمتوسط حسابي للمجال ككل (3.18)، ووجود فروق دالة إحصائياً تعزى للجنس جاءت الفروق لصالح الإناث. وأظهرت الدراسة وجود فروق دالة إحصائياً تعزى لمتغير المستوى الدراسي لصالح السنة الثالثة والرابعة، كما أظهرت تبايناً ظاهرياً في المتوسطات الحسابية والانحرافات المعيارية لفاعلية استخدام أعضاء هيئة التدريس للوسائط المتعددة من وجهة نظر الطلبة في كلية التربية الأساسية بسبب اختلاف فئات متغير التحصيل لدى الطلبة، وتم استخدام تحليل التباين الأحادي لبيان الفروق، وأظهر عدم وجود فروق دالة إحصائياً تعزى لمتغير التحصيل لدى الطلبة.',
    journal: 'المجلة التربوية، جامعة الكويت · المجلد 31، العدد 123 · 2017 · ص 61–99',
    source: 'https://journals.ku.edu.kw/joe/index.php/joe/article/view/2897',
    pdf: 'https://journals.ku.edu.kw/joe/index.php/joe/article/view/2897/2091',
    researchgate: 'https://www.researchgate.net/publication/381597554_falyt_astkhdam_ada_hyyt_altdrys_llwsayt_almtddt_fy_altlym_aljamy_mn_wjht_nzr_altlbt_fy_klyt_altrbyt_alasasyt_bdwlt_alkwyt',
    coAuthors: coAuthor,
    doi: '10.34120/joe.v31i123.2897',
    url: '/research/multimedia-higher-education',
    verification: 'verified',
  },
  {
    slug: 'web-navigation-learning-skills',
    title: 'فاعلية الإبحار في المواقع الإلكترونية على تحسين مهارات الطلبة نحو التعلم في كلية التربية الأساسية من وجهة نظر الطلبة أنفسهم في الهيئة العامة للتعليم التطبيقي والتدريب في دولة الكويت',
    meta: 'الإبحار الإلكتروني · مهارات التعلّم',
    abstractAr: 'هدفت الدراسة إلى تقصي فاعلية الإبحار في المواقع الإلكترونية على تحسين مهارات الطلبة نحو التعلم في كلية التربية الأساسية من وجهة نظر الطلبة أنفسهم في الهيئة العامة للتعليم التطبيقي والتدريب في دولة الكويت. استخدم الباحثان المنهج الوصفي المسحي، وأعدّا استبانة لقياس درجة امتلاك طلبة كلية التربية الأساسية لمهارات التعلم. تكونت عينة الدراسة من 139 طالباً و244 طالبة. أظهرت النتائج فاعلية الإبحار في المواقع الإلكترونية في تحسين مهارات التعلم؛ وجاءت مهارة إدارة الاختبار في المرتبة الأولى، ومعالجة البيانات في المرتبة الأخيرة، وبلغ المتوسط الكلي 3.11. كما ظهرت فروق دالة لصالح الإناث، ولصالح طلبة السنتين الثانية والثالثة في القراءة السريعة وإدارة الاختبار والدرجة الكلية، وفروق مرتبطة بالتحصيل لصالح ذوي التحصيل المرتفع في الاستذكار ومعالجة المعلومات والقراءة السريعة والدرجة الكلية.',
    journal: 'مجلة التربية، جامعة الأزهر · المجلد 37، العدد 177، الجزء 2 · 2018 · ص 845–886',
    source: 'https://jsrep.journals.ekb.eg/article_27349.html',
    researchgate: 'https://www.researchgate.net/publication/342135283_falyt_alabhar_fy_almwaq_alalktrwnyt_ly_thsyn_mharat_altlbt_nhw_altlm_fy_klyt_altrbyt_alasasyt_mn_wjht_nzr_altlbt_anfshm_fy_alhyyt_alamt_lltlym_alttbyqy_waltdryb_fy_dwlt_alkwyt_This_study_aimed_at_inve',
    coAuthors: coAuthor,
    doi: '10.21608/jsrep.2019.27349',
    pdf: '/files/research/03-web-navigation-learning-skills.pdf',
    url: '/research/web-navigation-learning-skills',
    verification: 'verified',
  },
  {
    slug: 'elearning-research-skills',
    title: 'أهمية التعلم الإلكتروني في اكتساب مهارات البحث العلمي من وجهة نظر طلبة البكالوريوس والدراسات العليا في دولة الكويت',
    meta: 'التعلّم الإلكتروني · مهارات البحث العلمي',
    abstractAr: 'هدفت الدراسة إلى تقصي أهمية التعلم الإلكتروني في اكتساب مهارات البحث العلمي من وجهة نظر طلبة البكالوريوس والدراسات العليا في دولة الكويت. استخدم الباحثان المنهج الوصفي المسحي، وقاما بإعداد استبانة لقياس درجة امتلاك طلبة البكالوريوس والدراسات العليا لمهارات البحث العلمي في ضوء عدد من المتغيرات. تكونت عينة الدراسة من (315) طالباً وطالبة من طلبة البكالوريوس بقسم تكنولوجيا التعليم في الهيئة العامة للتعليم التطبيقي والتدريب، و(280) طالباً وطالبة من طلبة الدراسات العليا بجامعة الكويت. توصلت الدراسة إلى أهمية التعلم الإلكتروني لاكتساب مهارات البحث العلمي لدى الطلبة، وأن درجة امتلاك الطلبة من البكالوريوس والدراسات العليا لمهارات البحث العلمي جاءت متوسطة رغم وجود ضعف واضح في مهارات البحث العلمي لدى طلبة البكالوريوس، حيث بلغ المتوسط الحسابي للمجال ككل (3.13). وأظهرت النتائج وجود فروق ذات دلالة إحصائية (α=0.05) تعزى لمتغير الجنس، وجاءت الفروق لصالح الإناث، ووجود فروق ذات دلالة إحصائية (α=0.05) تعزى لمتغير المرحلة الدراسية، وجاءت الفروق لصالح الدراسات العليا.',
    journal: 'مجلة كلية التربية، جامعة الإسكندرية · المجلد 28، العدد 5 · 2018 · ص 349–371',
    source: 'https://search.shamaa.org/fullrecord?ID=341605',
    researchgate: 'https://www.researchgate.net/publication/342135475_ahmyt_altlm_alalktrwny_fy_aktsab_mharat_albhth_allmy_ldy_tlbt_albkalwryws_waldrasat_allya_fy_dwlt_alkwyt_mn_wjht_nzr_altlbt_anfshm_The_study_aimed_at_exploring_the_importance_of_e-learning_in_the_acqu',
    coAuthors: coAuthor,
    pdf: '/files/research/04-elearning-research-skills.pdf',
    url: '/research/elearning-research-skills',
    verification: 'verified',
  },
  {
    slug: 'faculty-members-degree-of-awareness-of-augmented-reality-concept-in-the-college-of-basic-education-public-authority-for-applied-education-and-training-in-kuwait-2',
    title: 'Faculty Members Degree of Awareness of Augmented Reality Concept in the College of Basic Education, Public Authority for Applied Education and Training in Kuwait',
    titleAr: 'درجة وعي أعضاء هيئة التدريس بمفهوم الواقع المعزز في كلية التربية الأساسية بالهيئة العامة للتعليم التطبيقي والتدريب في دولة الكويت',
    meta: 'Augmented Reality · Faculty Awareness',
    abstractAr: 'هدفت الدراسة إلى قياس درجة وعي أعضاء هيئة التدريس بمفهوم الواقع المعزز في كلية التربية الأساسية بالهيئة العامة للتعليم التطبيقي والتدريب في دولة الكويت. استخدم الباحثان المنهج الوصفي التحليلي، وأعدّا استبانة من أربعة مجالات لقياس درجة الوعي بمفهوم الواقع المعزز لدى أعضاء هيئة التدريس. تكونت عينة الدراسة من (100) عضو هيئة تدريس في كلية التربية الأساسية. أظهرت نتائج الدراسة أن المتوسط الحسابي لدرجة وعي أعضاء هيئة التدريس بمفهوم الواقع المعزز جاء متوسطاً، إذ بلغ المتوسط الحسابي لدرجة الوعي ككل (3.33). وكشفت الدراسة أن المتوسطات الحسابية للمجالات تراوحت بين (3.15–3.48)؛ فجاء مجال معايير جودة الاستخدام في المرتبة الأولى بأعلى متوسط حسابي بلغ (3.48)، وجاء مجال الهدف في المرتبة الثانية بمتوسط حسابي (3.37)، ومجال طبيعة المفهوم في المرتبة الثالثة بمتوسط حسابي (3.25)، بينما جاء مجال الأنواع في المرتبة الأخيرة بمتوسط بلغ (3.15)، وبذلك كانت درجة الوعي في جميع المجالات متوسطة.',
    journal: 'Journal of Education and Practice · Vol. 9, No. 32 · 2018 · pp. 12–26',
    source: 'https://www.iiste.org/Journals/index.php/JEP/article/view/45257',
    pdf: '/files/research/05-augmented-reality-awareness.pdf',
    researchgate: 'https://www.researchgate.net/publication/342135534_drjt_wy_ada_hyyt_altdrys_lmfhwm_alwaq_almzz_fy_klyt_altrbyt_alasasyt_balhyyt_alamt_lltlym_alttbyqy_waltdryb_fy_dwlt_alkwyt_Faculty_Members_Degree_of_Awareness_of_the_Augmented_Reality_Concept_in_the_C',
    coAuthors: coAuthor,
    url: '/research/faculty-members-degree-of-awareness-of-augmented-reality-concept-in-the-college-of-basic-education-public-authority-for-applied-education-and-training-in-kuwait-2',
    verification: 'verified',
  },
  {
    slug: 'obstacles-to-the-employment-of-education-technology-and-means-for-students-with-special-needs-from-the-point-of-view-of-faculty-members-at-the-public-authority-for-applied-2',
    title: 'Obstacles to the Employment of Education Technology and Means for Students with Special Needs from the Point of View of Faculty Members at the Public Authority for Applied Education and Training in Kuwait',
    titleAr: 'معوقات توظيف تكنولوجيا التعليم ووسائلها للطلبة ذوي الاحتياجات الخاصة من وجهة نظر أعضاء هيئة التدريس في الهيئة العامة للتعليم التطبيقي والتدريب في دولة الكويت',
    meta: 'Education Technology · Special Needs',
    abstractAr: 'هدفت الدراسة إلى الكشف عن معوقات توظيف تكنولوجيا التعليم ووسائلها للطلبة ذوي الاحتياجات الخاصة من وجهة نظر أعضاء هيئة التدريس في الهيئة العامة للتعليم التطبيقي والتدريب في دولة الكويت. استخدم الباحث المنهج الوصفي التحليلي المسحي، وأعدّ استبانة لقياس المعوقات في ثلاثة مجالات: معوقات مرتبطة بالمعلم، ومعوقات إدارية، ومعوقات خاصة بالطلبة. تكونت عينة الدراسة من (246) عضواً من أعضاء هيئة التدريس في كلية التربية الأساسية اختيروا بطريقة عشوائية. أظهرت النتائج عدم وجود فروق ذات دلالة إحصائية (α≤0.05) تعزى إلى أثر الجنس، ووجود فروق ذات دلالة إحصائية (α≤0.05) في الرتبة العلمية جاءت لصالح الأستاذ المشارك، ووجود فروق ذات دلالة إحصائية (α≤0.05) في سنوات الخبرة جاءت لصالح من تقل خبرتهم عن خمس سنوات، إضافة إلى وجود فروق ذات دلالة إحصائية (α≤0.05) تعزى إلى أثر طريقة التعليم، وجاءت الفروق لصالح الطريقة التقليدية.',
    journal: 'International Journal of Humanities and Social Science · Vol. 10, No. 11 · 2020',
    source: 'https://doi.org/10.30845/ijhss.v10n11p6',
    pdf: 'https://ijhss.thebrpi.org/journals/Vol_10_No_11_November_2020/6.pdf',
    doi: '10.30845/ijhss.v10n11p6',
    url: '/research/obstacles-to-the-employment-of-education-technology-and-means-for-students-with-special-needs-from-the-point-of-view-of-faculty-members-at-the-public-authority-for-applied-2',
    verification: 'verified',
  },
  {
    slug: 'the-availability-of-e-learning-qualifications-among-faculty-members-at-the-faculty-of-basic-education-in-kuwait-2',
    title: 'The Availability of E-Learning Qualifications Among Faculty Members at The Faculty of Basic Education in Kuwait',
    titleAr: 'مدى توافر كفايات التعلم الإلكتروني لدى أعضاء هيئة التدريس في كلية التربية الأساسية في دولة الكويت',
    meta: 'E-Learning Qualifications · Faculty',
    abstractAr: 'هدفت الدراسة إلى الكشف عن مدى توافر كفايات التعلم الإلكتروني لدى أعضاء هيئة التدريس في كلية التربية الأساسية في دولة الكويت، إضافة إلى مدى توافر كفايات تصميم المقررات الإلكترونية: (كفايات التخطيط، وكفاية إدارة المقرر وتنفيذه، وكفايات التصميم والإعداد). استُخدم المنهج الوصفي المسحي، وأعدّ الباحث استبانة الكفايات، وتم التحقق من صدق الأداة وثباتها. تكونت عينة الدراسة من (246) عضواً من أعضاء هيئة التدريس في كلية التربية الأساسية اختيروا بطريقة عشوائية. أظهرت النتائج أن الكفاية الحاسوبية جاءت في المرتبة الأولى بأعلى متوسط حسابي بلغ (3.96)، وجاءت كفاية استخدام الإنترنت في المرتبة الثانية بمتوسط حسابي (3.92)، بينما جاءت كفاية تصميم المقررات الإلكترونية في المرتبة الأخيرة بمتوسط حسابي (3.84)، وبلغ المتوسط الحسابي للدرجة الكلية (3.89). كما أظهرت النتائج أن كفايات تصميم المقررات الفرعية جاءت بالترتيب: (كفاية التخطيط، ثم كفاية إدارة المقرر وتنفيذه، ثم كفاية التصميم والإعداد)، وبلغ المتوسط الحسابي لكفاية تصميم المقررات الإلكترونية ككل (3.84). وأظهرت النتائج تبايناً ظاهرياً في المتوسطات الحسابية والانحرافات المعيارية لمدى توافر كفايات التعلم الإلكتروني باختلاف فئات متغيرات الجنس والرتبة العلمية والخبرة، ووجود فروق ذات دلالة إحصائية بين الأستاذ والأستاذ المشارك من جهة والأستاذ المساعد من جهة أخرى جاءت الفروق لصالح الأستاذ المساعد، ووجود فروق ذات دلالة إحصائية بين من تقل خبرتهم عن خمس سنوات وفئة (10–15) سنة جاءت الفروق لصالح من تقل خبرتهم عن خمس سنوات.',
    journal: 'International Journal of Applied Science and Technology · Vol. 11, No. 1 · 2021',
    source: 'https://ijast.thebrpi.org/journal/index/990',
    pdf: 'https://ijast.thebrpi.org/journals/Vol_11_No_1_March_2021/4.pdf',
    url: '/research/the-availability-of-e-learning-qualifications-among-faculty-members-at-the-faculty-of-basic-education-in-kuwait-2',
    verification: 'verified',
  },
  {
    slug: 'the-reality-of-using-cloud-computing-in-university-education-from-the-point-of-view-of-faculty-members-in-kuwait-2',
    title: 'The Reality of Using Cloud Computing in University Education from The Point of View of Faculty Members in Kuwait',
    titleAr: 'واقع استخدام الحوسبة السحابية في التعليم الجامعي من وجهة نظر أعضاء هيئة التدريس في دولة الكويت',
    meta: 'Cloud Computing · University Education',
    abstractAr: 'هدفت الدراسة إلى الكشف عن واقع استخدام الحوسبة السحابية في التعليم الجامعي من وجهة نظر أعضاء هيئة التدريس في دولة الكويت. استُخدم المنهج الوصفي المسحي، وأُعدت استبانة لقياس واقع استخدام الحوسبة السحابية في التعليم الجامعي، وقسّم الباحث الأداة إلى أربعة مجالات: أولاً إدارة المعلومات، وثانياً المكتبات السحابية الرقمية، وثالثاً الأرشفة الإلكترونية، ورابعاً المستودعات الرقمية والبحث العلمي. طُبقت الأداة على عينة الدراسة المكونة من (258) عضواً من أعضاء هيئة التدريس في كلية التربية الأساسية. أظهرت النتائج أن المتوسطات الحسابية تراوحت بين (2.21–2.96)؛ إذ جاءت المكتبات السحابية الرقمية في المرتبة الأولى بأعلى متوسط حسابي بلغ (2.96) وبأهمية نسبية (49%)، وجاءت الأرشفة الإلكترونية في المرتبة الثانية بمتوسط حسابي (2.30) وبأهمية نسبية (46%)، وجاءت المستودعات الرقمية والبحث العلمي في المرتبة الثالثة بمتوسط حسابي (2.28) وبأهمية نسبية (45.6%)، بينما جاءت إدارة المعلومات في المرتبة الأخيرة بمتوسط حسابي (2.21) وبأهمية نسبية (44.2%)، وبلغ المتوسط الحسابي للأداة ككل (2.31) وبنسبة (46.2%)، وهي نتيجة منخفضة. وأظهرت النتائج عدم وجود فروق ذات دلالة إحصائية تعزى إلى أثر الجنس والرتبة العلمية، بينما وُجدت فروق ذات دلالة إحصائية بين من تقل خبرتهم عن خمس سنوات وفئة (5–10) سنوات جاءت الفروق لصالح فئة (5–10) سنوات.',
    sample: 'طُبقت الأداة على عينة الدراسة المكونة من (258) عضواً من أعضاء هيئة التدريس في كلية التربية الأساسية.',
    journal: 'International Journal of Business, Humanities and Technology · Vol. 11, No. 1 · 2021 · pp. 8–25',
    source: 'https://doi.org/10.30845/ijbht.v11n1p2',
    pdf: 'https://ijbht.thebrpi.org/journals/Vol_11_No_1_March_2021/2.pdf',
    researchgate: 'https://www.researchgate.net/publication/373072667_The_Reality_of_Using_Cloud_Computing_in_University_Education_from_the_Point_of_View_of_Faculty_Members_in_Kuwait',
    doi: '10.30845/ijbht.v11n1p2',
    url: '/research/the-reality-of-using-cloud-computing-in-university-education-from-the-point-of-view-of-faculty-members-in-kuwait-2',
    verification: 'verified',
  },
  {
    slug: 'how-important-is-the-use-of-e-learning-management-systems-in-building-a-smart-university-in-kuwait-2',
    title: 'How Important Is the Use of E-Learning Management Systems in Building a Smart University in Kuwait?',
    titleAr: 'ما أهمية استخدام أنظمة إدارة التعلم الإلكتروني في بناء جامعة ذكية في دولة الكويت؟',
    meta: 'E-Learning Management Systems · Smart University',
    abstractAr: 'هدفت الدراسة إلى تقصي أهمية استخدام أنظمة إدارة التعلم الإلكتروني في بناء الجامعات الذكية في دولة الكويت. أظهرت النتائج أهمية استخدام أنظمة إدارة التعلم الإلكتروني في بناء جامعة ذكية في الكويت بدرجة متوسطة، إذ تراوحت المتوسطات الحسابية بين (2.46–4.37)، وبلغ المتوسط الحسابي للأداة ككل (3.33). وأظهرت النتائج فروقاً ذات دلالة إحصائية تعزى إلى الرتبة العلمية جاءت لصالح الأستاذ المشارك والأستاذ المساعد، وفروقاً ذات دلالة إحصائية (α=0.05) في سنوات الخبرة بين من تقل خبرتهم عن خمس سنوات ومن تزيد خبرتهم على خمس عشرة سنة جاءت الفروق لصالح من تقل خبرتهم عن خمس سنوات.',
    journal: 'Journal of Positive Psychology and Wellbeing · Vol. 6, No. 3 · 2022 · pp. 113–136',
    source: 'https://journalppw.com/index.php/jppw/article/view/14879',
    pdf: 'https://www.journalppw.com/index.php/jppw/article/download/14879/9638',
    url: '/research/how-important-is-the-use-of-e-learning-management-systems-in-building-a-smart-university-in-kuwait-2',
    verification: 'verified',
  },
  {
    slug: 'investigating-the-role-of-e-learning-management-systems-in-the-learning-process-from-the-point-of-view-of-the-faculty-at-the-faculty-of-basic-education-in-kuwait-2',
    title: 'Investigating The Role of E-Learning Management Systems in The Learning Process from The Point of View of The Faculty at The Faculty of Basic Education in Kuwait',
    titleAr: 'استقصاء دور أنظمة إدارة التعلم الإلكتروني في عملية التعلم من وجهة نظر أعضاء هيئة التدريس في كلية التربية الأساسية في دولة الكويت',
    meta: 'Learning Management Systems · Faculty',
    abstractAr: 'هدفت الدراسة إلى استقصاء دور أنظمة إدارة التعلم الإلكتروني في عملية التعلم من وجهة نظر أعضاء هيئة التدريس في كلية التربية الأساسية في دولة الكويت. تبنت الدراسة المنهج الوصفي المسحي، وأُعدت أداة الدراسة واستُخرج صدقها وثباتها. تكونت عينة الدراسة من (278) عضواً من أعضاء هيئة التدريس في كلية التربية الأساسية اختيروا بطريقة عشوائية. أظهرت نتائج الدراسة رضا أعضاء هيئة التدريس عن دور أنظمة إدارة التعلم، وأن استخدامها يؤدي دوراً كبيراً في عملية التعلم؛ إذ تراوحت المتوسطات الحسابية بين (3.82–4.02)، وبلغ المتوسط الحسابي للدرجة الكلية ككل (3.90). وأظهرت النتائج أن أنظمة إدارة التعلم الإلكتروني تؤدي أدواراً فاعلة في عملية التعلم من وجهة نظر أعضاء هيئة التدريس في كلية التربية الأساسية.',
    journal: 'Journal of Positive School Psychology · Vol. 6, No. 12 · 2022 · pp. 1445–1467',
    source: 'https://journalppw.com/index.php/jpsp/article/view/14948',
    pdf: 'https://journalppw.com/index.php/jpsp/article/download/14948/9680',
    url: '/research/investigating-the-role-of-e-learning-management-systems-in-the-learning-process-from-the-point-of-view-of-the-faculty-at-the-faculty-of-basic-education-in-kuwait-2',
    verification: 'verified',
  },
  {
    slug: 'the-impact-of-the-working-environment-and-learning-science-in-the-electronic-learning-systems-used-in-education-2',
    title: 'The Impact of The Working Environment and Learning Science in The Electronic Learning Systems Used in Education',
    titleAr: 'أثر بيئة العمل وعلوم التعلم في أنظمة التعلم الإلكتروني المستخدمة في التعليم',
    meta: 'Working Environment · Learning Science',
    abstractAr: 'هدفت الدراسة الحالية إلى تقصي أثر بيئة العمل وعلوم التعلم في أنظمة التعلم الإلكتروني المستخدمة في التعليم من وجهة نظر أعضاء هيئة التدريس في كلية التربية الأساسية في دولة الكويت. أعدّ الباحث استبانة للكشف عن دور أنظمة إدارة التعلم الإلكتروني في التعليم من وجهة نظر أعضاء هيئة التدريس، وطُبقت على عينة الدراسة المكونة من (288) عضواً من أعضاء هيئة التدريس في كلية التربية الأساسية. أظهرت النتائج أن أثر بيئة العمل وعلوم التعلم في التعليم الإلكتروني جاء مرتفعاً؛ إذ تراوحت المتوسطات الحسابية بين (3.93–4.22) بدرجة مرتفعة، وبلغ المتوسط الحسابي للأداة ككل (4.03) بدرجة مرتفعة وبنسبة (80.6%).',
    journal: 'Journal of Positive School Psychology · Vol. 6, No. 12 · 2022 · pp. 1423–1444',
    source: 'https://journalppw.com/index.php/jpsp/article/view/14947',
    pdf: 'https://journalppw.com/index.php/jpsp/article/download/14947/9679/18232',
    researchgate: 'https://www.researchgate.net/publication/366678764_The_Impact_Of_The_Working_Environment_And_Learning_Science_In_The_Electronic_Learning_Systems_Used_In_Education_From_The_Point_Of_View_Of_The_Faculty_At_The_Faculty_Of_Basic_Education_In_Kuwait',
    url: '/research/the-impact-of-the-working-environment-and-learning-science-in-the-electronic-learning-systems-used-in-education-2',
    verification: 'verified',
  },
  {
    slug: 'perceptions-of-university-students-at-the-college-of-basic-education-toward-implementing-moodle-in-managing-e-courses-to-enhance-learning-in-kuwait-2',
    title: 'Perceptions of University Students at the College of Basic Education Toward Implementing Moodle in Managing E-Courses to Enhance Learning in Kuwait',
    titleAr: 'تصورات طلبة الجامعة في كلية التربية الأساسية نحو تطبيق نظام مودل في إدارة المقررات الإلكترونية لتعزيز التعلم في دولة الكويت',
    meta: 'Moodle · E-Courses',
    abstractAr: 'هدفت الدراسة إلى استقصاء تصورات طلبة الجامعة في كلية التربية الأساسية نحو تطبيق نظام مودل (Moodle) في إدارة المقررات الإلكترونية لتعزيز التعلم في دولة الكويت. استخدم الباحثان المنهج الوصفي التحليلي، وأعدّا استبانة لقياس تصورات الطلبة نحو استخدام نظام مودل في إدارة المقررات الإلكترونية، وقُسمت أداة الدراسة إلى مجالين: فوائد نظام مودل، وأهمية استخدام نظام مودل، وتم التحقق من صدق الأداة وثباتها. تكونت عينة الدراسة من (397) طالباً وطالبة من طلبة البكالوريوس في كلية التربية الأساسية بالهيئة العامة للتعليم التطبيقي والتدريب في دولة الكويت. كشفت النتائج أن تصورات الطلبة نحو استخدام نظام مودل في إدارة المقررات الإلكترونية الجامعية جاءت بمستوى متوسط. كما أظهرت النتائج عدم وجود فروق ذات دلالة إحصائية تعزى إلى الجنس في جميع المجالات والدرجة الكلية، بينما وُجدت فروق ذات دلالة إحصائية تعزى إلى أثر المستوى الأكاديمي في جميع المجالات جاءت لصالح طلبة السنتين الأولى والثانية في المجالات كافة والدرجة الكلية.',
    journal: 'Educational Sciences Journal، Cairo University · Vol. 32, No. 1 · 2024',
    source: 'https://ssj.journals.ekb.eg/article_411443.html',
    researchgate: 'https://www.researchgate.net/publication/389049590_Perceptions_of_University_Students_at_the_College_of_Basic_Education_Toward_Implementing_Moodle_in_Managing_E-Courses_to_Enhance_Learning_in_Kuwait',
    coAuthors: coAuthor,
    doi: '10.21608/ssj.2024.411443',
    pdf: '/files/research/12-moodle-perceptions.pdf',
    url: '/research/perceptions-of-university-students-at-the-college-of-basic-education-toward-implementing-moodle-in-managing-e-courses-to-enhance-learning-in-kuwait-2',
    verification: 'verified',
  },
  {
    slug: 'university-students-perceptions-at-the-college-of-basic-education-regarding-the-use-of-interactive-blackboard-technology-in-education-in-kuwait-for-the-academic-year-2020-2021-2',
    title: "University Students' Perceptions at the College of Basic Education Regarding the Use of Interactive Blackboard Technology in Education in Kuwait for the Academic Year 2020/2021",
    titleAr: 'تصورات طلبة الجامعة في كلية التربية الأساسية نحو استخدام تقنية السبورة التفاعلية في التعليم في دولة الكويت للعام الجامعي 2020/2021',
    meta: 'Interactive Blackboard · Student Perceptions',
    abstractAr: 'هدفت الدراسة إلى استكشاف تصورات طلبة كلية التربية الأساسية تجاه استخدام تقنية السبورة التفاعلية في التعليم في الكويت خلال العام الأكاديمي 2020/2021. استخدم الباحثان المنهج الوصفي المسحي، وأعدا استبانة مكونة من 32 فقرة، وطبقت على عينة عشوائية من 393 طالباً وطالبة. أظهرت النتائج أن تصورات الطلبة جاءت إيجابية ومرتفعة، وتراوحت المتوسطات بين 2.95 و4.17. كما لم تظهر فروق ذات دلالة إحصائية تعزى إلى الجنس. وتشير النتائج إلى قبول الطلبة لهذه التقنية وإدراكهم لدورها في دعم التفاعل، وعرض المحتوى، وتيسير الفهم داخل الموقف التعليمي.',
    journal: 'Educational Sciences Journal، Cairo University · Vol. 32, No. 1, Part 4 · 2024 · pp. 1–24',
    source: 'https://ssj.journals.ekb.eg/article_411445.html',
    pdf: 'https://ssj.journals.ekb.eg/article_411445_f990b6995321ac1b4e15cbd745d3179d.pdf',
    researchgate: 'https://www.researchgate.net/publication/389049317_University_Students%27_Perceptions_at_the_College_of_Basic_Education_Regarding_the_Use_of_Interactive_Blackboard_Technology_in_Education_in_Kuwait_for_the_Academic_Year_20202021',
    coAuthors: coAuthor,
    doi: '10.21608/ssj.2024.411445',
    url: '/research/university-students-perceptions-at-the-college-of-basic-education-regarding-the-use-of-interactive-blackboard-technology-in-education-in-kuwait-for-the-academic-year-2020-2021-2',
    verification: 'verified',
  },
  {
    slug: 'the-role-of-technological-creative-photography-in-contemporary-education-frameworks-in-developing-the-knowledge-skills-and-abilities-of-university-professors-at-the-college-of-basic-education-in-kuw-2',
    title: 'The Role of Technological Creative Photography in Contemporary Education Frameworks in Developing the Knowledge, Skills, and Abilities of University Professors at the College of Basic Education in Kuwait',
    titleAr: 'دور التصوير الإبداعي التكنولوجي في أطر التعليم المعاصر في تنمية معارف ومهارات وقدرات أساتذة الجامعة في كلية التربية الأساسية في دولة الكويت',
    meta: 'Technological Creative Photography · Faculty Development',
    abstractAr: 'هدفت الدراسة إلى تقصي دور التصوير الإبداعي التكنولوجي في أطر التعليم المعاصر لتنمية معارف ومهارات وقدرات أساتذة كلية التربية الأساسية في الكويت. استخدم الباحثان المنهج الوصفي التحليلي المسحي، وطبقا أداة الدراسة على عينة عشوائية من 27 أستاذاً جامعياً. تناولت الدراسة إسهام التصوير في تطوير طرائق التدريس، وإنتاج المواد التعليمية، وتحسين التواصل البصري والتفاعل مع الطلبة. أظهرت النتائج إسهاماً ملحوظاً للتصوير الإبداعي في تحسين الممارسات التعليمية وتفاعل الطلبة، وعدم وجود فروق ذات دلالة إحصائية تعزى إلى الجنس.',
    journal: 'Educational Sciences Journal، Cairo University · Vol. 32, No. 2 · 2024 · pp. 1–23',
    source: 'https://journals.ekb.eg/article_411444_0.html',
    pdf: 'https://journals.ekb.eg/article_411444_16026997bf08c05e5002f61a4790e377.pdf',
    researchgate: 'https://www.researchgate.net/publication/389049782_The_Role_of_Technological_Creative_Photography_in_Contemporary_Education_Frameworks_in_Developing_the_Knowledge_Skills_and_Abilities_of_University_Professors_at_the_College_of_Basic_Education_in_Kuwai',
    coAuthors: coAuthor,
    doi: '10.21608/ssj.2024.411444',
    url: '/research/the-role-of-technological-creative-photography-in-contemporary-education-frameworks-in-developing-the-knowledge-skills-and-abilities-of-university-professors-at-the-college-of-basic-education-in-kuw-2',
    verification: 'verified',
  },
  {
    slug: 'the-importance-of-adopting-learning-management-systems-lms-to-enhance-the-quality-of-teaching-among-university-professors-in-kuwait-2',
    title: 'The Importance of Adopting Learning Management Systems (LMS) to Enhance the Quality of Teaching Among University Professors in Kuwait',
    titleAr: 'أهمية تبني أنظمة إدارة التعلم في تعزيز جودة التدريس لدى أساتذة الجامعات في دولة الكويت',
    meta: 'LMS · Teaching Quality',
    abstractAr: 'هدفت الدراسة إلى الكشف عن أهمية تبني أنظمة إدارة التعلم في تعزيز جودة التدريس لدى أساتذة الجامعات في الكويت. استخدم الباحث المنهج الوصفي المسحي، وأعد استبانة تناولت دور أنظمة إدارة التعلم في تنظيم المقررات والمحتوى، وإدارة التفاعل والأنشطة، وتقديم التغذية الراجعة، والتقويم، وتيسير الوصول إلى الموارد. أظهرت النتائج تقديراً مرتفعاً لأهمية هذه الأنظمة في تحسين جودة التدريس ودعم المرونة والمتابعة، مع التأكيد على أن نجاحها يرتبط بالتدريب، وجودة التصميم، والدعم الفني، والسياسات المؤسسية التي تضمن استدامة الاستخدام.',
    journal: 'Educational Sciences Journal، Cairo University · Vol. 32 · 2024 · pp. 105–130',
    source: 'https://journals.ekb.eg/article_411446_0.html',
    pdf: 'https://journals.ekb.eg/article_411446_ee903201c686a3a98e0094332263b612.pdf',
    researchgate: 'https://www.researchgate.net/publication/389049595_The_Importance_of_Adopting_Learning_Management_Systems_LMS_to_Enhance_the_Quality_of_Teaching_Among_University_Professors_in_Kuwait',
    coAuthors: coAuthor,
    doi: '10.21608/ssj.2024.411446',
    url: '/research/the-importance-of-adopting-learning-management-systems-lms-to-enhance-the-quality-of-teaching-among-university-professors-in-kuwait-2',
    verification: 'verified',
  },
  {
    slug: 'trends-of-college-of-basic-education-students-towards-the-use-of-photography-to-develop-learning-skills-in-kuwait-2',
    title: 'Trends of College of Basic Education students towards the use of photography to develop learning skills in Kuwait',
    titleAr: 'اتجاهات طلبة كلية التربية الأساسية نحو استخدام التصوير لتنمية مهارات التعلم في دولة الكويت',
    meta: 'Photography · Learning Skills',
    abstractAr: 'هدفت الدراسة إلى الكشف عن اتجاهات طلبة كلية التربية الأساسية نحو استخدام التصوير لتنمية مهارات التعلم في دولة الكويت. استخدم الباحثان المنهج الوصفي المسحي، وتكونت عينة الدراسة من (398) طالباً وطالبة اختيروا بطريقة عشوائية من طلبة البكالوريوس؛ منهم (155) طالباً و(243) طالبة في كلية التربية الأساسية بالهيئة العامة للتعليم التطبيقي والتدريب. أعدّ الباحثان استبانة لقياس اتجاهات الطلبة تكونت من (35) فقرة. أظهرت النتائج أن اتجاهات الطلبة نحو استخدام التصوير لتنمية مهارات التعلم جاءت مرتفعة؛ إذ تراوحت المتوسطات الحسابية بين (3.73–4.01)، وجاءت الدرجة الكلية بمتوسط حسابي (3.85) بدرجة مرتفعة. كما أظهرت النتائج عدم وجود فروق ذات دلالة إحصائية (α=0.05) تعزى إلى أثر الجنس.',
    journal: 'Educational Sciences Journal، Cairo University · 2024',
    source: 'https://ssj.journals.ekb.eg/article_402114.html',
    coAuthors: coAuthor,
    doi: '10.21608/ssj.2024.402114',
    pdf: '/files/research/16-photography-learning-skills.pdf',
    url: '/research/trends-of-college-of-basic-education-students-towards-the-use-of-photography-to-develop-learning-skills-in-kuwait-2',
    verification: 'verified',
  },
  {
    slug: 'the-reality-of-using-smart-device-applications-in-learning-applications-by-university-students-at-the-college-of-basic-education-in-kuwait-2',
    title: 'The Reality of Using Smart Device Applications in Learning Applications by University Students at the College of Basic Education in Kuwait',
    titleAr: 'واقع استخدام طلبة الجامعة في كلية التربية الأساسية لتطبيقات الأجهزة الذكية في التعلم في دولة الكويت',
    meta: 'Smart Device Applications · University Learning',
    abstractAr: 'هدفت الدراسة إلى الكشف عن واقع استخدام طلبة الجامعة في كلية التربية الأساسية بالكويت لتطبيقات الأجهزة الذكية في التعلم، وقياس أثر الجنس ومعدل الاستخدام. استخدم الباحثان المنهج الوصفي المسحي، وأعدا أداة مكونة من 35 فقرة، وطبقت على عينة عشوائية من 385 طالباً وطالبة خلال الفصل الدراسي الثاني 2020/2021. أظهرت النتائج أن محوري الاستخدام والأهمية جاءا بدرجة متوسطة، ولم تظهر فروق ذات دلالة إحصائية تعزى إلى الجنس أو معدل الاستخدام. وتوضح النتائج أن شيوع الأجهزة الذكية لا يعني بالضرورة توظيفها التعليمي العميق دون تصميم وتوجيه مناسبين.',
    journal: 'Educational Sciences Journal، Cairo University · Vol. 32, No. 4, Part 2 · 2024 · pp. 161–197',
    source: 'https://journals.ekb.eg/article_399430.html',
    pdf: 'https://journals.ekb.eg/article_399430_6970635396e6ddd2494ffc01fd4913c3.pdf',
    researchgate: 'https://www.researchgate.net/publication/387433852_The_Reality_of_Using_Smart_Device_Applications_in_Learning_Applications_by_University_Students_at_the_College_of_Basic_Education_in_Kuwait',
    coAuthors: coAuthor,
    doi: '10.21608/ssj.2024.399430',
    url: '/research/the-reality-of-using-smart-device-applications-in-learning-applications-by-university-students-at-the-college-of-basic-education-in-kuwait-2',
    verification: 'verified',
  },
]
