import type { ArticleRecord } from './cms'
import { systemUiTerminology } from './system-ui-terminology'

const preferredOrder = ['التعليم', 'التربية', 'مجتمع', 'تقنية', 'هوية', 'إعلام', 'بحث']

export function dynamicArticleCategories(
  articles: Pick<ArticleRecord, 'cat'>[],
  includeAll = true,
) {
  const found = Array.from(new Set(
    articles
      .map((article) => String(article.cat || '').trim())
      .filter(Boolean),
  ))
  const known = preferredOrder.filter((category) => found.includes(category))
  const newCategories = found
    .filter((category) => !preferredOrder.includes(category))
    .sort((left, right) => left.localeCompare(right, 'ar'))
  const categories = [...known, ...newCategories]
  return includeAll ? ['الكل', ...categories] : categories
}

export function categoryLabel(category: string) {
  if (category === 'مجتمع') return 'المجتمع'
  return systemUiTerminology(category)
}
