/**
 * أغلفة الكتب بمقاسين.
 *
 * الغلاف الواحد صورةٌ بعرض ١٠٢٤ بكسل، ورفّ الكتب يعرض تسعةً منها في مربعاتٍ
 * صغيرة، فكانت الصفحة تنزّل نحو سبعمئة كيلوبايت لتُظهر صوراً لا يتجاوز عرضها
 * الظاهر بضع مئات من البكسلات. `scripts/optimize-images.mjs` صار يولّد نسخة
 * ٤٨٠ و٧٦٨ بكسل بجانب كل غلاف، وهذه الدالة تصف الدرجات للمتصفح فيختار أصغر ما يكفي.
 *
 * الشاشات التي تحتاج ١٠٢٤ تأخذها كما كانت — لا تتغيّر حدّة صورةٍ واحدة.
 */
export function coverSrcSet(cover?: string) {
  if (!cover || !cover.startsWith('/covers/') || !cover.endsWith('.webp')) return undefined
  const base = cover.replace(/\.webp$/, '')
  return `${base}-480w.webp 480w, ${base}-768w.webp 768w, ${cover} 1024w`
}
