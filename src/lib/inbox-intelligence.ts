import { interpretDrAhmadDomain } from './dr-ahmad-domain-glossary'
import { arabicCountPhrase, OCCURRENCE_FORMS } from './arabic-count.ts'

export type InboxMessageInput = {
  id: string
  topic?: string
  intent?: string
  quality?: string
  message?: string
  createdAt?: { seconds: number }
}

export type InboxInsight = {
  kind: 'سؤال علمي' | 'دعوة أو فعالية' | 'تعاون' | 'استشارة' | 'إشادة' | 'مشكلة تقنية' | 'طلب إعلامي' | 'طلب عام'
  priority: 'عالية' | 'متوسطة' | 'عادية'
  contentPotential: 'قوي' | 'محتمل' | 'ضعيف'
  concepts: string[]
  theme: string
  reason: string
}

export type AudienceSignal = {
  theme: string
  count: number
  messageIds: string[]
  suggestion: string
  strength: 'إشارة قوية' | 'يتكرر' | 'بداية نمط'
}

const normalize = (value = '') => value.toLowerCase().replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
const includesAny = (text: string, words: string[]) => words.some((word) => text.includes(normalize(word)))

const STOP = new Set('هذا هذه ذلك التي الذي على الى إلى عن من في مع عند لدي عندي اريد أريد ممكن هل كيف لماذا ماذا رسالة موضوع طلب سؤال استفسار السلام عليكم عليكم شكرا شكراً'.split(' ').map(normalize))
function fallbackTheme(value: string) {
  const counts = new Map<string, number>()
  normalize(value).split(' ').filter((word) => word.length >= 4 && !STOP.has(word)).forEach((word) => counts.set(word, (counts.get(word) || 0) + 1))
  return [...counts].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0] || 'موضوع عام'
}

export function analyzeInboxMessage(message: InboxMessageInput): InboxInsight {
  const raw = `${message.topic || ''} ${message.intent || ''} ${message.message || ''}`
  const text = normalize(raw)
  let kind: InboxInsight['kind'] = 'طلب عام'
  if (includesAny(text, ['خلل', 'مشكلة بالموقع', 'لا يعمل', 'ما يفتح', 'رابط', 'تقنية', 'technical', 'bug'])) kind = 'مشكلة تقنية'
  else if (includesAny(text, ['لقاء إعلامي', 'مقابلة', 'تلفزيون', 'إذاعة', 'بودكاست', 'صحافة', 'media', 'interview'])) kind = 'طلب إعلامي'
  else if (includesAny(text, ['محاضرة', 'ورشة', 'مؤتمر', 'ندوة', 'ملتقى', 'استضافة', 'keynote', 'workshop'])) kind = 'دعوة أو فعالية'
  else if (includesAny(text, ['تعاون', 'مشروع مشترك', 'بحث مشترك', 'شراكة', 'collaboration', 'partnership'])) kind = 'تعاون'
  else if (includesAny(text, ['استشارة', 'رأيكم', 'رأيك', 'consultation', 'consulting'])) kind = 'استشارة'
  else if (includesAny(text, ['دراسة', 'بحث', 'منهجية', 'مرجع', 'جامعة', 'باحث', 'رسالة علمية', 'research', 'study'])) kind = 'سؤال علمي'
  else if (includesAny(text, ['شكرا', 'أعجبني', 'رائع', 'ممتاز', 'استفدت', 'كتابك', 'مقالك', 'thank', 'great'])) kind = 'إشادة'

  const urgent = includesAny(text, ['عاجل', 'اليوم', 'غدا', 'غداً', 'هذا الأسبوع', 'موعد قريب', 'urgent', 'tomorrow'])
  const serious = message.quality === 'جاد وواضح' || includesAny(text, ['وزارة', 'جامعة', 'هيئة', 'مؤتمر', 'شركة', 'كلية'])
  const priority: InboxInsight['priority'] = urgent ? 'عالية' : serious || ['دعوة أو فعالية', 'طلب إعلامي', 'تعاون'].includes(kind) ? 'متوسطة' : 'عادية'

  const domain = interpretDrAhmadDomain(message.message || '', `${message.topic || ''} ${message.intent || ''}`)
  const concepts = domain.recognizedTerms.map((term) => term.canonicalAr).filter(Boolean).slice(0, 4)
  const theme = concepts[0] || domain.primary?.canonicalAr || fallbackTheme(raw)
  const knowledgeLike = concepts.length > 0 || ['سؤال علمي', 'استشارة'].includes(kind)
  const contentPotential: InboxInsight['contentPotential'] = knowledgeLike && (message.message || '').length > 80 ? 'قوي' : knowledgeLike ? 'محتمل' : 'ضعيف'
  const reason = contentPotential === 'قوي'
    ? `الرسالة تحمل سؤالاً أو مفهوماً واضحاً حول «${theme}» ويمكن أن تكشف حاجة حقيقية لدى الجمهور.`
    : contentPotential === 'محتمل'
      ? `توجد إشارة معرفية حول «${theme}»، لكنها تحتاج تكراراً أو سؤالاً أوضح قبل تحويلها إلى مادة.`
      : 'الرسالة أقرب إلى طلب تنفيذي أو تواصل مباشر، لا إلى إشارة تحريرية.'
  return { kind, priority, contentPotential, concepts, theme, reason }
}

export function buildAudienceSignals(messages: InboxMessageInput[]): AudienceSignal[] {
  const buckets = new Map<string, { ids: string[]; kinds: Set<string> }>()
  for (const message of messages) {
    const insight = analyzeInboxMessage(message)
    if (insight.contentPotential === 'ضعيف' || !insight.theme || insight.theme === 'موضوع عام') continue
    const key = normalize(insight.theme)
    const row = buckets.get(key) || { ids: [], kinds: new Set<string>() }
    row.ids.push(message.id)
    row.kinds.add(insight.kind)
    buckets.set(key, row)
  }
  return [...buckets.entries()]
    .map(([themeKey, row]) => {
      const theme = analyzeInboxMessage(messages.find((item) => row.ids.includes(item.id)) || { id: '', message: themeKey }).theme
      const count = row.ids.length
      return {
        theme,
        count,
        messageIds: row.ids,
        strength: count >= 5 ? 'إشارة قوية' as const : count >= 3 ? 'يتكرر' as const : 'بداية نمط' as const,
        suggestion: count >= 3
          ? `وصل السؤال أو المعنى حول «${theme}» ${arabicCountPhrase(count, OCCURRENCE_FORMS)}. يستحق زاوية مستقلة تجيب ما وراء السؤال، لا الرسائل نفسها.`
          : `ظهرت إشارة متكررة حول «${theme}». راقبها؛ تكرار ثالث يحولها إلى مرشح قوي للكتابة.`,
      }
    })
    .filter((row) => row.count >= 2)
    .sort((a, b) => b.count - a.count || a.theme.localeCompare(b.theme, 'ar'))
    .slice(0, 8)
}
