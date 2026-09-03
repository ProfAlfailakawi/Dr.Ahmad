import { DESIGN_WORLDS } from './design-worlds'
import { contrastRatio, type ProceduralWorldResult } from './procedural-world-engine'

export interface AuditPenalty { id:string; label:string; points:number; critical?:boolean }
export interface QualityAudit { score:number; grade:'rejected'|'needs-improvement'|'professional'|'masterpiece'; ready:boolean; criticalFailure:boolean; categories:{semantic:number;beauty:number;readability:number;motion:number;identity:number;platform:number}; penalties:AuditPenalty[]; warnings:string[] }
export interface WorldAuditContext {
  clippedText?:boolean; duplicatePhrases?:boolean; excessGlow?:boolean; overcrowded?:boolean; logoDistorted?:boolean; meaninglessMotion?:boolean
  genericOpening?:boolean; repeatedCta?:boolean; fallbackFont?:boolean; wrongDuration?:boolean; singleFrame?:boolean; cheapOrnament?:boolean
  exportMismatch?:boolean; paletteOnly?:boolean; weakContrast?:boolean
}
export interface MotionAuditInput {
  semantic:boolean; loopSafe:boolean; meaningful:boolean; fps:number; durationValid:boolean; singleFrame?:boolean; excessGlow?:boolean; textRotation?:boolean
  clippedText?:boolean; fallbackFont?:boolean; logoDistorted?:boolean; exportMismatch?:boolean; excessiveZoom?:boolean; bounce?:boolean; shake?:boolean; everythingMoves?:boolean; recorderError?:boolean
}
export interface ReelAuditInput {
  seconds:number; sceneCount:number; hookSeconds:number; duplicate:boolean; clipped:boolean; genericOpening:boolean; genericCta:boolean; safeZone:boolean
  repeatedCta?:boolean; fallbackFont?:boolean; logoDistorted?:boolean; exportMismatch?:boolean; excessGlow?:boolean; overcrowded?:boolean; unfinishedSentence?:boolean; soundOverpowering?:boolean; singleFrame?:boolean; durationValid?:boolean
}

function grade(score:number):QualityAudit['grade']{return score>=94?'masterpiece':score>=88?'professional':score>=82?'needs-improvement':'rejected'}
export function qualityScore(categories:QualityAudit['categories'],penalties:AuditPenalty[]=[]):QualityAudit {
  const raw=categories.semantic+categories.beauty+categories.readability+categories.motion+categories.identity+categories.platform
  const criticalFailure=penalties.some((p)=>p.critical)
  const score=Math.max(0,Math.min(100,Math.round(raw-penalties.reduce((n,p)=>n+p.points,0))))
  return {score,grade:grade(score),ready:score>=82&&!criticalFailure,criticalFailure,categories,penalties,warnings:penalties.map((p)=>p.label)}
}
const push=(list:AuditPenalty[],condition:boolean|undefined,id:string,label:string,points:number,critical=false)=>{if(condition)list.push({id,label,points,critical})}

export function WorldAudit(result:ProceduralWorldResult,context:WorldAuditContext={}):QualityAudit {
  const p:AuditPenalty[]=[]
  const master=DESIGN_WORLDS[result.masterWorldId]
  const ratio=contrastRatio(result.world.palette.background,result.world.palette.ink)
  const structuralSame=Boolean(master)&&result.world.layout===master.layout&&result.world.spatial===master.spatial&&result.world.framing===master.framing&&result.world.typography===master.typography&&result.axes.material===master.materials[0]&&result.axes.motion===master.motionDna[0]&&result.axes.lighting===master.lighting[0]
  const paletteChanged=Boolean(master)&&result.world.palette.background!==master.palette.background
  const paletteOnly=context.paletteOnly ?? (structuralSame&&paletteChanged)
  result.compatibilityWarnings.forEach((label,i)=>p.push({id:`compat-${i}`,label,points:3}))
  push(p,result.layoutGenome.split('|').length<5,'layout-flat','العالم لا يملك Genome تكوين كافياً.',20,true)
  push(p,paletteOnly,'palette-only','النتيجة تعتمد على تبديل اللون فقط ولا تُعد عالماً جديداً.',28,true)
  push(p,ratio<4.5||context.weakContrast,'weak-contrast',`التباين ${ratio.toFixed(2)}:1 أضعف من الحد الآمن 4.5:1.`,30,true)
  push(p,context.clippedText,'clipped-text','قص النص أو ملامسته الحواف الآمنة.',35,true)
  push(p,context.duplicatePhrases,'duplicate-phrases','تكرار الجمل أو العبارات.',20,true)
  push(p,context.excessGlow,'excess-glow','Glow مفرط أو بلا سبب دلالي.',9)
  push(p,context.overcrowded,'overcrowded','ازدحام بصري ينافس الفكرة الرئيسية.',16,true)
  push(p,context.logoDistorted,'logo-distorted','الشعار/الختم مشوّه أو تغيرت نسبه.',30,true)
  push(p,context.meaninglessMotion,'meaningless-motion','حركة بلا معنى دلالي.',20,true)
  push(p,context.genericOpening,'generic-opening','افتتاحية عامة لا تنطق موضوع المادة.',12)
  push(p,context.repeatedCta,'repeated-cta','CTA مكرر أو غير خاص بالمادة.',10)
  push(p,context.fallbackFont,'fallback-font','التصدير يستخدم خطاً بديلاً عن خط الهوية.',35,true)
  push(p,context.wrongDuration,'wrong-duration','مدة الفيديو غير صحيحة.',30,true)
  push(p,context.singleFrame,'single-frame','ملف الفيديو Frame واحد أو مدة وهمية.',40,true)
  push(p,context.cheapOrnament,'cheap-ornament','زخارف جاهزة/رخيصة تنافس المعنى.',18,true)
  push(p,context.exportMismatch,'export-mismatch','النتيجة المصدرة لا تطابق المعاينة.',35,true)
  const semantic=Math.min(25,18+Math.round(result.semantic.confidence*7))
  const beauty=Math.max(0,20-(paletteOnly?8:0)-(context.excessGlow?3:0)-(context.cheapOrnament?5:0))
  const readability=Math.max(0,20-(result.axes.density==='controlled-maximal'&&result.semantic.density==='dense'?5:0)-(context.clippedText?10:0)-(ratio<4.5?10:0))
  const motion=result.semanticVerb===result.axes.motion?15:13
  const identity=context.logoDistorted||context.fallbackFont?4:10
  const platform=context.exportMismatch||context.wrongDuration||context.singleFrame?2:10
  return qualityScore({semantic,beauty,readability,motion,identity,platform},p)
}

export function MotionAudit(input:MotionAuditInput):QualityAudit {
  const p:AuditPenalty[]=[]
  push(p,!input.semantic||!input.meaningful,'meaningless-motion','حركة بلا معنى دلالي.',20,true)
  push(p,!input.loopSafe,'loop-seam','أول وآخر Frame غير متوافقين.',12,true)
  push(p,input.fps<30,'fps','معدل الإطارات أقل من 30fps.',8)
  push(p,!input.durationValid,'duration','مدة الفيديو غير صحيحة.',25,true)
  push(p,input.singleFrame,'single-frame','ملف الفيديو يحتوي Frame واحداً أو مدة وهمية.',35,true)
  push(p,input.excessGlow,'glow','Glow مفرط.',8)
  push(p,input.textRotation,'rotation','دوران نص مقروء يضر العربية.',20,true)
  push(p,input.clippedText,'text-clipping','قص النص أثناء الحركة.',30,true)
  push(p,input.fallbackFont,'fallback-font','الفيديو يستخدم خط نظام بديل.',35,true)
  push(p,input.logoDistorted,'logo-distortion','الختم مشوّه أثناء التحول.',30,true)
  push(p,input.exportMismatch,'export-mismatch','الفيديو لا يطابق المعاينة.',35,true)
  push(p,input.excessiveZoom,'excessive-zoom','Zoom مبالغ يضعف القراءة.',12)
  push(p,input.bounce,'cheap-bounce','Bounce رخيص غير مبرر.',12)
  push(p,input.shake,'arabic-shake','اهتزاز يضعف وضوح العربية.',20,true)
  push(p,input.everythingMoves,'everything-moves','كل العناصر تتحرك باستمرار بلا تسلسل بصري.',14)
  push(p,input.recorderError,'recorder-error','MediaRecorder أبلغ عن خطأ.',40,true)
  return qualityScore({semantic:input.semantic?25:8,beauty:18,readability:input.clippedText||input.textRotation?8:20,motion:input.meaningful?15:4,identity:input.logoDistorted||input.fallbackFont?4:10,platform:input.durationValid&&!input.singleFrame&&!input.exportMismatch?10:2},p)
}

export function ReelAudit(input:ReelAuditInput):QualityAudit {
  const p:AuditPenalty[]=[]
  push(p,input.seconds<18||input.seconds>30,'duration','مدة الريل خارج 18–30 ثانية.',20,true)
  push(p,input.durationValid===false,'duration-file','مدة الملف الفعلية لا تطابق الخطة.',25,true)
  push(p,input.sceneCount<5||input.sceneCount>8,'scenes','عدد المشاهد خارج 5–8.',12,true)
  push(p,input.hookSeconds>1.5,'hook','الافتتاح يتجاوز 1.5 ثانية.',10)
  push(p,input.duplicate,'duplicate','تكرار جمل داخل الريل.',20,true)
  push(p,input.clipped,'clip','قص نص أو خروج عن Safe Zone.',30,true)
  push(p,input.genericOpening,'opening','افتتاحية عامة لا تنطق موضوع المادة.',12)
  push(p,input.genericCta||input.repeatedCta,'cta','CTA عام أو مكرر.',10)
  push(p,!input.safeZone,'safe-zone','نص مهم داخل منطقة أزرار المنصة.',25,true)
  push(p,input.fallbackFont,'fallback-font','الريل يستخدم خط نظام بديل.',35,true)
  push(p,input.logoDistorted,'logo-distortion','الشعار أو الختم مشوّه.',30,true)
  push(p,input.exportMismatch,'export-mismatch','ملف الريل لا يطابق المعاينة.',35,true)
  push(p,input.excessGlow,'glow','Glow مفرط.',8)
  push(p,input.overcrowded,'crowding','ازدحام مشهدي يضعف التسلسل.',14)
  push(p,input.unfinishedSentence,'unfinished','جملة معلّقة أو مبتورة.',22,true)
  push(p,input.soundOverpowering,'audio-balance','البصمة الصوتية تغطي المعنى.',10)
  push(p,input.singleFrame,'single-frame','ملف الريل لا يحتوي حركة فعلية.',35,true)
  return qualityScore({semantic:25,beauty:18,readability:input.clipped?5:20,motion:14,identity:input.logoDistorted||input.fallbackFont?4:10,platform:input.safeZone&&!input.exportMismatch?10:2},p)
}

export function assertQualityGate(audit:QualityAudit,label='التصدير'){if(!audit.ready)throw new Error(`بوابة الجودة منعت ${label}: ${audit.warnings[0]||`الدرجة ${audit.score}/100`}`)}
