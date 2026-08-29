/**
 * ابتكار المشاهد الرمزية — عقد الطلب والتحقق، بلا شبكة.
 *
 * الفرق عن مصنع المكتبة (symbolic-reels): هذا يبتكر مشهداً لم يُكتب من قبل،
 * لكنه لا يبتكر في الفراغ — يُغذّى بمعجم الدكتور (٢٩٠ مفهوماً بمرادفاتها)
 * وبمقاطع من متنه هو، فيخرج المشهد من عالمه لا من عموميات النموذج.
 *
 * الملف نقيٌّ عمداً: يبني التعليمات ويتحقق من المخرجات، ولا يعرف شيئاً عن
 * Gemini ولا عن الخادم — فيُختبر تحت node مباشرة، ويصلح للمتصفح والخادم معاً.
 */

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/
const words = (value = '') => value.trim().split(/\s+/).filter(Boolean)

/** يلتقط مفاهيم المعجم الحاضرة في الفكرة — بلا تشكيل ولا فروق ألف. */
export function conceptsInText(text, glossary, limit = 8) {
  const bare = (value = '') => value
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  const haystack = ` ${bare(text)} `
  const hits = []
  for (const entry of glossary) {
    const names = [entry.canonicalAr, ...(entry.aliases || [])].filter(Boolean)
    for (const name of names) {
      const needle = bare(name)
      if (needle.length < 3) continue
      if (haystack.includes(` ${needle} `)) {
        hits.push({ concept: entry.canonicalAr || name, weight: needle.length })
        break
      }
    }
  }
  return [...new Set(hits.sort((a, b) => b.weight - a.weight).map((hit) => hit.concept))].slice(0, limit)
}

/** يختار مقاطع من المتن تلامس الفكرة — دليلٌ لنبرته لا حشوٌ للسياق. */
export function passagesForIdea(idea, corpus, limit = 3) {
  const keys = words(idea).filter((word) => word.length >= 4)
  if (!keys.length) return corpus.slice(0, limit)
  const scored = corpus.map((item) => {
    const text = `${item.title || ''} ${item.text || ''}`
    return { item, score: keys.reduce((total, key) => total + (text.includes(key) ? 1 : 0), 0) }
  })
  return scored.filter((row) => row.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((row) => row.item)
}

/** التعليمات: مخرجٌ سينمائي يعرف عالم الدكتور، لا مولّد صور عام. */
export function inventionInstruction() {
  return [
    'You are a cinematic art director working exclusively for Dr. Ahmad Al-Failakawi, an Arabic education and critical-thinking author.',
    'Your job: invent ORIGINAL symbolic scenes for vertical Instagram reels — poetic visual metaphors, never explainer footage.',
    'Hard rules:',
    '1. Each scene is ONE continuous filmable moment with a single visual transformation. No montage, no scene changes, no multiple locations.',
    '2. Never include a presenter, a talking person, a recognizable face, or any interface. Human presence, if any, stays anonymous: hands, silhouettes, figures from behind.',
    '3. The scene must contain NO text, letters, numbers, signs, logos, or writing of any kind — text is added later in editing.',
    '4. The metaphor must be concrete and physically filmable in the real world (or as photoreal VFX). No abstractions like "a feeling of hope"; instead, an object doing something.',
    '5. Ground every scene in the supplied concepts from the author\'s own glossary and the passages from his own writing. The scene must feel like HIS idea made visible, not a generic stock metaphor.',
    '6. Make the scenes radically different from each other: different objects, different scale, different environments. Never repeat the same object across scenes.',
    '7. Avoid these overused metaphors entirely: lightbulbs, ticking clocks alone, generic puzzle pieces, chess boards, ladders to the sky, and brains made of gears.',
    'Language: sceneAr / labelAr / whyAr in Arabic. sceneEn / arcStartEn / arcEndEn in English only — they feed a video model.',
    'sceneEn must be a rich, specific, filmable description (at least 25 words): the object, the environment, the light, the movement.',
  ].join('\n')
}

/** الطلب: فكرته + مفاهيمه + متنه. */
export function inventionPrompt(request) {
  const lines = [
    `Author's idea (Arabic): ${request.idea}`,
    request.sentence ? `Sentence that will be overlaid later (Arabic): ${request.sentence}` : '',
    request.concepts.length ? `Concepts from the author's own glossary present in this idea: ${request.concepts.join(' · ')}` : '',
  ].filter(Boolean)
  if (request.passages.length) {
    lines.push('Passages from the author\'s own writing (use them for tone and meaning, never quote them inside the scene):')
    for (const passage of request.passages) {
      lines.push(`- ${passage.title ? `[${passage.title}] ` : ''}${(passage.text || '').slice(0, 400)}`)
    }
  }
  lines.push(`Invent exactly ${request.count} original symbolic scenes, each filmable in ${request.seconds} seconds.`)
  return lines.join('\n')
}

/** مخطط الإخراج المنظّم — يُمرَّر إلى طبقة Gemini في الخادم. */
export const INVENTION_PROPERTIES = {
  scenes: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        labelAr: { type: 'string', description: 'اسم المشهد بالعربية، كلمتان أو ثلاث' },
        sceneAr: { type: 'string', description: 'وصف المشهد بالعربية في جملة واحدة واضحة' },
        sceneEn: { type: 'string', description: 'Rich filmable English description, 25 words or more' },
        arcStartEn: { type: 'string', description: 'How the clip begins, in English' },
        arcEndEn: { type: 'string', description: 'How the clip ends, in English' },
        whyAr: { type: 'string', description: 'لماذا يخدم هذا المشهد فكرة الدكتور — جملة واحدة' },
      },
      required: ['labelAr', 'sceneAr', 'sceneEn', 'arcStartEn', 'arcEndEn', 'whyAr'],
    },
  },
}

export const INVENTION_REQUIRED = ['scenes']

/**
 * بوابة القبول: النموذج قد يخالف، فلا يمرّ إلا ما يطابق العقد.
 * ترفض العربية المسرّبة إلى الحقول الإنجليزية، والوصف الفقير، والمشهد المكرّر،
 * والاستعارات المستهلكة، وأيّ ذكرٍ لنصٍّ داخل الصورة أو لشخصٍ يتكلم.
 */
export function acceptInventedScenes(raw, expected) {
  const rows = Array.isArray(raw?.scenes) ? raw.scenes : []
  const banned = /lightbulb|light bulb|puzzle piece|chess|gears?\s+(in|inside)\s+(a\s+)?brain|ladder to the sky/i
  const talking = /presenter|speaking to camera|talking head|narrator on screen|subtitle|caption|text overlay|words appear/i
  const seen = new Set()
  const accepted = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row
    const labelAr = String(item.labelAr || '').trim()
    const sceneAr = String(item.sceneAr || '').trim()
    const sceneEn = String(item.sceneEn || '').trim()
    const arcStartEn = String(item.arcStartEn || '').trim()
    const arcEndEn = String(item.arcEndEn || '').trim()
    const whyAr = String(item.whyAr || '').trim()
    if (!labelAr || !sceneAr || !sceneEn || !arcStartEn || !arcEndEn || !whyAr) continue
    // الحقول الإنجليزية إنجليزية خالصة — تسريب العربية يفسد برومبت الفيديو.
    if (ARABIC.test(sceneEn) || ARABIC.test(arcStartEn) || ARABIC.test(arcEndEn)) continue
    // والعربية عربية: وصفٌ إنجليزيٌّ في حقل عربي يعني أن النموذج خلط الحقول.
    if (!ARABIC.test(sceneAr) || !ARABIC.test(labelAr)) continue
    if (words(sceneEn).length < 25) continue
    if (banned.test(sceneEn) || talking.test(sceneEn)) continue
    const fingerprint = sceneEn.toLowerCase().replace(/[^a-z]+/g, ' ').split(' ').filter((word) => word.length > 4).slice(0, 6).join(' ')
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    accepted.push({ labelAr, sceneAr, sceneEn, arcStartEn, arcEndEn, whyAr })
    if (accepted.length >= expected) break
  }
  return accepted
}
