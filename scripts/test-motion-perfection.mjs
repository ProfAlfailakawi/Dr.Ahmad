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
const procedural = read('src/lib/procedural-world-engine.ts')
const diversity = read('src/lib/perceptual-diversity.ts')
const audits = read('src/lib/world-audits.ts')
const gallery = read('src/components/admin/DesignWorldsGallery.tsx')

const worldSpecBlock = worlds.slice(worlds.indexOf('const WORLD_SPECS'), worlds.indexOf('function makeWorld'))
const masterIds = [...worldSpecBlock.matchAll(/\{id:'([^']+)'/g)].map((m) => m[1])
const familyIds = ['cosmic','editorial','organic','architectural','kuwait-gulf','technology-data','cinematic','quiet-luxury','typographic','surreal','human-emotional','experimental','academic-knowledge','media-society','education-childhood','material-environment']
const requiredLayouts = [
  'Poster Monument', 'Editorial Stack', 'Modular Brief', 'Infographic Argument', 'Split Contrast', 'Central Emblem',
  'Quote Architecture', 'Timeline Path', 'Data Narrative', 'Cinematic Frame', 'Typographic Field', 'Minimal Thesis',
]
const semanticVerbs = ['root','connect','split','rise','weave','orbit','pulse','path','question','balance','reveal','dissolve','fracture','gather','protect','liberate','echo','breathe','transform','confront']

const checks = [
  ['فيديو المنشور مربوط بالواجهة', /downloadDesignVideo\(draftPlan/.test(publishing)],
  ['ثلاث مدد للحركة', ['loop', 'hook', 'argument'].every((id) => new RegExp(`${id}:`).test(designMotion))],
  ['فعل بصري مستنتج من العبارة', /analyzeWorldSemantics/.test(designMotion) && /analyzeWorldSemantics/.test(reelScenes)],
  ['20 فعلاً دلالياً', semanticVerbs.every((verb) => worlds.includes(`'${verb}'`))],
  ['تحول الختم إلى استعارة', /drawMorphingSeal/.test(designMotion) && /paintMetaphor/.test(designMotion)],
  ['السؤال والاتزان بلا أيقونات مبتذلة', !/fillText\('؟'/.test(designMotion) && /إعادة توزيع الكتلة/.test(designMotion)],
  ['ساعة صامتة تحفظ مدة الملف', /buildSilentClock/.test(designMotion)],
  ['MediaRecorder يفشل بوضوح', /recorder\.onerror/.test(designMotion) && /recorder\.onerror/.test(reelMotion)],
  ['الملف المسجل يُفحص فعلياً', /probeRecordedVideo/.test(designMotion) && /frameCount/.test(designMotion) && /probeReelVideo/.test(reelMotion) && /frameCount/.test(reelMotion)],
  ['الافتتاح ليس شعاراً عاماً', !/line:\s*['"]الإنسان قبل الآلة['"]/.test(reelScenes)],
  ['لا قصّ أعمى للجمل', !/function\s+tightLine/.test(reelScenes)],
  ['لفّ النص داخل إطار الريل', /fitTextBlock/.test(reelMotion) && /writeTextBlock/.test(reelMotion) && /measureText/.test(reelMotion)],
  ['بوابة Safe Zone للريل', /SAFE_LEFT/.test(reelMotion) && /auditReelTextFit/.test(reelMotion)],
  ['بوابات جودة للعوالم والحركة والريل', ['WorldAudit', 'MotionAudit', 'ReelAudit'].every((name) => new RegExp(`export function ${name}`).test(audits))],
  ['ذاكرة تنويع إدراكي آخر 20 بصمة', /MAX_MEMORY\s*=\s*20/.test(diversity) && /greedyMaxMin/.test(diversity)],
  ['64 Master Worlds متمايزة', masterIds.length === 64 && new Set(masterIds).size === 64],
  ['16 عائلة إبداعية', familyIds.length === 16 && familyIds.every((id) => worlds.includes(`'${id}'`)) && /WORLD_FAMILY_OPTIONS/.test(worlds)],
  ['12 عائلة تخطيط منشور', requiredLayouts.every((name) => worlds.includes(`'${name}'`))],
  ['محرك Procedural حتمي كامل', ['generateProceduralWorld','deterministicSeed','perceptualSignature','materialProfile','motionProfile','layoutGenome','paletteGenome','typographyGenome','depthGenome','audioGenome'].every((token) => procedural.includes(token))],
  ['World Fusion يتجاوز خلط اللون', /export function fuseWorlds/.test(procedural) && /layout/.test(procedural) && /motion/.test(procedural) && /lighting/.test(procedural)],
  ['المعرض Lazy ولا يشغّل 64 Canvas', /IntersectionObserver/.test(gallery) && !/<canvas/i.test(gallery)],
  ['المعرض يدعم البحث والمقارنة والاندماج والأقفال', /Controlled/.test(gallery) && /fuseWorlds/.test(gallery) && /compare/.test(gallery) && /locks/.test(gallery)],
  ['الريل 5–8 مشاهد و18–30 ثانية', /scenes\.length < 5/.test(reelScenes) && /scenes\.length > 8/.test(reelScenes) && /plan\.seconds < 18/.test(reelMotion) && /plan\.seconds > 30/.test(reelMotion)],
  ['الصوت اختياري في الريل', /audio\?: boolean/.test(reelMotion) && /options\.audio !== false/.test(reelMotion)],
  ['Seed cache محدود وحقيقي', /PROCEDURAL_CACHE_LIMIT\s*=\s*256/.test(procedural) && /proceduralWorldCacheStats/.test(procedural) && /cacheHits/.test(procedural)],
  ['Fusion يملك Compatibility Gate', /assessFusionCompatibility/.test(procedural) && /Fusion مرفوض/.test(procedural) && /contrast<4\.5/.test(procedural)],
  ['Greedy Max-Min يفرض مسافة دنيا ويستبعد الذاكرة', /selectPerceptuallyDiverse/.test(diversity) && /minDistance/.test(diversity) && /excludeSignatures/.test(diversity)],
  ['المعاينة الحية عند الطلب وتُلغى خارج الشاشة', /onMouseEnter/.test(gallery) && /حرّك المعاينة/.test(gallery) && /cancelAnimationFrame/.test(gallery) && /setVisible\(Boolean\(entry\?\.isIntersecting\)\)/.test(gallery)],
  ['كل Master Worlds متاحة لمحرك الريل', /MASTER_WORLD_ORDER\.map/.test(reelScenes) && /MASTER_REEL_WORLDS/.test(reelScenes)],
  ['الريل يمنع fallback font قبل التصدير', /auditReelFonts/.test(reelMotion) && /document\.fonts/.test(reelMotion) && /fallbackFont/.test(reelMotion)],
  ['الفيديو يدعم ملفات زمنية قابلة للتوسعة', /registerMotionProfile/.test(designMotion) && /recommendMotionProfile/.test(designMotion)],
  ['بوابات الجودة تشمل العقوبات الحرجة', ['clipped-text','duplicate-phrases','excess-glow','overcrowded','logo-distorted','meaningless-motion','generic-opening','repeated-cta','fallback-font','wrong-duration','single-frame','cheap-ornament','palette-only'].every((id)=>audits.includes(`'${id}'`))],
]

const failed = checks.filter(([, ok]) => !ok)
for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`)
if (failed.length) {
  console.error(`\nفشل ${failed.length} من فحوص الحركة والعوالم.`)
  process.exit(1)
}
console.log(`\n✓ اكتملت ${checks.length} بوابة حركة وعوالم وتنوّع.`)
