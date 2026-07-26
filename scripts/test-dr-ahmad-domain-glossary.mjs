import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildEliteStudioImagePrompt } from '../server.mjs'

const glossary = JSON.parse(readFileSync(new URL('../src/data/dr-ahmad-domain-glossary.json', import.meta.url), 'utf8'))
assert.ok(Array.isArray(glossary))
assert.ok(glossary.length >= 80, 'The personal glossary must cover the full multidisciplinary CV, not one isolated term.')
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

const forcedWorldPrompts = [
  ['playful-systems', /gameful learning system|achievement tokens|progress markers/i],
  ['daylight-learning', /bright premium educational editorial|generous daylight/i],
  ['color-field-editorial', /editorial color-field|optimistic color/i],
].map(([world, expected], index) => {
  const prompt = buildEliteStudioImagePrompt({
    idea: 'تلعيب', issue: 'التلعيب في التعليم', context: 'تعليم جامعي', orientation: 'portrait',
    preferredWorlds: [world], moods: ['bright', 'playful', 'energetic'], regenerationId: `world-${index}`,
  })
  assert.match(prompt, expected)
  return prompt
})
assert.equal(new Set(forcedWorldPrompts).size, 3, 'The generated design batch must contain genuinely distinct visual worlds.')

console.log(JSON.stringify({ ok: true, glossaryEntries: glossary.length, firstWordCases: cases.length, positiveMoodGuard: true, distinctVisualWorlds: forcedWorldPrompts.length }, null, 2))
