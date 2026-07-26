import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildEliteStudioImagePrompt } from '../server.mjs'

const glossary = JSON.parse(readFileSync(new URL('../src/data/dr-ahmad-domain-glossary.json', import.meta.url), 'utf8'))
assert.ok(Array.isArray(glossary))
assert.ok(glossary.length >= 280, 'The personal glossary must cover the multidisciplinary CV and modern educational-technology vocabulary.')
assert.equal(new Set(glossary.map((entry) => entry.id)).size, glossary.length, 'Glossary ids must be unique.')
for (const entry of glossary) {
  assert.ok(entry.canonicalAr && entry.canonicalEn && entry.meaningAr)
  assert.ok(Array.isArray(entry.aliases) && entry.aliases.length >= 2)
  assert.ok(Array.isArray(entry.visualScenes) && entry.visualScenes.length >= 2)
  assert.ok(Array.isArray(entry.avoid))
  assert.ok(Array.isArray(entry.moods) && entry.moods.length >= 1)
  assert.ok(Array.isArray(entry.preferredWorlds) && entry.preferredWorlds.length >= 1)
}

const cases = [
  ['تلعيب', 'Gamification'],
  ['مودل', 'Moodle'],
  ['سحابية', 'Cloud Computing'],
  ['ذوي', 'Assistive Technology'],
  ['ماينكرافت', 'Minecraft Education'],
  ['جدول', 'University Scheduling'],
  ['TAM', 'Technology Acceptance'],
  ['SPSS', 'SPSS Data Analysis'],
  ['شات', 'ChatGPT in Education'],
  ['جودة', 'Quality and Academic Accreditation'],
  ['ميتافيرس', 'Metaverse in Education'],
  ['برومبت', 'Prompt Engineering'],
  ['RAG', 'Retrieval-Augmented Generation'],
  ['XAI', 'Explainable AI'],
  ['ADDIE', 'ADDIE Model'],
  ['UDL', 'Universal Design for Learning'],
  ['SCORM', 'SCORM'],
  ['بلوم', 'Bloom Taxonomy'],
  ['ألفا', 'Cronbach Alpha'],
  ['فاشنستات', 'Influencer Culture'],
  ['موسوعة', 'Educational Technology Encyclopedia'],
]

for (const [idea, canonical] of cases) {
  const prompt = buildEliteStudioImagePrompt({
    idea,
    issue: idea,
    context: 'A precise Dr Ahmad educational editorial visual',
    orientation: 'portrait',
    regenerationId: `glossary-${idea}`,
    recentVisualWorlds: [],
  })
  assert.match(prompt, new RegExp(canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `The first word “${idea}” must resolve to ${canonical}.`)
}

// Cloud Run no longer needs to COPY the large glossary file: the browser sends a
// validated synthetic concept profile, and the server must honour it directly.
const syntheticPrompt = buildEliteStudioImagePrompt({
  idea: 'مصطلح مركب جديد',
  issue: 'مصطلح مركب جديد في التعليم',
  context: 'تعليم جامعي',
  orientation: 'portrait',
  glossaryConcept: 'compound-custom-concept',
  glossaryLabel: 'مفهوم د. أحمد المركب',
  glossaryCanonicalEn: 'Dr Ahmad Compound Concept',
  glossaryMeaning: 'معنى تخصصي مركب أرسله الرسم المعرفي من الواجهة إلى الخادم.',
  glossaryScenes: ['مشهد تعليمي مضيء يربط المفهوم بالجمهور والغاية'],
  glossaryAvoid: ['صورة عامة بلا معنى'],
  preferredWorlds: ['sunlit-campus'],
  moods: ['bright', 'human'],
  regenerationId: 'synthetic-profile',
})
assert.match(syntheticPrompt, /Dr Ahmad Compound Concept/i)
assert.match(syntheticPrompt, /sunlit contemporary campus/i)
assert.match(syntheticPrompt, /معنى تخصصي مركب/i)

const positivePrompt = buildEliteStudioImagePrompt({
  idea: 'تلعيب',
  issue: 'التلعيب في التعليم',
  context: 'تعليم جامعي',
  orientation: 'portrait',
  regenerationId: 'positive-gamification',
  recentVisualWorlds: [],
})
assert.match(positivePrompt, /optimistic|daylight|luminous|alive/i)
assert.match(positivePrompt, /Do not make the scene sad, gloomy, lonely, ominous/i)

const forcedWorlds = [
  ['playful-systems', /gameful learning system|achievement tokens|progress markers/i],
  ['sunlit-campus', /sunlit contemporary campus|airy architecture/i],
  ['living-learning-lab', /hands-on learning laboratory|real prototypes/i],
  ['kinetic-collage', /editorial photographic collage|dynamic diagonals/i],
  ['spatial-learning', /spatial learning installation|layered depth/i],
]
const forcedWorldPrompts = forcedWorlds.map(([world, expected], index) => {
  const prompt = buildEliteStudioImagePrompt({
    idea: 'تلعيب', issue: 'التلعيب في التعليم', context: 'تعليم جامعي', orientation: 'portrait',
    glossaryConcept: 'gamification', glossaryLabel: 'التلعيب', glossaryCanonicalEn: 'Gamification',
    glossaryMeaning: 'توظيف عناصر الألعاب مثل النقاط والمستويات والشارات لتحفيز التعلم، وليس التلاعب.',
    glossaryScenes: ['رحلة تعلم راقية تتدرج عبر مستويات واضحة وشارات إنجاز'],
    glossaryAvoid: ['التلاعب', 'الممرات المظلمة', 'الفصل الفارغ الحزين'],
    preferredWorlds: [world], moods: ['bright', 'playful', 'energetic'], regenerationId: `world-${index}`,
  })
  assert.match(prompt, expected)
  return prompt
})
assert.equal(new Set(forcedWorldPrompts).size, forcedWorlds.length, 'The generated batch must contain genuinely distinct visual worlds.')

console.log(JSON.stringify({
  ok: true,
  glossaryEntries: glossary.length,
  firstWordCases: cases.length,
  syntheticCloudRunProfile: true,
  positiveMoodGuard: true,
  distinctVisualWorlds: forcedWorldPrompts.length,
}, null, 2))
