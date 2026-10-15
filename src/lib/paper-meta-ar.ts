// عرضٌ فقط: سطر الموضوع تحت عنوان البحث يُكتب في الواجهة العربية بالعربية.
// البيانات الأصلية (src/data/research-papers.ts) لا تُمسّ، والنسخة الإنجليزية تقرؤها كما هي.
const TERMS: Record<string, string> = {
  'augmented reality': 'الواقع المعزّز',
  'faculty awareness': 'وعي أعضاء هيئة التدريس',
  'education technology': 'تكنولوجيا التعليم',
  'special needs': 'ذوو الاحتياجات الخاصة',
  'e-learning qualifications': 'مؤهلات التعلّم الإلكتروني',
  'faculty': 'أعضاء هيئة التدريس',
  'cloud computing': 'الحوسبة السحابية',
  'university education': 'التعليم الجامعي',
  'e-learning management systems': 'أنظمة إدارة التعلّم الإلكتروني',
  'smart university': 'الجامعة الذكية',
  'learning management systems': 'أنظمة إدارة التعلّم',
  'working environment': 'بيئة العمل',
  'learning science': 'علم التعلّم',
  'moodle': 'منصة مودل',
  'e-courses': 'المقررات الإلكترونية',
  'interactive blackboard': 'السبورة التفاعلية',
  'student perceptions': 'تصوّرات الطلبة',
  'technological creative photography': 'التصوير الإبداعي التكنولوجي',
  'faculty development': 'التطوير المهني لأعضاء هيئة التدريس',
  'lms': 'أنظمة إدارة التعلّم',
  'teaching quality': 'جودة التدريس',
  'photography': 'التصوير',
  'learning skills': 'مهارات التعلّم',
  'smart device applications': 'تطبيقات الأجهزة الذكية',
  'university learning': 'التعلّم الجامعي',
}

export function paperMetaAr(meta?: string): string {
  if (!meta) return ''
  if (!/[A-Za-z]/.test(meta)) return meta
  return meta
    .split('·')
    .map((part) => {
      const key = part.trim().toLowerCase()
      return TERMS[key] || part.trim()
    })
    .join(' · ')
}
