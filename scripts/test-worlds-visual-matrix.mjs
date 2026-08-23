#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'

const root=process.cwd(), read=(file)=>readFile(resolve(root,file),'utf8')
const dataUrl=(source)=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
function transpile(source,fileName){const out=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,strict:true},reportDiagnostics:true,fileName});const errs=(out.diagnostics||[]).filter((d)=>d.category===ts.DiagnosticCategory.Error);assert.equal(errs.length,0,`${fileName} transpile diagnostics: ${errs.map((e)=>e.code).join(',')}`);return out.outputText}
const rep=(source,spec,url)=>source.replaceAll(`'${spec}'`,`'${url}'`).replaceAll(`"${spec}"`,`"${url}"`)

// Build the real social-design runtime exactly like its canonical self-test.
const glossaryJson=await read('src/data/dr-ahmad-domain-glossary.json')
let glossaryOut=transpile((await read('src/lib/dr-ahmad-domain-glossary.ts')).replace(/^import\s+glossaryData\s+from\s+['"]\.\.\/data\/dr-ahmad-domain-glossary\.json['"][^\n]*$/m,`const glossaryData = ${glossaryJson}`),'dr-ahmad-domain-glossary.ts')
const glossaryUrl=dataUrl(glossaryOut)
const countUrl=dataUrl(transpile(await read('src/lib/arabic-count.ts'),'arabic-count.ts'))
let ideaOut=transpile(await read('src/lib/idea-dna.ts'),'idea-dna.ts'); ideaOut=rep(ideaOut,'./dr-ahmad-domain-glossary',glossaryUrl); const ideaUrl=dataUrl(ideaOut)
const designSystemUrl=dataUrl(transpile(await read('src/lib/design-system.ts'),'design-system.ts'))
let engineOut=transpile(await read('src/lib/social-design-engine.ts'),'social-design-engine.ts')
engineOut=rep(engineOut,'./dr-ahmad-domain-glossary',glossaryUrl);engineOut=rep(engineOut,'./idea-dna',ideaUrl);engineOut=rep(engineOut,'./arabic-count.ts',countUrl);engineOut=rep(engineOut,'./design-system',designSystemUrl)
const engineUrl=dataUrl(engineOut), engine=await import(engineUrl)

let worldsOut=transpile(await read('src/lib/design-worlds.ts'),'design-worlds.ts'); worldsOut=rep(worldsOut,'./social-design-engine',engineUrl); const worldsUrl=dataUrl(worldsOut), worlds=await import(worldsUrl)
let semanticsOut=transpile(await read('src/lib/world-semantics.ts'),'world-semantics.ts'); semanticsOut=rep(semanticsOut,'./design-worlds',worldsUrl); const semanticsUrl=dataUrl(semanticsOut)
let procOut=transpile(await read('src/lib/procedural-world-engine.ts'),'procedural-world-engine.ts'); procOut=rep(procOut,'./design-worlds',worldsUrl);procOut=rep(procOut,'./world-semantics',semanticsUrl);procOut=rep(procOut,'./social-design-engine',engineUrl); const procUrl=dataUrl(procOut), procedural=await import(dataUrl(procOut))
let auditsOut=transpile(await read('src/lib/world-audits.ts'),'world-audits.ts');auditsOut=rep(auditsOut,'./design-worlds',worldsUrl);auditsOut=rep(auditsOut,'./procedural-world-engine',procUrl);const auditsUrl=dataUrl(auditsOut),audits=await import(auditsUrl)
let diversityOut=transpile(await read('src/lib/perceptual-diversity.ts'),'perceptual-diversity.ts');diversityOut=rep(diversityOut,'./social-design-engine',engineUrl);diversityOut=rep(diversityOut,'./procedural-world-engine',procUrl);const diversity=await import(dataUrl(diversityOut))

const seasonUrl=dataUrl(`export const currentSeason=()=>({id:'none',label:'',kind:'none'});export const seasonStrokePath=()=>'';`)
let rendererOut=transpile(await read('src/lib/social-design-renderer.ts'),'social-design-renderer.ts');rendererOut=rep(rendererOut,'./social-design-engine',engineUrl);rendererOut=rep(rendererOut,'./seasons',seasonUrl);const renderer=await import(dataUrl(rendererOut))

const metaphorUrl=dataUrl(transpile(await read('src/lib/reel-metaphors.ts'),'reel-metaphors.ts'))
let reelScenesOut=transpile(await read('src/lib/reel-scenes.ts'),'reel-scenes.ts')
for(const [spec,url] of [['./social-design-engine',engineUrl],['./arabic-count.ts',countUrl],['./dr-ahmad-domain-glossary',glossaryUrl],['./reel-metaphors',metaphorUrl],['./world-semantics',semanticsUrl],['./world-audits',auditsUrl],['./design-worlds',worldsUrl]]) reelScenesOut=rep(reelScenesOut,spec,url)
const reelScenesUrl=dataUrl(reelScenesOut), reelScenes=await import(reelScenesUrl)
let timelineOut=transpile(await read('src/lib/reel-timeline.ts'),'reel-timeline.ts');timelineOut=rep(timelineOut,'./reel-scenes',reelScenesUrl);const reelTimeline=await import(dataUrl(timelineOut))


const motionSource=await read('src/lib/design-motion.ts');assert.match(motionSource,/durationMs:\s*4_800/);assert.match(motionSource,/durationMs:\s*9_000/);assert.match(motionSource,/durationMs:\s*16_800/);assert.match(motionSource,/registerMotionProfile/);assert.match(motionSource,/probeRecordedVideo/)

const phrases=[
  ['جيل بلا جذور','تربوية'],
  ['ذكاء بلا ضمير','تقنية أخلاقية'],
  ['التقييم لا يختصر الإنسان','تعليمية'],
  ['الصمت في زمن الضجيج','تأملية'],
  ['حين تصبح التقنية قائداً','تحول'],
  ['أشتاق إلى المسافة التي كانت تجمعنا','عاطفية'],
  ['تشير الأدلة إلى أن جودة السؤال تؤثر في عمق التعلم','أكاديمية'],
  ['الديوانية مو بس مكان، هي مساحة تصنع الحوار','كويتية'],
  ['العدالة','كلمة واحدة'],
  ['هل نقيس الطالب بما يحفظه فقط، أم نبحث عمّا يفهمه ويصنعه؟ حين يتحول التقييم إلى رقم واحد نخسر الإنسان، لكن حين يصبح دليلاً للتعلم نفتح طريقاً آخر.','طويلة بتضاد وسؤال'],
]

const outDir='/mnt/data/world-visual-proof'
await rm(outDir,{recursive:true,force:true});await mkdir(outDir,{recursive:true})
const reports=[]
for(let phraseIndex=0;phraseIndex<phrases.length;phraseIndex+=1){
  const [text,label]=phrases[phraseIndex]
  const proceduralCandidates=[]
  for(const id of worlds.MASTER_WORLD_ORDER){for(let variant=0;variant<2;variant+=1)proceduralCandidates.push(procedural.generateProceduralWorld(id,text,`visual:${phraseIndex}:${id}:${variant}`,variant?{energyValue:.82,depthValue:.72}:{}))}
  const selectedWorlds=diversity.selectPerceptuallyDiverse(proceduralCandidates,diversity.vectorFromWorld,{count:3,minDistance:.44,score:(item)=>audits.WorldAudit(item).score,signature:(item)=>item.perceptualSignature})
  assert.equal(selectedWorlds.length,3,`${label}: must produce 3 distant posts`)
  const min=diversity.pairwiseMinimumDistance(selectedWorlds,diversity.vectorFromWorld)
  assert.ok(min>=.44,`${label}: perceptual distance ${min} below .44`)
  assert.ok(new Set(selectedWorlds.map((x)=>x.world.family)).size>=2,`${label}: results must span at least two art-direction families`)
  const selected=selectedWorlds.map((generated)=>{const world=worlds.DESIGN_WORLDS[generated.masterWorldId];const plan=worlds.worldPreviewPlan(world,text,'instagram-portrait');return{world,plan,generated}})
  const svgs=[]
  for(let i=0;i<selected.length;i+=1){
    const item=selected[i],svg=renderer.renderCompositionSvg(item.plan)
    assert.match(svg,/width="1080" height="1350"/);assert.match(svg,/direction="rtl"/);assert.doesNotMatch(svg,/NaN|undefined/);assert.ok(svg.length>2500)
    svgs.push(svg);await writeFile(`${outDir}/${String(phraseIndex+1).padStart(2,'0')}-${i+1}-${item.world.id}.svg`,svg)
  }
  assert.equal(new Set(svgs).size,3,`${label}: SVG outputs must differ`)
  const square=worlds.worldPreviewPlan(selected[0].world,text,'instagram-square'), squareSvg=renderer.renderCompositionSvg(square)
  assert.match(squareSvg,/width="1080" height="1080"/);assert.match(squareSvg,/direction="rtl"/);assert.doesNotMatch(squareSvg,/NaN|undefined/)
  const contrastA=renderer.renderCompositionSvg(worlds.worldPreviewPlan(worlds.DESIGN_WORLDS['copper-eclipse'],text,'instagram-portrait'))
  const contrastB=renderer.renderCompositionSvg(worlds.worldPreviewPlan(worlds.DESIGN_WORLDS['ivory-air'],text,'instagram-portrait'))
  assert.notEqual(contrastA,contrastB,`${label}: contrasting worlds must not render as same design`)
  const reel=reelScenes.planReel({title:text,body:`${text}. ${label} — مادة مخصّصة للريل لاختبار السرد البصري.`,cta:`اقرأ الفكرة كاملة: ${text.slice(0,40)}`},phraseIndex)
  const reelAudit=reelScenes.auditReelPlan(reel)
  assert.equal(reelAudit.ready,true,`${label}: reel gate failed: ${reelAudit.warnings.join(' | ')}`)
  assert.ok(reel.scenes.length>=5&&reel.scenes.length<=8);assert.ok(reel.seconds>=18&&reel.seconds<=30);assert.ok(reel.scenes[0].seconds<=1.5)
  assert.equal(new Set(reel.scenes.map((s)=>s.line.trim())).size,reel.scenes.length,`${label}: repeated reel lines`)
  const timeline=reelTimeline.sampleReelTimeline(reel,30)
  assert.ok(timeline.length>=Math.floor(reel.seconds*30),`${label}: timeline must cover every 30fps frame`)
  assert.ok(timeline.every((frame)=>frame.text.length>0&&frame.sceneIndex>=0&&frame.sceneIndex<reel.scenes.length),`${label}: every frame must belong to a readable scene`)
  assert.equal(timeline[0].sceneIndex,0);assert.equal(timeline.at(-1).sceneIndex,reel.scenes.length-1)
  reports.push({label,text,worlds:selected.map((x)=>x.world.id),families:selected.map((x)=>x.world.family),distance:Number(min.toFixed(3)),reel:{world:reel.world.id,verb:reel.motionVerb,scenes:reel.scenes.length,seconds:reel.seconds,score:reelAudit.score,frames:timeline.length}})
}
assert.ok(worlds.MASTER_WORLD_ORDER.every((id)=>reelScenes.REEL_WORLDS.some((w)=>w.id===id)),'all 64 master worlds must be selectable by reels')
assert.equal(reports.length,10)
await writeFile(`${outDir}/matrix.json`,JSON.stringify(reports,null,2))
console.log(JSON.stringify({ok:true,phrases:reports.length,renderedPortraits:30,renderedSquares:10,contrastingWorldPairs:10,minDistance:Math.min(...reports.map((r)=>r.distance)),reels:reports.map((r)=>({label:r.label,scenes:r.reel.scenes,seconds:r.reel.seconds,score:r.reel.score,world:r.reel.world,verb:r.reel.verb})),proofDir:outDir},null,2))
