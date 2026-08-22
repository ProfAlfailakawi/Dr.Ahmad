import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const designMotion = read('src/lib/design-motion.ts')
const publishing = read('src/components/admin/PublishingStudio.tsx')
const reelScenes = read('src/lib/reel-scenes.ts')
const reelMotion = read('src/lib/reel-motion.ts')
const worlds = read('src/lib/design-worlds.ts')

const checks = [
  ['فيديو المنشور مربوط بالواجهة', /downloadDesignVideo\(draftPlan/.test(publishing)],
  ['ثلاث مدد للحركة', ['loop', 'hook', 'argument'].every((id) => new RegExp(`${id}:`).test(designMotion))],
  ['فعل بصري مستنتج من العبارة', /semanticMotionVerb/.test(designMotion) && /motionVerb/.test(reelScenes)],
  ['تحول الختم إلى استعارة', /drawMorphingSeal/.test(designMotion) && /paintMetaphor/.test(designMotion)],
  ['ساعة صامتة تحفظ مدة الملف', /buildSilentClock/.test(designMotion)],
  ['الافتتاح ليس شعاراً عاماً', !/line:\s*['"]الإنسان قبل الآلة['"]/.test(reelScenes)],
  ['لا قصّ أعمى للجمل', !/function\s+tightLine/.test(reelScenes)],
  ['لفّ النص داخل إطار الريل', /fitTextBlock/.test(reelMotion) && /writeTextBlock/.test(reelMotion)],
  ['بوابة جودة للريل', /auditReelPlan/.test(reelScenes) && /بوابة الريل/.test(read('src/components/admin/ReelStudio.tsx'))],
  ['ذاكرة تنويع إدراكي', /reelPerceptualSignature/.test(reelScenes) && /usedSignatures/.test(reelScenes)],
  ['اثنا عشر عالم منشور', /12 دستوراً متكاملاً|WORLD_ORDER\.length/.test(read('src/components/admin/DesignWorldsGallery.tsx')) && ['copper-eclipse', 'indigo-archive', 'emerald-atlas', 'coral-future'].every((id) => worlds.includes(`'${id}'`))],
  ['عوالم ريل جديدة', ['desert-signal', 'porcelain-cyan', 'coral-future'].every((id) => reelScenes.includes(`'${id}'`))],
]

const failed = checks.filter(([, ok]) => !ok)
for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`)
if (failed.length) {
  console.error(`\nفشل ${failed.length} من فحوص الحركة.`)
  process.exit(1)
}
console.log(`\n✓ اكتملت ${checks.length} بوابة حركة وتنوّع.`)
