import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

// هذه ملفات قديمة يتيمة خارج src/ كانت بعض أدوات المزامنة تعتبرها التطبيق الحقيقي.
// حذفها قبل كل بناء يلغي ازدواجية مصدر التطبيق ويمنع أدوات المزامنة من اختيار شجرة قديمة خارج src/.
const obsolete = [
  'App.tsx',
  'ArticleDetail.tsx',
  'PaperDetail.tsx',
  'IdeaFeatures.tsx',
  'public/sitemap.xml',
]

for (const relative of obsolete) {
  await rm(resolve(process.cwd(), relative), { force: true })
}

console.log(`[clean-obsolete] removed/confirmed ${obsolete.length} obsolete paths`)
