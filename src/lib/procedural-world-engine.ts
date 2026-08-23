import {
  DESIGN_WORLDS,
  MASTER_WORLD_ORDER,
  type DesignWorld,
  type PostLayoutArchetype,
  type SemanticVerb,
  type WorldDensity,
  type WorldDepth,
  type WorldEnergy,
  type WorldGeometry,
  type WorldLighting,
  type WorldMaterial,
  type WorldMotion,
  type WorldRhythm,
  type WorldTemperature,
} from './design-worlds'
import type { AccentStrategyId, FramingModeId, LayoutFamilyId, Palette, SpatialPatternId, TypographyModeId } from './social-design-engine'
import { analyzeWorldSemantics, type WorldSemanticAnalysis } from './world-semantics'

export type WorldEra = 'heritage' | 'classic' | 'contemporary' | 'future' | 'timeless'
export interface WorldAxes {
  energy: WorldEnergy
  material: WorldMaterial
  era: WorldEra
  depth: WorldDepth
  temperature: WorldTemperature
  density: WorldDensity
  motion: WorldMotion
  geometry: WorldGeometry
  lighting: WorldLighting
  rhythm: WorldRhythm
}
export interface WorldLocks { typography?: boolean; palette?: boolean; layout?: boolean; material?: boolean; motion?: boolean; lighting?: boolean }
export interface WorldAxisOverrides extends Partial<WorldAxes> { densityValue?: number; energyValue?: number; depthValue?: number; temperatureValue?: number; motionSpeed?: number }
export interface ProceduralWorldResult {
  masterWorldId: string
  familyId: string
  semanticVerb: SemanticVerb
  materialProfile: string
  motionProfile: string
  layoutGenome: string
  paletteGenome: string
  typographyGenome: string
  depthGenome: string
  audioGenome: string
  deterministicSeed: string
  perceptualSignature: string
  axes: WorldAxes
  semantic: WorldSemanticAnalysis
  world: DesignWorld
  compatibilityWarnings: string[]
}
export interface FusionResult extends ProceduralWorldResult { fusion: { primaryWorldId: string; secondaryWorldId: string; primaryRatio: number; nameAr: string; nameEn: string } }

const LAYOUTS: LayoutFamilyId[]=['editorial-axis','hero-word','quote-stage','dual-thesis','evidence-ledger','knowledge-map','quiet-orbit','cinematic-window','human-note','modular-brief','infographic','type-poster','marginalia','vertical-timeline']
const SPATIAL: SpatialPatternId[]=['asymmetric-air','centered-monument','right-rail','split-balance','diagonal-flow','modular-grid','low-horizon','layered-depth','topographic-stack','open-corners']
const TYPO: TypographyModeId[]=['display-monumental','editorial-serif','rational-sans','number-led','quotation-signature','academic-index','cinematic-title','conversational','studio-clean']
const ACCENTS: AccentStrategyId[]=['hero-keyword','single-rule','quiet-seal','data-marker','soft-orbit','editorial-index','contrast-band','corner-signal','paper-note','none']
const FRAMES: FramingModeId[]=['open-canvas','hairline-inset','editorial-folio','architectural-arch','cinematic-crop','corner-marks','floating-sheet','full-bleed']
const ARCHETYPES: PostLayoutArchetype[]=['Poster Monument','Editorial Stack','Modular Brief','Infographic Argument','Split Contrast','Central Emblem','Quote Architecture','Timeline Path','Data Narrative','Cinematic Frame','Typographic Field','Minimal Thesis']
const ENERGY: WorldEnergy[]=['still','balanced','pulsing','rising','controlled-explosive']
const ERA: WorldEra[]=['heritage','classic','contemporary','future','timeless']
const TEMP: WorldTemperature[]=['cold','neutral','warm','fiery']
const DENSITY: WorldDensity[]=['minimal','balanced','rich','controlled-maximal']
const RHYTHM: WorldRhythm[]=['contemplative','editorial','dialogic','rising','cinematic']
const MOTION: WorldMotion[]=['breathe','grow','connect','split','rise','orbit','weave','reveal','balance','pulse']
const GEOMETRY: WorldGeometry[]=['circular','axial','grid','organic','architectural','free']
const LIGHTING: WorldLighting[]=['soft','radial','backlit','side','eclipse','premium-neon']
const DEPTH: WorldDepth[]=['flat','layered','perspective','spatial','cinematic']
const MATERIAL: WorldMaterial[]=['paper','glass','metal','stone','ink','light','sand','water','textile','clay']

export function hashSeed(value: string): number {
  let h=2166136261
  for (let i=0;i<value.length;i+=1) { h^=value.charCodeAt(i); h=Math.imul(h,16777619) }
  return h>>>0
}
function mulberry32(seed:number) { return () => { let t=seed+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296 } }
function pick<T>(rng:()=>number, values:readonly T[]):T { return values[Math.floor(rng()*values.length)%values.length] }
function clamp(value:number,min=0,max=1){return Math.max(min,Math.min(max,value))}
function hexToRgb(hex:string){const v=hex.replace('#',''); return [0,2,4].map((i)=>Number.parseInt(v.slice(i,i+2),16)||0) as [number,number,number]}
function rgbToHex(rgb:[number,number,number]){return `#${rgb.map((x)=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('')}`}
function mixHex(a:string,b:string,t:number){const A=hexToRgb(a),B=hexToRgb(b); return rgbToHex([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t])}
function tintPalette(base:Palette, temperature:WorldTemperature, depth:WorldDepth, seed:number):Palette {
  const warm='#D69058',cold='#63AEDD',neutral='#A9A9A3',fiery='#D75E46'
  const target=temperature==='warm'?warm:temperature==='cold'?cold:temperature==='fiery'?fiery:neutral
  const strength=.035+(seed%7)*.006
  const darken=depth==='cinematic'?.08:depth==='spatial'?.04:0
  const black='#08090B'
  return {...base,label:base.label,background:mixHex(mixHex(base.background,target,strength),black,darken),surface:mixHex(base.surface,target,strength*.6),accent:mixHex(base.accent,target,.1),accentSoft:mixHex(base.accentSoft,target,.06)}
}
function semanticMotion(verb:SemanticVerb):WorldMotion {
  const map:Partial<Record<SemanticVerb,WorldMotion>>={root:'grow',connect:'connect',split:'split',rise:'rise',weave:'weave',orbit:'orbit',pulse:'pulse',balance:'balance',breathe:'breathe',reveal:'reveal',question:'reveal',path:'reveal',echo:'pulse',transform:'reveal',fracture:'split',gather:'connect',protect:'balance',liberate:'rise',dissolve:'breathe',confront:'pulse'}
  return map[verb] || 'reveal'
}
function axisBySlider<T>(items:readonly T[], value:number|undefined, fallback:T):T { if (value==null) return fallback; return items[Math.round(clamp(value)*(items.length-1))] }

export function compatibilityWarnings(axes:WorldAxes, semantic:WorldSemanticAnalysis):string[] {
  const warnings:string[]=[]
  if (axes.density==='controlled-maximal' && semantic.density==='dense') warnings.push('كثافة النص والعالم مرتفعتان معاً؛ خُفّضت العناصر الزخرفية تلقائياً.')
  if (axes.lighting==='premium-neon' && axes.material==='paper') warnings.push('النيون مع الورق غير متوافق افتراضياً؛ استخدمه كحافة ضوء فقط.')
  if (axes.energy==='controlled-explosive' && semantic.semanticMotionVerb==='breathe') warnings.push('معنى النص تأملي؛ الطاقة الانفجارية تُقيّد إلى ذروة قصيرة.')
  if (axes.depth==='cinematic' && semantic.density==='dense') warnings.push('العمق السينمائي مع نص كثيف يحتاج مساحات آمنة أوسع.')
  return warnings
}

export function generateProceduralWorld(masterWorldId:string, text:string, seed=`${masterWorldId}:${text}`, overrides:WorldAxisOverrides={}, locks:WorldLocks={}):ProceduralWorldResult {
  const master=DESIGN_WORLDS[masterWorldId] || DESIGN_WORLDS[MASTER_WORLD_ORDER[0]]
  const semantic=analyzeWorldSemantics(text)
  const deterministicSeed=String(seed || `${master.id}:${text}`)
  const numeric=hashSeed(deterministicSeed)
  const rng=mulberry32(numeric)
  const baseMaterial=pick(rng,master.materials.length?master.materials:MATERIAL)
  const baseMotion=semanticMotion(semantic.semanticMotionVerb)
  const axes:WorldAxes={
    energy:axisBySlider(ENERGY,overrides.energyValue,overrides.energy || pick(rng,ENERGY.slice(0,4))),
    material:overrides.material || baseMaterial,
    era:overrides.era || pick(rng,ERA),
    depth:axisBySlider(DEPTH,overrides.depthValue,overrides.depth || pick(rng,master.depth.length?master.depth:DEPTH)),
    temperature:axisBySlider(TEMP,overrides.temperatureValue,overrides.temperature || (master.palette.isDark?'cold':'neutral')),
    density:axisBySlider(DENSITY,overrides.densityValue,overrides.density || (semantic.density==='minimal'?'minimal':semantic.density==='dense'?'rich':'balanced')),
    motion:overrides.motion || (master.motionDna.includes(baseMotion)?baseMotion:pick(rng,master.motionDna.length?master.motionDna:MOTION)),
    geometry:overrides.geometry || pick(rng,master.geometry.length?master.geometry:GEOMETRY),
    lighting:overrides.lighting || pick(rng,master.lighting.length?master.lighting:LIGHTING),
    rhythm:overrides.rhythm || pick(rng,RHYTHM),
  }
  const layout=locks.layout?master.layout:pick(rng,[master.layout,...LAYOUTS.filter((x)=>x!==master.layout).slice(0,5)])
  const spatial=locks.layout?master.spatial:pick(rng,[master.spatial,...SPATIAL.filter((x)=>x!==master.spatial).slice(0,4)])
  const typography=locks.typography?master.typography:pick(rng,[master.typography,...TYPO.filter((x)=>x!==master.typography).slice(0,3)])
  const palette=locks.palette?master.palette:tintPalette(master.palette,axes.temperature,axes.depth,numeric)
  const accent=pick(rng,[master.accent,...ACCENTS.filter((x)=>x!==master.accent).slice(0,3)])
  const framing=pick(rng,[master.framing,...FRAMES.filter((x)=>x!==master.framing).slice(0,3)])
  const post=pick(rng,[...master.layoutGrammar,...ARCHETYPES.filter((x)=>!master.layoutGrammar.includes(x)).slice(0,4)])
  const world:DesignWorld={...master,id:`${master.id}::${numeric.toString(36)}`,label:`${master.label} · ${numeric.toString(36).slice(0,4).toUpperCase()}`,master:false,palette,palettes:[palette],layout,spatial,typography,accent,framing,layoutGrammar:[post],materials:[axes.material],motionDna:[axes.motion],lighting:[axes.lighting],depth:[axes.depth],geometry:[axes.geometry],signatureTokens:[...master.signatureTokens,axes.energy,axes.material,axes.era,axes.depth,axes.temperature,axes.density,axes.motion,axes.geometry,axes.lighting,axes.rhythm,layout,spatial,typography]}
  const layoutGenome=[post,layout,spatial,framing,axes.geometry].join('|')
  const paletteGenome=[master.palette.id,axes.temperature,palette.background,palette.accent].join('|')
  const typographyGenome=[typography,axes.density,semantic.formality].join('|')
  const depthGenome=[axes.depth,axes.lighting,axes.material].join('|')
  const motionProfile=[axes.motion,axes.energy,axes.rhythm,Math.round((overrides.motionSpeed ?? .5)*100)].join('|')
  const materialProfile=[axes.material,axes.era,axes.temperature].join('|')
  const audioGenome=[master.family,axes.rhythm,axes.energy,numeric%12].join('|')
  const perceptualSignature=[master.id,layoutGenome,paletteGenome,typographyGenome,depthGenome,motionProfile,semantic.semanticMotionVerb].join('::')
  return {masterWorldId:master.id,familyId:master.family,semanticVerb:semantic.semanticMotionVerb,materialProfile,motionProfile,layoutGenome,paletteGenome,typographyGenome,depthGenome,audioGenome,deterministicSeed,perceptualSignature,axes,semantic,world,compatibilityWarnings:compatibilityWarnings(axes,semantic)}
}

export function fuseWorlds(primaryId:string, secondaryId:string, primaryRatio=.6, text='', seed='fusion'):FusionResult {
  const primary=DESIGN_WORLDS[primaryId] || DESIGN_WORLDS[MASTER_WORLD_ORDER[0]]
  const secondary=DESIGN_WORLDS[secondaryId] || DESIGN_WORLDS[MASTER_WORLD_ORDER[1]]
  const ratio=clamp(primaryRatio,.25,.75)
  const base=generateProceduralWorld(primary.id,text,`${seed}:${primary.id}:${secondary.id}:${ratio}`,{material:secondary.materials[0],motion:secondary.motionDna[0],lighting:secondary.lighting[0]},{layout:true,typography:ratio>=.55,palette:false})
  const palette={...base.world.palette,label:`${primary.label} × ${secondary.label}`,background:mixHex(primary.palette.background,secondary.palette.background,1-ratio),surface:mixHex(primary.palette.surface,secondary.palette.surface,1-ratio),ink:ratio>=.5?primary.palette.ink:secondary.palette.ink,muted:mixHex(primary.palette.muted,secondary.palette.muted,1-ratio),accent:mixHex(primary.palette.accent,secondary.palette.accent,1-ratio),accentSoft:mixHex(primary.palette.accentSoft,secondary.palette.accentSoft,1-ratio),rule:mixHex(primary.palette.rule,secondary.palette.rule,1-ratio)}
  const nameAr=`${primary.labelAr} × ${secondary.labelAr}`
  const nameEn=`${primary.labelEn} × ${secondary.labelEn}`
  const world:DesignWorld={...base.world,id:`fusion:${primary.id}:${secondary.id}:${hashSeed(seed+text).toString(36)}`,label:nameAr,labelAr:nameAr,labelEn:nameEn,palette,palettes:[palette],family:primary.family,description:`اندماج مقصود: تكوين ${primary.labelAr} مع مادة/حركة/إضاءة ${secondary.labelAr}.`,essence:`اندماج بنسبة ${Math.round(ratio*100)}٪ من منطق الأول و${Math.round((1-ratio)*100)}٪ من حس الثاني.`,compatibleWorlds:[primary.id,secondary.id],signatureTokens:[...base.world.signatureTokens,`fusion:${primary.id}:${secondary.id}:${ratio.toFixed(2)}`]}
  const warnings=[...base.compatibilityWarnings]
  if (primary.id===secondary.id) warnings.push('الاندماج بين العالم نفسه لا يصنع مسافة إدراكية كافية.')
  if (palette.background===palette.ink) warnings.push('اندماج اللون فقد التباين؛ يجب رفضه.')
  return {...base,world,masterWorldId:primary.id,familyId:primary.family,paletteGenome:`fusion:${primary.palette.id}:${secondary.palette.id}:${ratio.toFixed(2)}`,perceptualSignature:`${base.perceptualSignature}::fusion:${secondary.id}:${ratio.toFixed(2)}`,compatibilityWarnings:warnings,fusion:{primaryWorldId:primary.id,secondaryWorldId:secondary.id,primaryRatio:ratio,nameAr,nameEn}}
}
