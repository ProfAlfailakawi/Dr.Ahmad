/**
 * مقارنة النجمتين في رابط سماء المقالات: ‎?compare=slugA,slugB — منطقٌ خالص يُختبر في Node.
 */

/** حتى نجمتين من الرابط. */
export const compareSlugsFromSearch = (search: string) =>
  (new URLSearchParams(search).get('compare') || '').split(',').filter(Boolean).slice(0, 2)

/**
 * يحلّ slugs الرابط إلى نجوم. `done` = يجوز اعتماد الحالة وبدء كتابة الرابط:
 * إمّا حُلَّت كلها، وإمّا انتهى تحميل المحتوى فما بقي لا وجود له فيُسقَط وحده.
 * وما دام المحتوى يُحمَّل ولم تُحلّ كلها يبقى الرابط كما هو (لا يُمسح slug سيصل لاحقاً).
 */
export function resolveCompare(slugs: readonly string[], indexOf: (slug: string) => number | undefined, contentLoading: boolean) {
  const picked = slugs.map(indexOf).filter((index): index is number => typeof index === 'number')
  return { picked, done: picked.length === slugs.length || !contentLoading }
}
