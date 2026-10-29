// النص الإنجليزي داخل الصفحة العربية: فيه حرف لاتيني وليس فيه حرف عربي.
// يأخذ lang="en" فتنطقه قارئات الشاشة بقواعد الإنجليزية لا العربية، وdir="ltr" لاتجاه سطره.
// الفاصلة العربية «،» ليست من الحروف، فلا تُخرج عنوان المجلة الإنجليزي من هذا الحكم.
const LATIN_LETTER = /\p{Script=Latin}/u
const ARABIC_LETTER = /(?=\p{L})\p{Script=Arabic}/u

export function isEnglishText(text?: string | null): boolean {
  return typeof text === 'string' && LATIN_LETTER.test(text) && !ARABIC_LETTER.test(text)
}

/** للنص العربي أو المختلط لا يضيف أي سمة، فيبقى العنصر كما كان. */
export function englishTextProps(text?: string | null): { lang?: 'en'; dir?: 'ltr' } {
  return isEnglishText(text) ? { lang: 'en', dir: 'ltr' } : {}
}
