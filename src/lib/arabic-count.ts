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
  if (count === 0 && forms.zero) return forms.zero
  if (mod100 === 1) return forms.one
  if (mod100 === 2) return forms.two
  if (mod100 >= 3 && mod100 <= 10) return forms.few
  return forms.many
}

export function arabicCountPhrase(count: number, forms: ArabicCountForms, formatNumber: (value: number) => string = (value) => String(value)) {
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
