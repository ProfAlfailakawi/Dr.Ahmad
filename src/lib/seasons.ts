/**
 * النواة الموسمية الواحدة — يستهلكها الاستوديو (لمسة الموسم في التصاميم)
 * والرئيسية (لمسة الترحيب) معاً، فلا يختلف تقويمان في الموقع أبداً.
 * الحساب هجري أم القرى عبر Intl — بلا مكتبات ولا شبكات.
 */

export type SeasonId = 'ramadan' | 'eid-fitr' | 'eid-adha' | 'kuwait-national'

export interface Season {
  id: SeasonId
  label: string
  greeting: string
}

const SEASONS: Record<SeasonId, Omit<Season, 'id'>> = {
  ramadan: { label: 'رمضان', greeting: 'رمضان كريم' },
  'eid-fitr': { label: 'عيد الفطر', greeting: 'عيدكم مبارك' },
  'eid-adha': { label: 'عيد الأضحى', greeting: 'عيدكم مبارك' },
  'kuwait-national': { label: 'الأعياد الوطنية', greeting: 'عاش الوطن' },
}

function hijriParts(date: Date): { month: number; day: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      timeZone: 'Asia/Kuwait',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date)
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0)
    const month = value('month')
    const day = value('day')
    return month >= 1 && month <= 12 && day >= 1 ? { month, day } : null
  } catch {
    return null
  }
}

/** الموسم النشط الآن، أو null في سائر أيام السنة — فالأصل هو الهدوء. */
export function currentSeason(date = new Date()): Season | null {
  // الأعياد الوطنية الكويتية: 25 و26 فبراير (مع يوم 24 عشية الاحتفال)
  const gregorian = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait', month: '2-digit', day: '2-digit' }).format(date)
  if (gregorian === '02-24' || gregorian === '02-25' || gregorian === '02-26') {
    return { id: 'kuwait-national', ...SEASONS['kuwait-national'] }
  }
  const hijri = hijriParts(date)
  if (!hijri) return null
  if (hijri.month === 9) return { id: 'ramadan', ...SEASONS.ramadan }
  if (hijri.month === 10 && hijri.day <= 3) return { id: 'eid-fitr', ...SEASONS['eid-fitr'] }
  if (hijri.month === 12 && hijri.day >= 9 && hijri.day <= 13) return { id: 'eid-adha', ...SEASONS['eid-adha'] }
  return null
}

/**
 * رسمة الموسم الخطية — قوس هلال أو سعفة أو شراع، بخط واحد رفيع لا زخرفة.
 * تُرسم بإحداثيات نسبية داخل مربع 100×100 ويُحدد لونها وموضعها عند الاستخدام.
 */
export function seasonStrokePath(id: SeasonId): string {
  switch (id) {
    case 'ramadan':
      // هلال: قوسان دائريان متداخلان
      return 'M 62 12 A 40 40 0 1 0 62 88 A 32 32 0 1 1 62 12'
    case 'eid-fitr':
    case 'eid-adha':
      // هلال أرق مع نجمة نقطية يضعها المستخدم
      return 'M 66 16 A 38 38 0 1 0 66 84 A 30 30 0 1 1 66 16'
    case 'kuwait-national':
      // شراع بوم كويتي بخط واحد
      return 'M 30 85 L 30 15 Q 72 38 34 62 L 34 85 M 18 85 H 82'
  }
}
