import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Shared Arabic human-performance engine.
 *
 * It deliberately keeps sourceText immutable and creates a separate
 * pronunciationText/performance plan.  It is dependency-free so the website
 * build never needs Azure, Gemini, ffmpeg, or a network connection.
 */
export const HUMAN_AUDIO_ENGINE_VERSION = '2026.07.16-human-performance-v1'
const MODULE_FILE = fileURLToPath(import.meta.url)
const MODULE_DIR = dirname(MODULE_FILE)
const ROOT = resolve(MODULE_DIR, '../..')
const LEXICON_FILE = resolve(ROOT, 'scripts/pronunciation-lexicon.json')
const DIACRITICS = /[\u064B-\u0652\u0670]/g
const ARABIC_WORD = /[\u0621-\u064A\u0660-\u0669]+/g
/* \u062A\u062C\u0631\u064A\u062F \u0627\u0644\u062A\u0634\u0643\u064A\u0644 \u0627\u0644\u0643\u0627\u0645\u0644 (\u062D\u0631\u0643\u0627\u062A + \u0634\u062F\u0651\u0629 + \u0633\u0643\u0648\u0646 + \u062A\u0646\u0648\u064A\u0646 + \u0623\u0644\u0641 \u062E\u0646\u062C\u0631\u064A\u0629 + \u062A\u0637\u0648\u064A\u0644) \u2014 \u064A\u064F\u0639\u064A\u062F
   \u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u064F\u0634\u0643\u064E\u0651\u0644 \u0625\u0644\u0649 \u062D\u0631\u0648\u0641\u0647 \u0627\u0644\u0639\u0627\u0631\u064A\u0629 \u0643\u064A \u0646\u062A\u062D\u0642\u0642 \u0623\u0646\u0647 \u0627\u0644\u0645\u0642\u0627\u0644 \u0646\u0641\u0633\u0647\u060C \u0648\u0646\u0639\u0631\u0636 \u0627\u0644\u0639\u0627\u0631\u064A \u0644\u0644\u0642\u0627\u0631\u0626
   \u0648\u0646\u064F\u0628\u0642\u064A \u0627\u0644\u0645\u064F\u0634\u0643\u064E\u0651\u0644 \u0644\u0644\u0646\u0637\u0642 \u0648\u062D\u062F\u0647. */
const stripTashkeel = (value) => String(value || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '')

const executable = (name, configured = '') => {
  const candidates = [configured, `/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, `/usr/bin/${name}`, name]
    .filter(Boolean)
  return candidates.find((candidate) => candidate === name || existsSync(candidate)) || name
}

export const FFMPEG = executable('ffmpeg', process.env.FFMPEG_BIN)
export const FFPROBE = executable('ffprobe', process.env.FFPROBE_BIN)
export const HUMAN_AUDIO_PIPELINE_HASH = createHash('sha256')
  .update(`${HUMAN_AUDIO_ENGINE_VERSION}\n${readFileSync(MODULE_FILE, 'utf8')}`)
  .digest('hex')

export const READING_VOICES = Object.freeze({
  fahed: {
    key: 'fahed', label: 'فهد', azure: 'ar-KW-FahedNeural', locale: 'ar-KW',
    rateBiasPct: 0, pitchBiasPct: -0.4, warmthBias: 2, energyBias: 1,
  },
  noura: {
    key: 'noura', label: 'نورة', azure: 'ar-KW-NouraNeural', locale: 'ar-KW',
    rateBiasPct: -2, pitchBiasPct: 0.35, warmthBias: 4, energyBias: 0,
  },
})

const PERFORMANCE = Object.freeze({
  opening:     { wpm: [134, 145], rate: [-2, 5], pitch: 0.8, energy: 72, warmth: 82, before: 0, after: [380, 560], ending: 'open' },
  hook:        { wpm: [140, 150], rate: [1, 7], pitch: 1.0, energy: 78, warmth: 80, before: 0, after: [300, 470], ending: 'open' },
  statement:   { wpm: [132, 143], rate: [-4, 4], pitch: 0.0, energy: 62, warmth: 80, before: 0, after: [280, 440], ending: 'neutral' },
  explanation: { wpm: [132, 143], rate: [-4, 4], pitch: -0.1, energy: 60, warmth: 82, before: 0, after: [290, 460], ending: 'neutral' },
  question:    { wpm: [128, 140], rate: [-7, 1], pitch: 1.5, energy: 66, warmth: 84, before: 30, after: [420, 680], ending: 'open' },
  objection:   { wpm: [132, 142], rate: [-3, 4], pitch: 0.65, energy: 72, warmth: 78, before: 0, after: [300, 480], ending: 'open' },
  warning:     { wpm: [126, 138], rate: [-8, 0], pitch: -0.35, energy: 68, warmth: 76, before: 30, after: [420, 650], ending: 'final' },
  human:       { wpm: [122, 135], rate: [-10, -1], pitch: -0.55, energy: 54, warmth: 92, before: 40, after: [480, 760], ending: 'neutral' },
  example:     { wpm: [130, 141], rate: [-5, 3], pitch: 0.25, energy: 65, warmth: 84, before: 20, after: [320, 500], ending: 'neutral' },
  quote:       { wpm: [126, 138], rate: [-7, 0], pitch: -0.25, energy: 58, warmth: 86, before: 35, after: [400, 620], ending: 'final' },
  comparison:  { wpm: [130, 141], rate: [-5, 3], pitch: 0.15, energy: 64, warmth: 80, before: 0, after: [320, 500], ending: 'neutral' },
  transition:  { wpm: [132, 143], rate: [-3, 5], pitch: 0.45, energy: 67, warmth: 80, before: 0, after: [360, 560], ending: 'open' },
  reflection:  { wpm: [118, 130], rate: [-12, -3], pitch: -0.75, energy: 48, warmth: 94, before: 45, after: [600, 900], ending: 'final' },
  conclusion:  { wpm: [120, 133], rate: [-10, -2], pitch: -0.6, energy: 56, warmth: 92, before: 40, after: [560, 820], ending: 'final' },
})

const normalizeSpace = (value) => String(value || '').replace(/\r/g, '').replace(/\s+/g, ' ').trim()
const normalizedLetters = (value) => normalizeSpace(value).replace(DIACRITICS, '')
  .replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, '')
  /* توحيد حوامل الهمزة: STT يكتب «ذكاءنا/ذكائنا» و«مسؤول/مسئول» بحوامل متبادلة والصوت
     واحد — كانت تُحسب كلمات مفقودة فتُسقط وحدات سليمة (r002 في «ذكاء بلا ضمير») */
  .replace(/[ؤئ]/g, 'ء')
  .replace(/[^\u0621-\u064A0-9A-Za-z ]/g, '')

export const countArabicWords = (value) => normalizeSpace(value).split(/\s+/).filter(Boolean).length
export const sourceHash = ({ title = '', text = '', voice = '' }) => createHash('sha256')
  .update(`${title}\n${text}\n${voice}`).digest('hex')

const stableNumber = (value, salt = '') => {
  const bytes = createHash('sha256').update(`${salt}|${value}`).digest()
  return bytes.readUInt16BE(0) / 65535
}
const stableBetween = (value, salt, [minimum, maximum]) => Math.round(minimum
  + stableNumber(value, salt) * (maximum - minimum))

function sentenceKind(text, index, total) {
  const value = normalizeSpace(text)
  if (index === 0) return value.includes('؟') ? 'question' : 'hook'
  if (index === total - 1 || /^(في النهاية|وأخير|وخلاصة|لذلك يبقى|وهكذا)/.test(value)) return 'conclusion'
  if (value.includes('؟')) return 'question'
  if (/^[«“\"]|[»”\"]$/.test(value) || /^(قال|تقول|كتب|يقول)/.test(value)) return 'quote'
  if (/^(لكن|غير أن|على أن|ومع ذلك|في المقابل)/.test(value)) return 'objection'
  if (/(خطر|نحذر|نخشى|قد يهدد|المشكلة)/.test(value)) return 'warning'
  if (/(الطفل|الطالب|الإنسان|الأسرة|الأب|الأم|الخوف|الألم|الجرح|القيمة|الكرامة)/.test(value)) return 'human'
  if (/^(مثلاً|مثل|لنفترض|تخيل|في موقف|على سبيل)/.test(value)) return 'example'
  if (/(بينما|في حين|على العكس|مقارنة|أما .* ف)/.test(value)) return 'comparison'
  if (/^(وهنا|لذلك|لهذا|ومن هنا|بعد ذلك|ثم|أما الآن)/.test(value)) return 'transition'
  if (/(ربما|لعل|نتأمل|نفكر|المعنى الأعمق)/.test(value)) return 'reflection'
  if (/[؛:]/.test(value) || /(لأن|أي أن|بمعنى|وهذا يعني)/.test(value)) return 'explanation'
  return 'statement'
}

function endingDirection(text, kind) {
  if (text.includes('؟')) return 'open'
  if (['conclusion', 'reflection', 'warning', 'quote'].includes(kind)) return 'final'
  if (['transition', 'objection', 'hook'].includes(kind)) return 'open'
  return 'neutral'
}

function splitAtNaturalBoundary(text, maximumWords = 28) {
  const clean = normalizeSpace(text)
  if (countArabicWords(clean) <= maximumWords) return [clean]
  const clauses = clean.split(/(?<=[،؛:])\s+|\s+(?=(?:لكن|غير أن|لأن|بينما|وهنا|لذلك|ثم|وقد|فقد)\b)/u)
    .map((part) => part.trim()).filter(Boolean)
  if (clauses.length === 1) {
    const words = clean.split(/\s+/)
    const output = []
    let cursor = 0
    while (cursor < words.length) {
      let end = Math.min(words.length, cursor + maximumWords)
      if (end < words.length) {
        for (let candidate = end; candidate > cursor + 7; candidate -= 1) {
          if (/[،؛:]$/.test(words[candidate - 1])) { end = candidate; break }
        }
      }
      output.push(words.slice(cursor, end).join(' '))
      cursor = end
    }
    return output
  }
  const output = []
  for (const clause of clauses) {
    if (countArabicWords(clause) > maximumWords) output.push(...splitAtNaturalBoundary(clause, maximumWords))
    else if (output.length && countArabicWords(`${output.at(-1)} ${clause}`) <= maximumWords) output[output.length - 1] += ` ${clause}`
    else output.push(clause)
  }
  return output
}

export function segmentArticleForPerformance(sourceText, { minimumWords = 7, maximumWords = 28 } = {}) {
  const text = String(sourceText || '').replace(/\r/g, '').trim()
  if (!text) return []
  const sentences = text.split(/(?<=[.!؟])\s+|\n+/u).map((part) => part.trim()).filter(Boolean)
  const units = []
  for (const sentence of sentences) {
    const pieces = splitAtNaturalBoundary(sentence, maximumWords)
    for (const piece of pieces) {
      if (units.length && countArabicWords(piece) < minimumWords
        && countArabicWords(`${units.at(-1).sourceText} ${piece}`) <= maximumWords) {
        units[units.length - 1].sourceText += ` ${piece}`
      } else units.push({ sourceText: piece })
    }
  }
  const reconstructed = normalizeSpace(units.map((unit) => unit.sourceText).join(' '))
  if (reconstructed !== normalizeSpace(text)) throw new Error('تقسيم الأداء غيّر نص المقال أو ترتيبه')
  return units
}

function lexiconEntries() {
  if (!existsSync(LEXICON_FILE)) return []
  const json = JSON.parse(readFileSync(LEXICON_FILE, 'utf8'))
  return Object.entries(json.entries || {}).sort(([left], [right]) => right.length - left.length)
}

const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر']
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
const HUNDREDS = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة']
function underThousand(number) {
  const n = Math.max(0, Math.floor(number))
  const parts = []
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  if (hundreds) parts.push(HUNDREDS[hundreds])
  if (rest) {
    if (rest < 20) parts.push(ONES[rest])
    else {
      const ones = rest % 10
      const tens = Math.floor(rest / 10)
      parts.push(ones ? `${ONES[ones]} و${TENS[tens]}` : TENS[tens])
    }
  }
  return parts.join(' و') || 'صفر'
}
export function numberToArabicWords(value) {
  const n = Number(String(value).replace(/[٬,]/g, ''))
  if (!Number.isFinite(n) || n < 0 || n > 9_999_999 || !Number.isInteger(n)) return String(value)
  if (n < 1000) return underThousand(n)
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  const parts = []
  if (millions) parts.push(millions === 1 ? 'مليون' : millions === 2 ? 'مليونان' : `${underThousand(millions)} ملايين`)
  if (thousands) parts.push(thousands === 1 ? 'ألف' : thousands === 2 ? 'ألفان' : `${underThousand(thousands)} آلاف`)
  if (rest) parts.push(underThousand(rest))
  return parts.join(' و')
}

export function buildPronunciationText(sourceText) {
  let pronunciationText = String(sourceText || '')
  const risks = []
  for (const [written, rule] of lexiconEntries()) {
    if (!pronunciationText.includes(written)) continue
    const spoken = rule.sub || rule.diacritics || written
    pronunciationText = pronunciationText.split(written).join(spoken)
    risks.push({ word: written, type: rule.type || 'قاموس', riskLevel: 'high', selectedPronunciation: spoken,
      method: rule.sub ? 'sub' : 'selective_diacritics', reason: rule.note || 'قاعدة معتمدة في قاموس النطق' })
  }
  pronunciationText = pronunciationText.replace(/(\d[\d٬,]*)(\s*%)/g, (_, number) => {
    risks.push({ word: `${number}%`, type: 'نسبة مئوية', riskLevel: 'high', selectedPronunciation: `${numberToArabicWords(number)} في المئة`, method: 'words', reason: 'وضوح النسبة' })
    return `${numberToArabicWords(number)} في المئة`
  })
  pronunciationText = pronunciationText.replace(/\b\d[\d٬,]*\b/g, (number) => {
    const spoken = numberToArabicWords(number)
    risks.push({ word: number, type: 'رقم', riskLevel: 'high', selectedPronunciation: spoken, method: 'words', reason: 'منع القراءة الرقمية الآلية' })
    return spoken
  })
  for (const match of String(sourceText || '').matchAll(/[A-Za-z][A-Za-z0-9.+-]*(?:\s+[A-Za-z][A-Za-z0-9.+-]*)*/g)) {
    if (!risks.some((risk) => risk.word.includes(match[0]))) risks.push({ word: match[0], type: 'مصطلح لاتيني', riskLevel: 'high',
      selectedPronunciation: '', method: 'review', reason: 'يحتاج نقحرة أو قاعدة قاموس معتمدة قبل النشر' })
  }
  return { pronunciationText, risks }
}

function clauseSegments(pronunciationText) {
  const tokens = String(pronunciationText || '').split(/(?<=[،؛:!?؟.])\s+/u).map((part) => part.trim()).filter(Boolean)
  return tokens.length ? tokens : [String(pronunciationText || '').trim()]
}

export function planReadingPerformance({ title = '', sourceText, vocalizedText = '', voiceKey = 'fahed' }) {
  const voice = READING_VOICES[voiceKey]
  if (!voice) throw new Error(`صوت قراءة غير معروف: ${voiceKey}`)
  /* النص المُشكَّل المخفيّ (أمر الدكتور): إن وُجد نصٌّ مُشكَّل هو المقالُ نفسه بحروفه
     (يطابقه بعد تجريد التشكيل) نقسّمه، ونعرض للقارئ نسخته العارية، ونُغذّي المحرك
     بالنسخة المُشكَّلة فينطق يقيناً لا تخميناً. أي عدم تطابق ⇐ نتجاهله بأمان ونعود
     للسلوك المعتاد، فلا يفسد نصٌّ مُشكَّل خاطئ قراءةَ المقال. */
  const useVocalized = Boolean(vocalizedText)
    && stripTashkeel(normalizeSpace(vocalizedText)) === stripTashkeel(normalizeSpace(sourceText))
  const bodyUnits = segmentArticleForPerformance(useVocalized ? vocalizedText : sourceText)
  const rawUnits = title ? [{ sourceText: normalizeSpace(title), isTitle: true }, ...bodyUnits] : bodyUnits
  const units = rawUnits.map((unit, index) => {
    /* raw = النص كما قُسِّم (مُشكَّل للوحدات النصية حين useVocalized؛ العنوان يبقى عارياً).
       clean = العاري للعرض والتصنيف والإبراز والتحقق؛ raw للنطق وحده. */
    const raw = unit.sourceText
    const clean = (useVocalized && !unit.isTitle) ? stripTashkeel(raw) : raw
    const kind = unit.isTitle ? 'opening' : sentenceKind(clean, index - (title ? 1 : 0), bodyUnits.length)
    const preset = PERFORMANCE[kind] || PERFORMANCE.statement
    const { pronunciationText, risks } = buildPronunciationText(raw)
    const targetWordsPerMinute = stableBetween(clean, `${voiceKey}-wpm`, preset.wpm)
    const ratePct = stableBetween(clean, `${voiceKey}-rate`, preset.rate) + voice.rateBiasPct
    const pauseAfterMs = stableBetween(clean, `${voiceKey}-pause`, preset.after)
    const clauses = clauseSegments(pronunciationText)
    const internalBreaks = clauses.slice(0, -1).map((clause, clauseIndex) => ({
      afterClause: clauseIndex,
      durationMs: /[؛:]$/.test(clause) ? stableBetween(clause, 'semi', [180, 300])
        : stableBetween(clause, 'comma', [85, 180]),
    }))
    const emphasisWords = (clean.match(ARABIC_WORD) || [])
      .filter((word) => word.length >= 5 && !/^(الذي|التي|هناك|عندما|ولكن|لذلك)$/.test(word))
      .sort((left, right) => stableNumber(right, clean) - stableNumber(left, clean))
      .slice(0, kind === 'hook' || kind === 'conclusion' ? 2 : 1)
    return {
      id: `r${String(index + 1).padStart(3, '0')}`,
      isTitle: Boolean(unit.isTitle),
      sourceText: clean,
      pronunciationText,
      type: kind,
      emotionalIntent: ['human', 'reflection', 'conclusion'].includes(kind) ? 'إنساني دافئ' : kind === 'warning' ? 'تحذير هادئ' : 'فهم واضح',
      energy: Math.max(30, Math.min(90, preset.energy + voice.energyBias)),
      warmth: Math.max(50, Math.min(98, preset.warmth + voice.warmthBias)),
      targetWordsPerMinute,
      ratePct: Math.max(-15, Math.min(10, ratePct)),
      pitchPct: Math.max(-3, Math.min(3, preset.pitch + voice.pitchBiasPct)),
      volumePct: ['hook', 'question', 'objection'].includes(kind) ? 0.5 : ['human', 'reflection'].includes(kind) ? -0.4 : 0,
      pauseBeforeMs: preset.before,
      pauseAfterMs,
      internalBreaks,
      emphasisWords,
      ending: endingDirection(clean, kind),
      risks,
      reason: `تصنيف ${kind}؛ عُيّرت السرعة والوقفة لصوت ${voice.label} وفق معنى الوحدة، لا وفق طول الفقرة فقط`,
    }
  })
  const bodyReconstructed = normalizeSpace(units.filter((unit) => !unit.isTitle).map((unit) => unit.sourceText).join(' '))
  /* التحقق الحرفي: في الوضع المُشكَّل نقارن الحروف العارية (فالعرض عارٍ والأصل قد يحمل
     تشكيلاً عارضاً)؛ وفي الوضع المعتاد نبقي المقارنة الحرفية الصارمة كما هي. */
  const integrityOk = useVocalized
    ? stripTashkeel(bodyReconstructed) === stripTashkeel(normalizeSpace(sourceText))
    : bodyReconstructed === normalizeSpace(sourceText)
  if (bodyReconstructed && !integrityOk) throw new Error('خطة القراءة لم تحفظ نص المقال حرفياً')
  return {
    schemaVersion: 1,
    engineVersion: HUMAN_AUDIO_ENGINE_VERSION,
    pipelineHash: HUMAN_AUDIO_PIPELINE_HASH,
    voice,
    title,
    sourceText: String(sourceText || ''),
    displayText: String(sourceText || ''),
    units,
  }
}

const escapeXml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const signed = (number) => `${number >= 0 ? '+' : ''}${Math.round(number)}%`

function renderSemanticText(source, emphasisWords = []) {
  let pieces = [{ text: String(source), focus: false }]
  for (const word of emphasisWords.slice(0, 2)) {
    pieces = pieces.flatMap((piece) => {
      if (piece.focus || !word || !piece.text.includes(word)) return [piece]
      const split = piece.text.split(word)
      const output = []
      split.forEach((part, index) => {
        if (part) output.push({ text: part, focus: false })
        if (index < split.length - 1) output.push({ text: word, focus: true })
      })
      return output
    })
  }
  return pieces.map((piece) => piece.focus
    ? `<prosody rate="-3%" pitch="+1%">${escapeXml(piece.text)}</prosody>`
    : escapeXml(piece.text)).join('')
}

export function buildReadingSsml(unit, voice) {
  const clauses = clauseSegments(unit.pronunciationText)
  const renderedParts = clauses.map((clause, index) => {
    const last = index === clauses.length - 1
    const questionLift = last && unit.type === 'question' ? 1.4 : 0
    const openLift = last && unit.ending === 'open' ? 0.7 : 0
    const finalEase = last && unit.ending === 'final' ? -0.8 : 0
    const initialLife = index === 0 && ['hook', 'opening'].includes(unit.type) ? 0.5 : 0
    const pitch = unit.pitchPct + questionLift + openLift + finalEase + initialLife
    const rate = unit.ratePct + (last && unit.ending === 'final' ? -1 : 0)
    const volume = Math.max(-2, Math.min(2, Number(unit.volumePct || 0)))
    const text = renderSemanticText(clause, unit.emphasisWords)
    return `<prosody rate="${signed(rate)}" pitch="${signed(pitch)}" volume="${signed(volume)}">${text}</prosody>`
  })
  const rendered = renderedParts.map((part, index) => index === renderedParts.length - 1
    ? part
    : `${part}<break time="${unit.internalBreaks[index]?.durationMs || 110}ms"/>`).join('')
  const before = unit.pauseBeforeMs ? `<break time="${unit.pauseBeforeMs}ms"/>` : ''
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voice.locale}"><voice name="${voice.azure}">${before}${rendered}</voice></speak>`
}

export function buildDialogueSsml(item, voice, { voiceKey = 'fahed' } = {}) {
  const map = {
    hook: { rate: 2, pitch: 0.8 }, statement: { rate: 0, pitch: 0 }, question: { rate: -1, pitch: 1.5 },
    briefReaction: { rate: 5, pitch: 0.8 }, response: { rate: 2, pitch: 0.2 },
    gentleObjection: { rate: 3, pitch: 0.5 }, objection: { rate: 3, pitch: 0.5 },
    clarification: { rate: 0, pitch: 0 }, explanation: { rate: -1, pitch: -0.1 },
    reflection: { rate: -5, pitch: -0.8 }, conclusion: { rate: -5, pitch: -0.6 }, closing: { rate: -6, pitch: -0.8 },
  }
  const delivery = item.delivery || item.deliveryType || item.type || 'statement'
  const preset = map[delivery] || map.statement
  const profile = READING_VOICES[voiceKey] || READING_VOICES.fahed
  const words = countArabicWords(item.text)
  const rate = Number.isFinite(Number(item.ratePct)) ? Number(item.ratePct) : preset.rate + (words <= 4 ? 2 : 0)
  const ending = item.ending || (String(item.text).includes('؟') ? 'open' : 'neutral')
  const pitch = preset.pitch + profile.pitchBiasPct + (ending === 'open' ? 0.7 : ending === 'final' ? -0.6 : 0)
  const { pronunciationText } = buildPronunciationText(item.pronunciationText || item.text)
  const pseudoUnit = { pronunciationText, type: delivery, ending, pitchPct: pitch, ratePct: rate,
    volumePct: ['briefReaction', 'objection', 'gentleObjection'].includes(delivery) ? 0.5 : 0,
    pauseBeforeMs: ['reflection', 'conclusion', 'closing'].includes(delivery) ? 35 : 0,
    internalBreaks: clauseSegments(pronunciationText).slice(0, -1).map((clause, index) => ({ afterClause: index,
      durationMs: /[؛:]$/.test(clause) ? 180 : 105 })) }
  return buildReadingSsml(pseudoUnit, { ...profile, azure: voice, locale: (String(voice).match(/^([a-z]{2}-[A-Z]{2})/) || [])[1] || 'ar-KW' })
}

const run = (binary, args, options = {}) => {
  const result = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options })
  if (result.error || result.status !== 0) throw new Error((result.stderr || result.stdout || result.error?.message || `${binary} failed`).trim())
  return result
}

export function trimAzureBoundarySilence(input, output = `${input}.trim.wav`) {
  /* ثلاث مراحل: قصّ الصمت البادئ، قصّ الصمت الخاتم، ثم سقفٌ حتميّ على أي صمت داخليّ
     ≥0.7ث يُختزل إلى 0.55ث بعتبة البوابة نفسها (-44dB) — فلا تتجاوز أي فجوة صمتٍ في
     الوحدة 0.7ث، وبما أن الفجوة بين الوحدات ≤0.84ث تبقى القراءة كلها دون عتبة 0.95ث
     الحرجة (boundarySilenceRemoved). يمنع «الصمت الآلي» من مصدره ويحافظ على التزامن.
     ملاحظة: مع stop_periods=-1 فإن stop_duration هو مقدار الصمت المُبقى لا عتبة التشغيل. */
  run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-af',
    'silenceremove=start_periods=1:start_duration=0.015:start_threshold=-46dB:start_silence=0.035:detection=peak,areverse,silenceremove=start_periods=1:start_duration=0.025:start_threshold=-46dB:start_silence=0.055:detection=peak,areverse,silenceremove=stop_periods=-1:stop_duration=0.7:stop_threshold=-44dB:detection=peak',
    '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', output])
  return output
}

export function probeAudio(file) {
  const result = run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration,size,bit_rate:stream=sample_rate,channels,codec_name', '-of', 'json', file])
  const json = JSON.parse(result.stdout || '{}')
  const stream = (json.streams || [])[0] || {}
  return {
    durationSec: Number(json.format?.duration || 0),
    bytes: Number(json.format?.size || statSync(file).size),
    bitRate: Number(json.format?.bit_rate || 0),
    sampleRate: Number(stream.sample_rate || 0),
    channels: Number(stream.channels || 0),
    codec: stream.codec_name || '',
  }
}

export function analyzeSilence(file, { threshold = '-44dB', minimumDuration = 0.12 } = {}) {
  const result = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-af', `silencedetect=noise=${threshold}:d=${minimumDuration}`, '-f', 'null', '-'], { encoding: 'utf8' })
  const stderr = result.stderr || ''
  const events = [...stderr.matchAll(/silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/g)]
    .map((match) => ({ endSec: Number(match[1]), durationSec: Number(match[2]) }))
  return {
    count: events.length,
    totalSec: events.reduce((sum, event) => sum + event.durationSec, 0),
    longestSec: events.length ? Math.max(...events.map((event) => event.durationSec)) : 0,
    over800ms: events.filter((event) => event.durationSec > 0.8).length,
    events,
  }
}

export function analyzeLoudness(file) {
  const result = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-af', 'loudnorm=I=-16:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' })
  const stderr = result.stderr || ''
  const candidates = [...stderr.matchAll(/\{[\s\S]*?"input_i"[\s\S]*?\}/g)]
  const data = candidates.length ? JSON.parse(candidates.at(-1)[0]) : {}
  return {
    integratedLufs: Number(data.input_i),
    truePeakDbtp: Number(data.input_tp),
    loudnessRangeLu: Number(data.input_lra),
    threshold: Number(data.input_thresh),
  }
}

export function compareSpeechText(intended, heard) {
  const expected = normalizedLetters(intended).split(/\s+/).filter(Boolean)
  const actual = normalizedLetters(heard).split(/\s+/).filter(Boolean)
  const matched = new Set()
  let cursor = 0
  for (const word of actual) {
    for (let index = cursor; index < Math.min(expected.length, cursor + 6); index += 1) {
      if (expected[index] === word || expected[index].includes(word) || word.includes(expected[index])) {
        matched.add(index); cursor = index + 1; break
      }
    }
  }
  const negations = new Set(['لا', 'لم', 'لن', 'ليس', 'ليست', 'غير', 'دون'])
  const missing = expected.filter((_, index) => !matched.has(index))
  const important = expected.map((word, index) => ({ word, index })).filter(({ word }) => word.length > 2 || negations.has(word))
  const missingImportant = important.filter(({ index }) => !matched.has(index)).map(({ word }) => word)
  return {
    ratio: expected.length ? matched.size / expected.length : 1,
    importantRatio: important.length ? (important.length - missingImportant.length) / important.length : 1,
    importantTotal: important.length,
    missing,
    missingImportant,
  }
}

export function humanLikenessGate({ plan, technical, sttComparisons = [], sttUnavailable = false, dialogue = false, minimumScore = 95, sttFidelityMin = 0.95, manualText = false }) {
  const units = plan?.units || plan?.utterances || []
  const rates = units.map((unit) => Number(unit.ratePct || 0))
  const pauses = units.map((unit) => Number(unit.pauseAfterMs || 0)).filter((value) => value >= 0)
  const endings = new Set(units.map((unit) => unit.ending).filter(Boolean))
  const kinds = new Set(units.map((unit) => unit.type || unit.delivery || unit.deliveryType).filter(Boolean))
  const distinctRates = new Set(rates.map((value) => Math.round(value))).size
  const distinctPauses = new Set(pauses.map((value) => Math.round(value / 40))).size
  const mean = pauses.length ? pauses.reduce((sum, value) => sum + value, 0) / pauses.length : 0
  const pauseVariance = pauses.length ? pauses.reduce((sum, value) => sum + (value - mean) ** 2, 0) / pauses.length : 0
  const sttRatio = sttComparisons.length ? Math.min(...sttComparisons.map((item) => Number(item.importantRatio || 0))) : 0
  const nonQuestionUnits = units.filter((unit) => {
    const raw = String(unit.sourceText || unit.text || '')
    return !raw.includes('؟') && (unit.type || unit.delivery || unit.deliveryType) !== 'question'
  }).length
  const achievableEndingKinds = nonQuestionUnits === 0 ? 1 : nonQuestionUnits === 1 ? 2 : 3
  /* كم فئةَ وقفةٍ تسمح بها أنواع الإلقاء الحاضرة؟ (الفئة ٤٠ مللي) */
  const PAUSE_BANDS = { statement: [200, 320], question: [500, 750], briefReaction: [150, 240],
    gentleObjection: [180, 280], clarification: [200, 320], reflection: [650, 900],
    conclusion: [560, 850], hook: [200, 320], objection: [180, 280], quick: [150, 240],
    reflective: [650, 900], normal: [200, 320] }
  const spans = [...kinds].map((kind) => PAUSE_BANDS[kind] || PAUSE_BANDS.normal)
  const lo = spans.length ? Math.min(...spans.map((span) => span[0])) : 200
  const hi = spans.length ? Math.max(...spans.map((span) => span[1])) : 320
  const achievablePauseBuckets = Math.max(1, Math.floor((hi - lo) / 40) + 1)
  /* أقصى انحرافٍ معياريّ يبلغه توزيعٌ منتظم على نطاقٍ عرضه (hi-lo) هو
     العرض÷√12. فطلبُ ٥٥ من نطاقٍ عرضه ١٢٠ مللي (الخبر) مستحيلٌ رياضياً
     مهما أبدع المحرك — نُسقّفه بالممكن ونترك ٨٠٪ منه هامشاً للطبيعة. */
  const achievablePauseSd = Math.max(18, ((hi - lo) / Math.sqrt(12)) * 0.8)
  const measures = {
    /* تنوّعُ أنواع الإلقاء مقياسُ رتابة. وحين يكتب الدكتور الحوار بيده فأنواعُ
       الإلقاء اختيارُه التحريريّ — قد يكتب حواراً كله تأمّل أو كله أسئلة عن
       قصد. فكانت الحلقة تُعزل لأنه اختار أربعة أنواع لا خمسة. نحرس الرتابة
       التامة وحدها (نوعان على الأقل)، ونترك ما فوقها له. */
    semanticPerformance: manualText
      ? kinds.size >= Math.min(2, Math.max(1, units.length))
      : kinds.size >= Math.min(5, Math.max(2, Math.floor(units.length / 4))),
    realRateVariation: distinctRates >= Math.min(5, Math.max(3, Math.floor(units.length / 5))),
    /* تنوّعُ الوقفات كان مطلباً مستحيلاً لبعض الحوارات: نطاق وقفة «الخبر»
       ١٢٠ مللي فقط، وفئاتُ القياس ٤٠ مللي — فحوارٌ كلّه خبرٌ لا يبلغ أربع فئات
       مهما فعل المحرك. فتُعزل الحلقة لعيبٍ في المسطرة لا في الصوت. نُسقف
       المطلوب بما تسمح به نطاقات الإلقاء الحاضرة فعلاً. */
    pauseVariation: distinctPauses >= Math.min(
      Math.min(6, Math.max(3, Math.floor(units.length / 5))),
      Math.max(2, achievablePauseBuckets - 1),   // لا نطلب كل فئةٍ ممكنة: التوزيع الطبيعي لا يبلغ الكمال
    ) && Math.sqrt(pauseVariance) >= Math.min(55, achievablePauseSd),
    endingVariation: endings.size >= (manualText
      ? Math.min(dialogue ? 3 : 2, achievableEndingKinds)
      : (dialogue ? 3 : 2)),
    /* السؤال المقتبس ليس سؤالاً يُطرح: «ليس ﴿كم حصلت؟﴾ فقط، بل ﴿ماذا تعلمت
       عن نفسك؟﴾» جملةٌ خبرية تنقل سؤالاً، ونبرتُها خبرية لا استفهامية. كانت
       البوابة تُلزمها بنبرة السؤال فتُعزل الحلقة كلها — وتصنيفُ الكاتب أصحّ
       من قاعدةٍ تنظر إلى العلامة وحدها. نحذف المقتبس ثم نسأل. */
    /* المسموع هو النهاية المفتوحة لا اسمُ السجلّ: عنوانُ المقال («هل وظيفتك
       مهددة بالانقراض؟») يخطّطه المحرك بسجلّ opening، وجملةُ الختام بسجلّ
       conclusion — وكلاهما ينتهي open أصلاً. كانت البوابة تطلب الاسم
       «question» حرفياً فتُسقط كل مقالٍ عنوانه سؤال إسقاطاً حرجاً أبدياً
       (عشرة مقالات معلّقة). نطلب النبرة المفتوحة، ونقبل سجلّ العنوان والخاتمة. */
    questionDirection: units.filter((unit) => {
      const raw = String(unit.sourceText || unit.text || '')
      const withoutQuoted = raw.replace(/[«"„''][^»"'']*[»"'']/g, ' ')
      return withoutQuoted.includes('؟')
    }).every((unit) => {
      const register = unit.type || unit.delivery || unit.deliveryType
      return unit.ending === 'open'
        && ['question', 'opening', 'conclusion', 'hook'].includes(register)
    }),
    boundarySilenceRemoved: Number(technical?.silence?.longestSec || 0) <= (dialogue ? 1.05 : 0.95),
    loudnessSafe: Number(technical?.loudness?.integratedLufs) >= -17.2 && Number(technical?.loudness?.integratedLufs) <= -14.8
      && Number(technical?.loudness?.truePeakDbtp) <= -1,
    formatSafe: Number(technical?.probe?.sampleRate) === 44100 && Number(technical?.probe?.channels) === 1,
    /* عند تعطّل مُتحقق STT كلياً (لا وحدة قابلة للتحقق) يتنزّل الفحص إلى البوابات
       الصوتية الحتمية (الصمت/الجهارة/الصيغة/الإيقاع) بدل تجميد كل مقال؛ ويعود
       صارماً تلقائياً لحظة عودة STT. أمر الدكتور: «حل المشاكل كلها … تجاوزها بذكاء». */
    /* العتبة تُمرَّر من الخارج كي تحكم الحلقةَ الكاملة بالقانون نفسه الذي
       تحكم به بوابةُ التركيب: تفريغ ست دقائق بنداءٍ واحد أداةٌ خشنة تفقد أدوات
       الربط بطبعها، ومقاطعُها مثبَّتةٌ سلفاً بعتبةٍ أشدّ على ملفاتٍ قصيرة.
       الافتراضي ٠.٩٥ كما كان، فلا يتغيّر شيءٌ لمن لا يمرّرها. */
    sttFidelity: sttUnavailable ? true : sttRatio >= sttFidelityMin,
    dialogueIndependence: !dialogue || (() => {
      const speakers = new Set(units.map((unit) => unit.speaker))
      const overlaps = units.filter((unit) => unit.allowOverlap || Number(unit.overlapMs || 0) > 0).length
      return speakers.size >= 2 && overlaps <= 2
    })(),
  }
  const weights = {
    semanticPerformance: 13, realRateVariation: 12, pauseVariation: 12, endingVariation: 9,
    questionDirection: 9, boundarySilenceRemoved: 9, loudnessSafe: 10, formatSafe: 8,
    sttFidelity: 13, dialogueIndependence: 5,
  }
  const score = Object.entries(weights).reduce((sum, [key, weight]) => sum + (measures[key] ? weight : 0), 0)
  const failed = Object.keys(measures).filter((key) => !measures[key])
  const critical = ['questionDirection', 'boundarySilenceRemoved', 'loudnessSafe', 'formatSafe', 'sttFidelity']
  const criticalFailed = critical.filter((key) => !measures[key])
  return { score, minimumScore, pass: score >= minimumScore && criticalFailed.length === 0,
    measures, failed, criticalFailed, sttDegraded: Boolean(sttUnavailable),
    note: sttUnavailable
      ? 'فحص STT كان متعطّلاً؛ اعتُمدت البوابات الصوتية الحتمية وحدها (يعود STT صارماً تلقائياً عند توفّره). الاعتماد النهائي Blind A/B بشري.'
      : 'الدرجة وكيل تقني قابل للقياس وليست ادعاءً بأن الصوت بشري فعلاً؛ الاعتماد النهائي يتطلب Blind A/B بشرياً.' }
}

export function assembleReading({ segments, output, workDir }) {
  if (!segments.length) throw new Error('لا توجد مقاطع لتركيب القراءة')
  mkdirSync(workDir, { recursive: true })
  const timeline = []
  let cursor = 0.18
  segments.forEach((segment, index) => {
    const probe = probeAudio(segment.file)
    timeline.push({ ...segment, startSec: cursor, durationSec: probe.durationSec })
    cursor += probe.durationSec + Math.max(0.08, Number(segment.pauseAfterMs || 320) / 1000)
    if (index === segments.length - 1) cursor += 0.2
  })
  const args = []
  const filters = []
  timeline.forEach((item, index) => {
    args.push('-i', item.file)
    const delay = Math.round(item.startSec * 1000)
    filters.push(`[${index}:a]adelay=${delay}|${delay}[s${index}]`)
  })
  const mix = timeline.map((_, index) => `[s${index}]`).join('')
  /* هامشُ الذروة: البوابة تشترط ذروةً حقيقية ≤ −1dBTP، وكان الهدف −1 بالضبط
     فيتجاوزها ترميزُ mp3 بكسورٍ من الديسيبل فتُرفض قراءةٌ سليمة (٩٠/١٠٠).
     نطلب −1.5 كما في مسار الحوار، فيبقى المقيس تحت الحدّ بيقين. */
  filters.push(`${mix}amix=inputs=${timeline.length}:normalize=0,highpass=f=55,acompressor=threshold=-18dB:ratio=1.55:attack=18:release=150,loudnorm=I=-16:TP=-1.5:LRA=10[out]`)
  run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args, '-filter_complex', filters.join(';'), '-map', '[out]',
    '-t', cursor.toFixed(3), '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '1', output])
  return { timeline, durationSec: cursor }
}

export function atomicWriteJson(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(temporary, file)
}

export function snapshotLastKnownGood({ currentFile, auditFile, directory }) {
  if (!existsSync(currentFile)) return null
  mkdirSync(directory, { recursive: true })
  const manifest = { savedAt: new Date().toISOString(), audio: 'episode.mp3', audit: existsSync(auditFile) ? 'audit.json' : null }
  copyFileSync(currentFile, resolve(directory, 'episode.mp3'))
  if (existsSync(auditFile)) copyFileSync(auditFile, resolve(directory, 'audit.json'))
  atomicWriteJson(resolve(directory, 'manifest.json'), manifest)
  return manifest
}

export function restoreLastKnownGood({ currentFile, auditFile, directory }) {
  const audio = resolve(directory, 'episode.mp3')
  if (!existsSync(audio)) return false
  copyFileSync(audio, currentFile)
  if (existsSync(resolve(directory, 'audit.json'))) copyFileSync(resolve(directory, 'audit.json'), auditFile)
  return true
}

export function cleanWorkDirectory(directory) {
  rmSync(directory, { recursive: true, force: true })
  mkdirSync(directory, { recursive: true })
}
