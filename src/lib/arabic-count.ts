export type ArabicCountForms = {
  zero?: string
  one: string
  two: string
  few: string
  many: string
}

function normalizedMod100(count: number) {
  const value = Math.abs(Math.trunc(count))
  return value % 100
}

export function arabicCountLabel(count: number, forms: ArabicCountForms) {
  const mod100 = normalizedMod100(count)
  const absolute = Math.abs(Math.trunc(count))
  if (count === 0 && forms.zero) return forms.zero
  if (absolute === 1) return forms.one
  if (absolute === 2) return forms.two
  if (mod100 >= 3 && mod100 <= 10) return forms.few
  return forms.many
}

export function arabicCountPhrase(count: number, forms: ArabicCountForms, formatNumber: (value: number) => string = (value) => String(value)) {
  if (count === 0 && forms.zero) return forms.zero
  if (Math.abs(count) === 1 || Math.abs(count) === 2) return arabicCountLabel(count, forms)
  return `${formatNumber(count)} ${arabicCountLabel(count, forms)}`.trim()
}

export const ARTICLE_FORMS: ArabicCountForms = {
  one: 'مقالة فكرية',
  two: 'مقالتان فكريتان',
  few: 'مقالات فكرية',
  many: 'مقالاً فكرياً',
}

export const PAPER_FORMS: ArabicCountForms = {
  one: 'بحث محكَّم',
  two: 'بحثان محكَّمان',
  few: 'أبحاث محكَّمة',
  many: 'بحثاً محكَّماً',
}

export const BOOK_FORMS: ArabicCountForms = {
  one: 'كتاب منشور',
  two: 'كتابان منشوران',
  few: 'كتب منشورة',
  many: 'كتاباً منشوراً',
}

export const AUDIO_EPISODE_FORMS: ArabicCountForms = {
  one: 'حلقة مسموعة',
  two: 'حلقتان مسموعتان',
  few: 'حلقات مسموعة',
  many: 'حلقة مسموعة',
}

export const AUDIO_HOUR_FORMS: ArabicCountForms = {
  one: 'ساعة استماع',
  two: 'ساعتا استماع',
  few: 'ساعات استماع',
  many: 'ساعة استماع',
}

export const YEAR_IMPACT_FORMS: ArabicCountForms = {
  one: 'سنة من الأثر',
  two: 'سنتان من الأثر',
  few: 'سنوات من الأثر',
  many: 'سنة من الأثر',
}

export const CATEGORY_FORMS: ArabicCountForms = {
  one: 'باب معرفي',
  two: 'بابان معرفيان',
  few: 'أبواب معرفية',
  many: 'باباً معرفياً',
}

export const WORD_FORMS: ArabicCountForms = {
  one: 'كلمة منشورة',
  two: 'كلمتان منشورتان',
  few: 'كلمات منشورة',
  many: 'كلمة منشورة',
}

export const ARTICLE_PLAIN_FORMS: ArabicCountForms = {
  one: 'مقال',
  two: 'مقالان',
  few: 'مقالات',
  many: 'مقالاً',
}

export const BOOK_PLAIN_FORMS: ArabicCountForms = {
  one: 'كتاب',
  two: 'كتابان',
  few: 'كتب',
  many: 'كتاباً',
}

export const MEDIA_FORMS: ArabicCountForms = {
  one: 'لقاء',
  two: 'لقاءان',
  few: 'لقاءات',
  many: 'لقاءً',
}

export const RESULT_FORMS: ArabicCountForms = {
  one: 'نتيجة',
  two: 'نتيجتان',
  few: 'نتائج',
  many: 'نتيجة',
}

export const JOURNEY_FORMS: ArabicCountForms = {
  one: 'رحلة',
  two: 'رحلتان',
  few: 'رحلات',
  many: 'رحلة',
}

export const STATION_FORMS: ArabicCountForms = {
  one: 'محطة',
  two: 'محطتان',
  few: 'محطات',
  many: 'محطة',
}

export const MINUTE_FORMS: ArabicCountForms = {
  one: 'دقيقة',
  two: 'دقيقتان',
  few: 'دقائق',
  many: 'دقيقة',
}

export const HOUR_FORMS: ArabicCountForms = {
  one: 'ساعة',
  two: 'ساعتان',
  few: 'ساعات',
  many: 'ساعة',
}

export const SECOND_FORMS: ArabicCountForms = {
  one: 'ثانية',
  two: 'ثانيتان',
  few: 'ثوانٍ',
  many: 'ثانية',
}

export const SOURCE_FORMS: ArabicCountForms = {
  one: 'مصدر إضافي',
  two: 'مصدران إضافيان',
  few: 'مصادر إضافية',
  many: 'مصدراً إضافياً',
}

export const CONCEPT_FORMS: ArabicCountForms = {
  one: 'محور',
  two: 'محوران',
  few: 'محاور',
  many: 'محوراً',
}

export const PAGE_FORMS: ArabicCountForms = {
  one: 'صفحة',
  two: 'صفحتان',
  few: 'صفحات',
  many: 'صفحة',
}

export const PASSAGE_FORMS: ArabicCountForms = {
  one: 'مقطع',
  two: 'مقطعان',
  few: 'مقاطع',
  many: 'مقطعاً',
}

export const AUDIO_TRIAL_FORMS: ArabicCountForms = {
  one: 'تجربة صوتية',
  two: 'تجربتان صوتيتان',
  few: 'تجارب صوتية',
  many: 'تجربة صوتية',
}

export const MATERIAL_FORMS: ArabicCountForms = {
  one: 'مادة',
  two: 'مادتان',
  few: 'مواد',
  many: 'مادة',
}

export const POINT_FORMS: ArabicCountForms = {
  one: 'نقطة',
  two: 'نقطتان',
  few: 'نقاط',
  many: 'نقطة',
}

export const DECISION_FORMS: ArabicCountForms = {
  one: 'قرار',
  two: 'قراران',
  few: 'قرارات',
  many: 'قراراً',
}

export const WARNING_FORMS: ArabicCountForms = {
  one: 'تنبيه',
  two: 'تنبيهان',
  few: 'تنبيهات',
  many: 'تنبيهاً',
}

export const INTERVENTION_FORMS: ArabicCountForms = {
  one: 'مداخلة',
  two: 'مداخلتان',
  few: 'مداخلات',
  many: 'مداخلة',
}

export const TWEET_FORMS: ArabicCountForms = {
  one: 'تغريدة',
  two: 'تغريدتان',
  few: 'تغريدات',
  many: 'تغريدة',
}

export const READER_FORMS: ArabicCountForms = {
  one: 'قارئ',
  two: 'قارئان',
  few: 'قراء',
  many: 'قارئاً',
}

export const PROJECT_FORMS: ArabicCountForms = {
  one: 'مشروع',
  two: 'مشروعان',
  few: 'مشاريع',
  many: 'مشروعاً',
}

export const LINK_FORMS: ArabicCountForms = {
  one: 'رابط',
  two: 'رابطان',
  few: 'روابط',
  many: 'رابطاً',
}

export const ITEM_FORMS: ArabicCountForms = {
  one: 'عنصر',
  two: 'عنصران',
  few: 'عناصر',
  many: 'عنصراً',
}

export const SIGNAL_FORMS: ArabicCountForms = {
  one: 'إشارة',
  two: 'إشارتان',
  few: 'إشارات',
  many: 'إشارة',
}

export const CHAPTER_FORMS: ArabicCountForms = {
  one: 'فصل',
  two: 'فصلان',
  few: 'فصول',
  many: 'فصلاً',
}

export const TEXT_FORMS: ArabicCountForms = {
  one: 'نص',
  two: 'نصان',
  few: 'نصوص',
  many: 'نصاً',
}

export const DAY_FORMS: ArabicCountForms = {
  one: 'يوم',
  two: 'يومان',
  few: 'أيام',
  many: 'يوماً',
}

export const NEW_ARTICLE_FORMS: ArabicCountForms = {
  one: 'مقال جديد',
  two: 'مقالان جديدان',
  few: 'مقالات جديدة',
  many: 'مقالاً جديداً',
}

export const DAY_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'يوم',
  two: 'يومين',
  few: 'أيام',
  many: 'يوماً',
}

export const MINUTE_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'دقيقة',
  two: 'دقيقتين',
  few: 'دقائق',
  many: 'دقيقة',
}

export const SOURCE_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'مصدر إضافي',
  two: 'مصدرين إضافيين',
  few: 'مصادر إضافية',
  many: 'مصدراً إضافياً',
}

export const PAGE_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'صفحة',
  two: 'صفحتين',
  few: 'صفحات',
  many: 'صفحة',
}

export const EVIDENCE_FORMS: ArabicCountForms = {
  one: 'شاهد موثَّق',
  two: 'شاهدان موثَّقان',
  few: 'شواهد موثَّقة',
  many: 'شاهداً موثَّقاً',
}

export const MATERIAL_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'مادة',
  two: 'مادتين',
  few: 'مواد',
  many: 'مادة',
}

export const POINT_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'نقطة',
  two: 'نقطتين',
  few: 'نقاط',
  many: 'نقطة',
}

export const PASSAGE_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'مقطع ناطق',
  two: 'مقطعين ناطقين',
  few: 'مقاطع ناطقة',
  many: 'مقطعاً ناطقاً',
}

export const RESULT_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'نتيجة منشورة سابقة',
  two: 'نتيجتين منشورتين سابقتين',
  few: 'نتائج منشورة سابقة',
  many: 'نتيجة منشورة سابقة',
}

export const DAMAGED_LINK_FORMS: ArabicCountForms = {
  one: 'رابط تالف مؤكَّد',
  two: 'رابطان تالفان مؤكَّدان',
  few: 'روابط تالفة مؤكَّدة',
  many: 'رابطاً تالفاً مؤكَّداً',
}

export const IMAGE_FORMS: ArabicCountForms = {
  one: 'صورة',
  two: 'صورتان',
  few: 'صور',
  many: 'صورة',
}

export const SAVED_COPY_FORMS: ArabicCountForms = {
  one: 'نسخة محفوظة محلياً',
  two: 'نسختان محفوظتان محلياً',
  few: 'نسخ محفوظة محلياً',
  many: 'نسخة محفوظة محلياً',
}

export const SCENE_FORMS: ArabicCountForms = {
  one: 'مشهد مولَّد مستقل',
  two: 'مشهدان مولَّدان مستقلان',
  few: 'مشاهد مولَّدة مستقلة',
  many: 'مشهداً مولَّداً مستقلاً',
}

export const ENDING_FORMS: ArabicCountForms = {
  one: 'نهاية عالمية',
  two: 'نهايتان عالميتان',
  few: 'نهايات عالمية',
  many: 'نهاية عالمية',
}

export const COVER_FORMS: ArabicCountForms = {
  one: 'غلاف يحتاج مراجعة',
  two: 'غلافان يحتاجان مراجعة',
  few: 'أغلفة تحتاج مراجعة',
  many: 'غلافاً يحتاج مراجعة',
}

export const CLAIM_FORMS: ArabicCountForms = {
  one: 'ادعاء مفحوص',
  two: 'ادعاءان مفحوصان',
  few: 'ادعاءات مفحوصة',
  many: 'ادعاءً مفحوصاً',
}

export const OPPORTUNITY_FORMS: ArabicCountForms = {
  one: 'فرصة أرشيف اجتازت عتبة الثقة',
  two: 'فرصتا أرشيف اجتازتا عتبة الثقة',
  few: 'فرص أرشيف اجتازت عتبة الثقة',
  many: 'فرصة أرشيف اجتازت عتبة الثقة',
}

export const EVENT_FORMS: ArabicCountForms = {
  one: 'حدث مثبت',
  two: 'حدثان مثبتان',
  few: 'أحداث مثبتة',
  many: 'حدثاً مثبتاً',
}

export const DIRECTION_FORMS: ArabicCountForms = {
  one: 'اتجاه اجتاز بوابة المصمم',
  two: 'اتجاهان اجتازا بوابة المصمم',
  few: 'اتجاهات اجتازت بوابة المصمم',
  many: 'اتجاهاً اجتاز بوابة المصمم',
}

export const SENTENCE_FORMS: ArabicCountForms = {
  one: 'جملة',
  two: 'جملتان',
  few: 'جمل',
  many: 'جملة',
}

export const MESSAGE_FORMS: ArabicCountForms = {
  one: 'رسالة معلَّقة',
  two: 'رسالتان معلَّقتان',
  few: 'رسائل معلَّقة',
  many: 'رسالة معلَّقة',
}

export const CAMPAIGN_FORMS: ArabicCountForms = {
  one: 'حملة',
  two: 'حملتان',
  few: 'حملات',
  many: 'حملة',
}

export const TERM_FORMS: ArabicCountForms = {
  one: 'لفظ',
  two: 'لفظان',
  few: 'ألفاظ',
  many: 'لفظاً',
}

export const SOURCE_NEAR_FORMS: ArabicCountForms = {
  one: 'مصدر قريب من الفكرة الحالية',
  two: 'مصدران قريبان من الفكرة الحالية',
  few: 'مصادر قريبة من الفكرة الحالية',
  many: 'مصدراً قريباً من الفكرة الحالية',
}

export const ARTICLE_WITH_AUDIO_FORMS: ArabicCountForms = {
  one: 'مقال لديه صوت',
  two: 'مقالان لديهما صوت',
  few: 'مقالات لديها صوت',
  many: 'مقالاً لديه صوت',
}

export const ARCHIVAL_MATERIAL_FORMS: ArabicCountForms = {
  one: 'مادة أرشيفية',
  two: 'مادتان أرشيفيتان',
  few: 'مواد أرشيفية',
  many: 'مادة أرشيفية',
}

export const RELEVANT_LINK_FORMS: ArabicCountForms = {
  one: 'رابط راهن ذو صلة',
  two: 'رابطان راهنان ذوا صلة',
  few: 'روابط راهنة ذات صلة',
  many: 'رابطاً راهناً ذا صلة',
}

export const RELATED_SIGNAL_FORMS: ArabicCountForms = {
  one: 'إشارة مرتبطة',
  two: 'إشارتان مرتبطتان',
  few: 'إشارات مرتبطة',
  many: 'إشارة مرتبطة',
}

export const RELATED_ARCHIVAL_MATERIAL_FORMS: ArabicCountForms = {
  one: 'مادة أرشيفية مرتبطة',
  two: 'مادتان أرشيفيتان مرتبطتان',
  few: 'مواد أرشيفية مرتبطة',
  many: 'مادة أرشيفية مرتبطة',
}

export const RELATED_MATERIAL_FORMS: ArabicCountForms = {
  one: 'مادة مرتبطة',
  two: 'مادتان مرتبطتان',
  few: 'مواد مرتبطة',
  many: 'مادة مرتبطة',
}

export const RELATED_MATERIAL_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'مادة مرتبطة',
  two: 'مادتين مرتبطتين',
  few: 'مواد مرتبطة',
  many: 'مادة مرتبطة',
}

export const PUBLISHED_PROJECT_FORMS: ArabicCountForms = {
  one: 'مشروع منشور',
  two: 'مشروعان منشوران',
  few: 'مشاريع منشورة',
  many: 'مشروعاً منشوراً',
}

export const YEAR_FORMS: ArabicCountForms = {
  one: 'سنة',
  two: 'سنتان',
  few: 'سنوات',
  many: 'سنة',
}

export const YEAR_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'سنة',
  two: 'سنتين',
  few: 'سنوات',
  many: 'سنة',
}

export const TITLE_FORMS: ArabicCountForms = {
  one: 'عنوان',
  two: 'عنوانان',
  few: 'عناوين',
  many: 'عنواناً',
}

export const DIMENSION_FORMS: ArabicCountForms = {
  one: 'بُعد مستخرج',
  two: 'بُعدان مستخرجان',
  few: 'أبعاد مستخرجة',
  many: 'بُعداً مستخرجاً',
}

export const PROOF_FORMS: ArabicCountForms = {
  one: 'دليل موثَّق',
  two: 'دليلان موثَّقان',
  few: 'أدلة موثَّقة',
  many: 'دليلاً موثَّقاً',
}

export const VIEW_FORMS: ArabicCountForms = {
  one: 'مشاهدة',
  two: 'مشاهدتان',
  few: 'مشاهدات',
  many: 'مشاهدة',
}

export const SHARE_FORMS: ArabicCountForms = {
  one: 'مشاركة',
  two: 'مشاركتان',
  few: 'مشاركات',
  many: 'مشاركة',
}

export const CONNECTION_FORMS: ArabicCountForms = {
  one: 'صلة مشتركة',
  two: 'صلتان مشتركتان',
  few: 'صلات مشتركة',
  many: 'صلة مشتركة',
}

export const TOPICAL_CONNECTION_FORMS: ArabicCountForms = {
  one: 'صلة موضوعية مشتركة',
  two: 'صلتان موضوعيتان مشتركتان',
  few: 'صلات موضوعية مشتركة',
  many: 'صلة موضوعية مشتركة',
}

export const WORD_PLAIN_FORMS: ArabicCountForms = {
  one: 'كلمة',
  two: 'كلمتان',
  few: 'كلمات',
  many: 'كلمة',
}

export const PREDICTION_FORMS: ArabicCountForms = {
  one: 'توقّع تحت المراجعة',
  two: 'توقّعان تحت المراجعة',
  few: 'توقّعات تحت المراجعة',
  many: 'توقّعاً تحت المراجعة',
}

export const SUBSCRIBER_FORMS: ArabicCountForms = {
  one: 'مشترك',
  two: 'مشتركان',
  few: 'مشتركون',
  many: 'مشتركاً',
}

export const MESSAGE_PLAIN_FORMS: ArabicCountForms = {
  one: 'رسالة',
  two: 'رسالتان',
  few: 'رسائل',
  many: 'رسالة',
}

export const SOURCE_PLAIN_FORMS: ArabicCountForms = {
  one: 'مصدر',
  two: 'مصدران',
  few: 'مصادر',
  many: 'مصدراً',
}

export const DIRECTION_PLAIN_FORMS: ArabicCountForms = {
  one: 'اتجاه',
  two: 'اتجاهان',
  few: 'اتجاهات',
  many: 'اتجاهاً',
}

export const OCCURRENCE_FORMS: ArabicCountForms = {
  one: 'مرة',
  two: 'مرتين',
  few: 'مرات',
  many: 'مرة',
}

export const ENTITY_FORMS: ArabicCountForms = {
  one: 'جهة',
  two: 'جهتان',
  few: 'جهات',
  many: 'جهة',
}

export const PATH_FORMS: ArabicCountForms = {
  one: 'مسار',
  two: 'مساران',
  few: 'مسارات',
  many: 'مساراً',
}

export const PAPER_PLAIN_FORMS: ArabicCountForms = {
  one: 'بحث',
  two: 'بحثان',
  few: 'أبحاث',
  many: 'بحثاً',
}

export const SAVED_SOURCE_FORMS: ArabicCountForms = {
  one: 'مصدر محفوظ',
  two: 'مصدران محفوظان',
  few: 'مصادر محفوظة',
  many: 'مصدراً محفوظاً',
}

export const SUSPICIOUS_SOURCE_FORMS: ArabicCountForms = {
  one: 'مصدر مشكوك فيه',
  two: 'مصدران مشكوك فيهما',
  few: 'مصادر مشكوك فيها',
  many: 'مصدراً مشكوكاً فيه',
}

export const SCHEDULED_ARTICLE_FORMS: ArabicCountForms = {
  one: 'مقال مجدول للمراجعة',
  two: 'مقالان مجدولان للمراجعة',
  few: 'مقالات مجدولة للمراجعة',
  many: 'مقالاً مجدولاً للمراجعة',
}

export const INTERNAL_MATERIAL_FORMS: ArabicCountForms = {
  one: 'مادة داخلية',
  two: 'مادتان داخليتان',
  few: 'مواد داخلية',
  many: 'مادة داخلية',
}

export const VERIFIED_MATERIAL_FORMS: ArabicCountForms = {
  one: 'مادة موثَّقة',
  two: 'مادتان موثَّقتان',
  few: 'مواد موثَّقة',
  many: 'مادة موثَّقة',
}

export const NEAR_MATERIAL_FORMS: ArabicCountForms = {
  one: 'مادة قريبة',
  two: 'مادتان قريبتان',
  few: 'مواد قريبة',
  many: 'مادة قريبة',
}

export const SAVED_DECISION_FORMS: ArabicCountForms = {
  one: 'قرار محفوظ',
  two: 'قراران محفوظان',
  few: 'قرارات محفوظة',
  many: 'قراراً محفوظاً',
}

export const CALIBRATION_RESULT_FORMS: ArabicCountForms = {
  one: 'نتيجة دخلت المعايرة',
  two: 'نتيجتان دخلتا المعايرة',
  few: 'نتائج دخلت المعايرة',
  many: 'نتيجة دخلت المعايرة',
}

export const STUBBORN_WIN_FORMS: ArabicCountForms = {
  one: 'انتصار عناد صحّح الميزان',
  two: 'انتصارا عناد صحّحا الميزان',
  few: 'انتصارات عناد صحّحت الميزان',
  many: 'انتصار عناد صحّح الميزان',
}

export const ADJUSTED_WORD_FORMS: ArabicCountForms = {
  one: 'كلمة مضبوطة',
  two: 'كلمتان مضبوطتان',
  few: 'كلمات مضبوطة',
  many: 'كلمة مضبوطة',
}

export const LEXICON_TERM_FORMS: ArabicCountForms = {
  one: 'لفظ في مقالاتك',
  two: 'لفظان في مقالاتك',
  few: 'ألفاظ في مقالاتك',
  many: 'لفظاً في مقالاتك',
}

export const COPY_FORMS: ArabicCountForms = {
  one: 'نسخة',
  two: 'نسختان',
  few: 'نسخ',
  many: 'نسخة',
}

export const SOURCE_NEEDS_DECISION_FORMS: ArabicCountForms = {
  one: 'مصدر يحتاج قراراً',
  two: 'مصدران يحتاجان قراراً',
  few: 'مصادر تحتاج قراراً',
  many: 'مصدراً يحتاج قراراً',
}

export const MATERIAL_WAITING_AUDIO_FORMS: ArabicCountForms = {
  one: 'مادة تنتظر صوتاً',
  two: 'مادتان تنتظران صوتاً',
  few: 'مواد تنتظر صوتاً',
  many: 'مادة تنتظر صوتاً',
}

export const READING_FORMS: ArabicCountForms = {
  one: 'قراءة',
  two: 'قراءتان',
  few: 'قراءات',
  many: 'قراءة',
}

export const PARAGRAPH_FORMS: ArabicCountForms = {
  one: 'فقرة',
  two: 'فقرتان',
  few: 'فقرات',
  many: 'فقرة',
}

export const LINE_FORMS: ArabicCountForms = {
  one: 'سطر',
  two: 'سطران',
  few: 'سطور',
  many: 'سطراً',
}

export const ALIAS_FORMS: ArabicCountForms = {
  one: 'اسم بديل',
  two: 'اسمان بديلان',
  few: 'أسماء بديلة',
  many: 'اسماً بديلاً',
}

export const MOMENT_SENTENCE_FORMS: ArabicCountForms = {
  one: 'جملة مرتبطة باللحظة',
  two: 'جملتان مرتبطتان باللحظة',
  few: 'جمل مرتبطة باللحظة',
  many: 'جملة مرتبطة باللحظة',
}

export const DURABLE_SENTENCE_FORMS: ArabicCountForms = {
  one: 'جملة تحمل معياراً أبقى',
  two: 'جملتان تحملان معياراً أبقى',
  few: 'جمل تحمل معياراً أبقى',
  many: 'جملة تحمل معياراً أبقى',
}

export const CHECKABLE_SENTENCE_FORMS: ArabicCountForms = {
  one: 'جملة قابلة للفحص',
  two: 'جملتان قابلتان للفحص',
  few: 'جمل قابلة للفحص',
  many: 'جملة قابلة للفحص',
}

export const ARTICLE_RECENT_FORMS: ArabicCountForms = {
  one: 'مقال حديث',
  two: 'مقالان حديثان',
  few: 'مقالات حديثة',
  many: 'مقالاً حديثاً',
}

export const INTERNAL_LINK_FORMS: ArabicCountForms = {
  one: 'رابط داخلي',
  two: 'رابطان داخليان',
  few: 'روابط داخلية',
  many: 'رابطاً داخلياً',
}

export const HEALTHY_LINK_FORMS: ArabicCountForms = {
  one: 'رابط استجاب سليماً',
  two: 'رابطان استجابا سليمين',
  few: 'روابط استجابت سليمة',
  many: 'رابطاً استجاب سليماً',
}

export const RECENT_READING_FORMS: ArabicCountForms = {
  one: 'قراءة حديثة',
  two: 'قراءتان حديثتان',
  few: 'قراءات حديثة',
  many: 'قراءة حديثة',
}

export const READY_PATH_FORMS: ArabicCountForms = {
  one: 'مسار جاهز',
  two: 'مساران جاهزان',
  few: 'مسارات جاهزة',
  many: 'مساراً جاهزاً',
}

export const ARTICLE_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'مقال',
  two: 'مقالين',
  few: 'مقالات',
  many: 'مقالاً',
}

export const CAPTURE_FORMS: ArabicCountForms = {
  one: 'التقاطة',
  two: 'التقاطتان',
  few: 'التقاطات',
  many: 'التقاطة',
}

export const LIST_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'قائمة',
  two: 'قائمتين',
  few: 'قوائم',
  many: 'قائمة',
}

export const CONVERSATION_FORMS: ArabicCountForms = {
  one: 'محادثة',
  two: 'محادثتان',
  few: 'محادثات',
  many: 'محادثة',
}

export const SHOT_FORMS: ArabicCountForms = {
  one: 'لقطة',
  two: 'لقطتان',
  few: 'لقطات',
  many: 'لقطة',
}

export const HIGHLIGHT_FORMS: ArabicCountForms = {
  one: 'تظليل',
  two: 'تظليلان',
  few: 'تظليلات',
  many: 'تظليلاً',
}


/* صيغ سياقية كاملة: تمنع كسر التثنية أو الضمير عند إضافة حرف جر أو صفة
   بعد العبارة العددية. نفضّل العبارة الكاملة على تركيب اسم ثم صفة ثابتة. */
export const CUMULATIVE_VIEW_FORMS: ArabicCountForms = {
  one: 'مشاهدة تراكمية', two: 'مشاهدتان تراكميتان', few: 'مشاهدات تراكمية', many: 'مشاهدة تراكمية',
}
export const ENTITY_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'جهة', two: 'جهتين', few: 'جهات', many: 'جهة',
}
export const SECOND_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'ثانية', two: 'ثانيتين', few: 'ثوانٍ', many: 'ثانية',
}
export const WEEK_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'أسبوع', two: 'أسبوعين', few: 'أسابيع', many: 'أسبوعاً',
}
export const SENTENCE_WITH_ECHO_FORMS: ArabicCountForms = {
  one: 'جملة لها صدى', two: 'جملتان لهما صدى', few: 'جمل لها صدى', many: 'جملة لها صدى',
}
export const RELATED_PAPER_FORMS: ArabicCountForms = {
  one: 'بحث مرتبط', two: 'بحثان مرتبطان', few: 'أبحاث مرتبطة', many: 'بحثاً مرتبطاً',
}
export const INTERNAL_MATERIAL_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'مادة داخلية', two: 'مادتين داخليتين', few: 'مواد داخلية', many: 'مادة داخلية',
}
export const DOCUMENTED_YEAR_FORMS: ArabicCountForms = {
  one: 'سنة موثقة', two: 'سنتان موثقتان', few: 'سنوات موثقة', many: 'سنة موثقة',
}
export const RECENT_AVAILABLE_YEAR_FORMS: ArabicCountForms = {
  one: 'سنة متاحة', two: 'سنتين متاحتين', few: 'سنوات متاحة', many: 'سنة متاحة',
}
export const CONNECTED_MATERIAL_FORMS: ArabicCountForms = {
  one: 'مادة متصلة', two: 'مادتان متصلتان', few: 'مواد متصلة', many: 'مادة متصلة',
}
export const SAVED_PROMPT_COPY_FORMS: ArabicCountForms = {
  one: 'نسخة محفوظة', two: 'نسختان محفوظتان', few: 'نسخ محفوظة', many: 'نسخة محفوظة',
}
export const SUBSCRIBER_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'مشترك', two: 'مشتركين', few: 'مشتركين', many: 'مشتركاً',
}
export const BOOK_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'كتاب', two: 'كتابين', few: 'كتب', many: 'كتاباً',
}
export const AUDIO_EPISODE_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'حلقة مسموعة', two: 'حلقتين مسموعتين', few: 'حلقات مسموعة', many: 'حلقة مسموعة',
}
export const PUBLISHED_ARTICLE_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'مقال منشور', two: 'مقالين منشورين', few: 'مقالات منشورة', many: 'مقالاً منشوراً',
}
export const LAST_SAVED_DECISION_FORMS: ArabicCountForms = {
  one: 'قرار محفوظ', two: 'قرارين محفوظين', few: 'قرارات محفوظة', many: 'قراراً محفوظاً',
}
export const VISITED_PAGE_FORMS: ArabicCountForms = {
  one: 'صفحة زارها أحد', two: 'صفحتان زارهما أحد', few: 'صفحات زارها أحد', many: 'صفحة زارها أحد',
}
export const DISPLAYABLE_IMAGE_FORMS: ArabicCountForms = {
  one: 'صورة قابلة للعرض', two: 'صورتان قابلتان للعرض', few: 'صور قابلة للعرض', many: 'صورة قابلة للعرض',
}
export const INDEPENDENT_DIRECTION_FORMS: ArabicCountForms = {
  one: 'اتجاه مستقل', two: 'اتجاهان مستقلان', few: 'اتجاهات مستقلة', many: 'اتجاهاً مستقلاً',
}
export const FINAL_COPY_FORMS: ArabicCountForms = {
  one: 'نسخة نهائية', two: 'نسختان نهائيتان', few: 'نسخ نهائية', many: 'نسخة نهائية',
}
export const DIRECTION_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'اتجاه', two: 'اتجاهين', few: 'اتجاهات', many: 'اتجاهاً',
}
export const AFFECTED_MATERIAL_FORMS: ArabicCountForms = {
  one: 'مادة متأثرة', two: 'مادتان متأثرتان', few: 'مواد متأثرة', many: 'مادة متأثرة',
}
export const TWEET_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'تغريدة', two: 'تغريدتين', few: 'تغريدات', many: 'تغريدة',
}
export const RECENT_DAY_FORMS: ArabicCountForms = {
  one: 'يوم', two: 'يومين', few: 'أيام', many: 'يوماً',
}
export const CONVERSATION_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'محادثة', two: 'محادثتين', few: 'محادثات', many: 'محادثة',
}
export const NEAR_ARCHIVAL_MATERIAL_FORMS: ArabicCountForms = {
  one: 'مادة أرشيفية قريبة', two: 'مادتان أرشيفيتان قريبتان', few: 'مواد أرشيفية قريبة', many: 'مادة أرشيفية قريبة',
}
export const RETURNABLE_RELATED_MATERIAL_FORMS: ArabicCountForms = {
  one: 'مادة مرتبطة يمكن العودة إليها', two: 'مادتان مرتبطتان يمكن العودة إليهما', few: 'مواد مرتبطة يمكن العودة إليها', many: 'مادة مرتبطة يمكن العودة إليها',
}
export const AVAILABLE_ARCHIVAL_MATERIAL_FORMS: ArabicCountForms = {
  one: 'مادة أرشيفية متاحة للمقارنة', two: 'مادتان أرشيفيتان متاحتان للمقارنة', few: 'مواد أرشيفية متاحة للمقارنة', many: 'مادة أرشيفية متاحة للمقارنة',
}
export const DISTINCT_DIRECTION_FORMS: ArabicCountForms = {
  one: 'اتجاه متمايز', two: 'اتجاهان متمايزان', few: 'اتجاهات متمايزة', many: 'اتجاهاً متمايزاً',
}
export const PARAGRAPH_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'فقرة', two: 'فقرتين', few: 'فقرات', many: 'فقرة',
}
export const MATCHING_RESULT_FORMS: ArabicCountForms = {
  one: 'نتيجة مطابقة', two: 'نتيجتان مطابقتان', few: 'نتائج مطابقة', many: 'نتيجة مطابقة',
}
export const ARTICLE_THOUGHT_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'مقال فكري', two: 'مقالين فكريين', few: 'مقالات فكرية', many: 'مقالاً فكرياً',
}
export const DIFFERENT_YEAR_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'سنة مختلفة', two: 'سنتين مختلفتين', few: 'سنوات مختلفة', many: 'سنة مختلفة',
}
export const PASSAGE_PLAIN_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'مقطع', two: 'مقطعين', few: 'مقاطع', many: 'مقطعاً',
}
export const RECOVERED_MESSAGE_FORMS: ArabicCountForms = {
  one: 'رسالة فاتتها الأحداث الحية', two: 'رسالتان فاتتهما الأحداث الحية', few: 'رسائل فاتتها الأحداث الحية', many: 'رسالة فاتتها الأحداث الحية',
}
export const AUDIO_NEAR_MATERIAL_FORMS: ArabicCountForms = {
  one: 'مادة قريبة لها قراءة أو حوار منطوق', two: 'مادتان قريبتان لهما قراءة أو حوار منطوق', few: 'مواد قريبة لها قراءة أو حوار منطوق', many: 'مادة قريبة لها قراءة أو حوار منطوق',
}
export const PROTECTED_POINT_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'نقطة محمية', two: 'نقطتين محميتين', few: 'نقاط محمية', many: 'نقطة محمية',
}
export const RELEVANT_LINK_OBJECT_FORMS: ArabicCountForms = {
  one: 'رابطاً راهناً ذا صلة', two: 'رابطين راهنين ذوي صلة', few: 'روابط راهنة ذات صلة', many: 'رابطاً راهناً ذا صلة',
}
export const RELATED_SIGNAL_OBJECT_FORMS: ArabicCountForms = {
  one: 'إشارة مرتبطة', two: 'إشارتين مرتبطتين', few: 'إشارات مرتبطة', many: 'إشارة مرتبطة',
}
export const CONNECTION_OBJECT_FORMS: ArabicCountForms = {
  one: 'صلة مشتركة', two: 'صلتين مشتركتين', few: 'صلات مشتركة', many: 'صلة مشتركة',
}
export const RELATED_ARCHIVAL_MATERIAL_OBJECT_FORMS: ArabicCountForms = {
  one: 'مادة أرشيفية مرتبطة', two: 'مادتين أرشيفيتين مرتبطتين', few: 'مواد أرشيفية مرتبطة', many: 'مادة أرشيفية مرتبطة',
}
export const RETURNABLE_RELATED_MATERIAL_OBJECT_FORMS: ArabicCountForms = {
  one: 'مادة مرتبطة يمكن العودة إليها', two: 'مادتين مرتبطتين يمكن العودة إليهما', few: 'مواد مرتبطة يمكن العودة إليها', many: 'مادة مرتبطة يمكن العودة إليها',
}
export const DISTINCT_DIRECTION_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'اتجاه متمايز', two: 'اتجاهين متمايزين', few: 'اتجاهات متمايزة', many: 'اتجاهاً متمايزاً',
}
export const DISPLAYABLE_IMAGE_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'صورة قابلة للعرض', two: 'صورتين قابلتين للعرض', few: 'صور قابلة للعرض', many: 'صورة قابلة للعرض',
}
export const INDEPENDENT_DIRECTION_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'اتجاه مستقل', two: 'اتجاهين مستقلين', few: 'اتجاهات مستقلة', many: 'اتجاهاً مستقلاً',
}
export const ENDING_OBJECT_FORMS: ArabicCountForms = {
  one: 'نهاية عالمية', two: 'نهايتين عالميتين', few: 'نهايات عالمية', many: 'نهاية عالمية',
}
export const SCENE_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'مشهد مولَّد مستقل', two: 'مشهدين مولَّدين مستقلين', few: 'مشاهد مولَّدة مستقلة', many: 'مشهداً مولَّداً مستقلاً',
}
export const AFFECTED_MATERIAL_OBJECT_FORMS: ArabicCountForms = {
  one: 'مادة متأثرة', two: 'مادتين متأثرتين', few: 'مواد متأثرة', many: 'مادة متأثرة',
}
export const UNSUPPORTED_CLAIM_FORMS: ArabicCountForms = {
  one: 'ادعاء في الأصل لم يكتمل إسناده', two: 'ادعاءان في الأصل لم يكتمل إسنادهما', few: 'ادعاءات في الأصل لم يكتمل إسنادها', many: 'ادعاءً في الأصل لم يكتمل إسناده',
}
export const RECOVERED_MESSAGE_OBJECT_FORMS: ArabicCountForms = {
  one: 'رسالة فاتتها الأحداث الحية', two: 'رسالتين فاتتهما الأحداث الحية', few: 'رسائل فاتتها الأحداث الحية', many: 'رسالة فاتتها الأحداث الحية',
}
export const FINAL_READY_COPY_FORMS: ArabicCountForms = {
  one: 'نسخة نهائية جاهزة للنشر', two: 'نسختان نهائيتان جاهزتان للنشر', few: 'نسخ نهائية جاهزة للنشر', many: 'نسخة نهائية جاهزة للنشر',
}

export const MISSING_CAVEAT_FORMS: ArabicCountForms = {
  one: 'تحفّظ واحد في الأصل لم يظهر في النسخ المشتقة',
  two: 'تحفّظان في الأصل لم يظهر أيٌّ منهما في النسخ المشتقة',
  few: 'تحفّظات في الأصل لم يظهر أيٌّ منها في النسخ المشتقة',
  many: 'تحفّظاً في الأصل لم يظهر في النسخ المشتقة',
}

export const REPLY_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'رد',
  two: 'ردين',
  few: 'ردود',
  many: 'رداً',
}

export const CARD_FORMS: ArabicCountForms = {
  one: 'بطاقة',
  two: 'بطاقتان',
  few: 'بطاقات',
  many: 'بطاقة',
}

export const LAYER_FORMS: ArabicCountForms = {
  one: 'طبقة',
  two: 'طبقتان',
  few: 'طبقات',
  many: 'طبقة',
}

export const CAMPAIGN_PIECE_FORMS: ArabicCountForms = {
  one: 'قطعة',
  two: 'قطعتان',
  few: 'قطع',
  many: 'قطعة',
}

export const CAMPAIGN_PIECE_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'قطعة متناسقة وغير مكررة',
  two: 'قطعتين متناسقتين وغير مكررتين',
  few: 'قطع متناسقة وغير مكررة',
  many: 'قطعة متناسقة وغير مكررة',
}

export const PENDING_ITEM_FORMS: ArabicCountForms = {
  one: 'بند معلّق',
  two: 'بندان معلّقان',
  few: 'بنود معلّقة',
  many: 'بنداً معلّقاً',
}

export const TERM_OBJECT_FORMS: ArabicCountForms = {
  one: 'لفظاً',
  two: 'لفظين',
  few: 'ألفاظاً',
  many: 'لفظاً',
}

export const PENDING_TERM_FORMS: ArabicCountForms = {
  one: 'لفظ بانتظار ضبطك',
  two: 'لفظان بانتظار ضبطك',
  few: 'ألفاظ بانتظار ضبطك',
  many: 'لفظاً بانتظار ضبطك',
}

export const ATTENTION_WARNING_FORMS: ArabicCountForms = {
  one: 'تنبيه يحتاج انتباهك',
  two: 'تنبيهان يحتاجان انتباهك',
  few: 'تنبيهات تحتاج انتباهك',
  many: 'تنبيهاً يحتاج انتباهك',
}

export const RULE_FORMS: ArabicCountForms = {
  one: 'قاعدة',
  two: 'قاعدتان',
  few: 'قواعد',
  many: 'قاعدة',
}

export const LAYER_AFTER_PREPOSITION_FORMS: ArabicCountForms = {
  one: 'طبقة',
  two: 'طبقتين',
  few: 'طبقات',
  many: 'طبقة',
}
