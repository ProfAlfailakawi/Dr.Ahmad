import { useEffect, useMemo, useRef, useState } from 'react'
import { DESIGN_WORLDS, MASTER_WORLD_ORDER, WORLD_FAMILY_OPTIONS, resolveWorld, type DesignWorld, type DesignWorldId } from '../../lib/design-worlds'
import { assessFusionCompatibility, fuseWorlds, generateProceduralWorld, proceduralWorldCacheStats, type ProceduralWorldResult, type WorldLocks } from '../../lib/procedural-world-engine'
import { perceptualDistance, recentPerceptualSignatures, rememberPerceptualSignature, selectPerceptuallyDiverse, signatureNovelty, vectorFromWorld } from '../../lib/perceptual-diversity'
import { WorldAudit } from '../../lib/world-audits'
import { analyzeWorldSemantics } from '../../lib/world-semantics'
import { worldPreviewPlan } from '../../lib/design-worlds'
import { renderCompositionSvg } from '../../lib/social-design-renderer'

const POSTER_CACHE_LIMIT=96
const posterCache=new Map<string,string>()
function posterOf(world:DesignWorld,idea:string){
  const key=`${world.id}:${idea.slice(0,96)}`
  const cached=posterCache.get(key)
  if(cached){posterCache.delete(key);posterCache.set(key,cached);return cached}
  const svg=renderCompositionSvg(worldPreviewPlan(world,idea||undefined),{ariaLabel:`ملصق عالم ${world.label}`})
  posterCache.set(key,svg)
  while(posterCache.size>POSTER_CACHE_LIMIT){const oldest=posterCache.keys().next().value as string|undefined;if(oldest)posterCache.delete(oldest);else break}
  return svg
}
function useVisible<T extends HTMLElement>(){
  const ref=useRef<T|null>(null)
  const [visible,setVisible]=useState(false)
  useEffect(()=>{
    const node=ref.current;if(!node)return
    if(typeof IntersectionObserver==='undefined'){setVisible(true);return}
    const observer=new IntersectionObserver(([entry])=>setVisible(Boolean(entry?.isIntersecting)),{rootMargin:'180px'})
    observer.observe(node)
    return()=>observer.disconnect()
  },[])
  return {ref,visible}
}

export interface DesignWorldsGalleryProps { activeWorldId?:DesignWorldId|string|null; onDress:(world:DesignWorld)=>void; onGenerate?:(world:DesignWorld)=>void; onClear?:()=>void; compact?:boolean; idea?:string; semanticPlatform?:'post'|'reel' }
const tiny='rounded-full border border-white/15 px-2.5 py-1 text-[.58rem] font-bold text-slate-200 transition hover:border-sky-300/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
const field='min-w-0 rounded-xl border border-white/10 bg-slate-950/55 px-2.5 py-2 text-[.62rem] text-slate-200 outline-none focus:border-sky-300/50'
const labelMap:Record<string,string>={still:'ساكن',balanced:'متزن',pulsing:'نابض',rising:'متصاعد','controlled-explosive':'انفجاري محسوب',paper:'ورق',glass:'زجاج',metal:'معدن',stone:'حجر',ink:'حبر',light:'ضوء',sand:'رمل',water:'ماء',textile:'نسيج',clay:'طين',breathe:'تنفّس',grow:'نمو',connect:'اتصال',split:'انقسام',rise:'صعود',orbit:'دوران',weave:'نسج',reveal:'كشف',balance:'توازن',pulse:'نبض'}

function WorldCard({world,idea,active,favorite,compare,onFavorite,onCompare,onDress,onGenerate}:{world:DesignWorld;idea:string;active:boolean;favorite:boolean;compare:boolean;onFavorite:()=>void;onCompare:()=>void;onDress:()=>void;onGenerate?:()=>void}){
  const {ref,visible}=useVisible<HTMLElement>()
  const [live,setLive]=useState(false)
  const motionRef=useRef<HTMLSpanElement|null>(null)
  const rafRef=useRef(0)
  const wp=world.palette
  useEffect(()=>{
    cancelAnimationFrame(rafRef.current)
    const layer=motionRef.current
    if(!layer||!live||!visible)return
    if(typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches)return
    const started=performance.now()
    const motion=world.motionDna[0]
    const tick=(now:number)=>{
      const phase=(now-started)/1000
      const wave=(Math.sin(phase*Math.PI*1.15)+1)/2
      const travel=motion==='rise'?`${(1-wave)*7}px` : motion==='split'?`${(wave-.5)*8}px` : motion==='connect'?`${(wave-.5)*4}px` : '0px'
      layer.style.opacity=String(.12+wave*.2)
      layer.style.transform=`translate3d(${motion==='orbit'?`${(wave-.5)*5}px`:'0px'}, ${travel}, 0) scale(${1+wave*.018})`
      rafRef.current=requestAnimationFrame(tick)
    }
    rafRef.current=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(rafRef.current)
  },[live,visible,world.motionDna])
  return <article ref={ref} onMouseEnter={()=>setLive(true)} onMouseLeave={()=>setLive(false)} onFocus={()=>setLive(true)} onBlur={()=>setLive(false)} className={`group relative overflow-hidden rounded-xl border transition ${active?'ring-2 ring-sky-300/70':''}`} style={{background:wp.background,borderColor:active?wp.accent:wp.rule}}>
    <div className="absolute left-2 top-2 z-20 flex gap-1"><button type="button" className={tiny} onClick={onFavorite} aria-label="حفظ المفضلة">{favorite?'★':'☆'}</button><button type="button" className={tiny} onClick={onCompare} aria-pressed={compare} aria-label="أضف للمقارنة">⇄</button></div>
    <button type="button" onClick={onDress} className="block w-full text-right" title={`${world.description}\n${world.philosophy}`}>
      <span className="relative block overflow-hidden" style={{aspectRatio:'4 / 5',background:wp.background}}>
        {visible?<span className="absolute inset-0 block" dangerouslySetInnerHTML={{__html:posterOf(world,idea)}}/>:<span className="absolute inset-0 animate-pulse" style={{background:`linear-gradient(145deg,${wp.background},${wp.surface},${wp.background})`}}/>}
        <span ref={motionRef} aria-hidden="true" className="pointer-events-none absolute inset-[8%] rounded-[28%] opacity-0 will-change-transform" style={{background:`radial-gradient(circle at 72% 20%,${wp.accent}55,transparent 42%),linear-gradient(135deg,transparent 32%,${wp.accentSoft}22 50%,transparent 68%)`}}/>
        <span className="absolute bottom-2 right-2 z-10 rounded-full px-2 py-1 text-[.48rem] font-bold" style={{background:wp.surface,color:wp.ink,border:`1px solid ${wp.rule}`}}>{world.familyLabel}</span>
      </span>
      <span className="block px-3 pb-2 pt-2" style={{borderTop:`1px solid ${wp.rule}`}}><span className="block font-display text-[.78rem] font-bold" style={{color:wp.ink}}>{world.labelAr}</span><span className="block text-[.48rem] uppercase tracking-[.08em]" style={{color:wp.muted}}>{world.labelEn}</span><span className="mt-1 block text-[.55rem] leading-relaxed" style={{color:wp.muted}}>{world.tagline}</span></span>
    </button>
    <div className="grid gap-1 px-3 pb-2"><button type="button" className="w-full rounded-full px-2 py-1 text-[.54rem] font-bold" style={{background:wp.accent,color:wp.isDark?'#0A0D12':'#fff'}} onClick={onDress}>ألبس الفكرة هذا العالم</button><button type="button" className={tiny} onClick={()=>setLive((x)=>!x)}>{live?'أوقف المعاينة':'حرّك المعاينة'}</button>{onGenerate?<button type="button" className={tiny} onClick={onGenerate}>ولادة كاملة</button>:null}</div>
  </article>
}

export default function DesignWorldsGallery({activeWorldId,onDress,onGenerate,onClear,compact,idea='',semanticPlatform='post'}:DesignWorldsGalleryProps){
  const semantic=useMemo(()=>analyzeWorldSemantics(idea||'فكرة جديدة',semanticPlatform),[idea,semanticPlatform])
  const [query,setQuery]=useState(''); const [family,setFamily]=useState('all'); const [mood,setMood]=useState('all'); const [material,setMaterial]=useState('all'); const [energy,setEnergy]=useState('all'); const [motion,setMotion]=useState('all')
  const [favorites,setFavorites]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('design-world-favorites-v2')||'[]')}catch{return[]}})
  const [compare,setCompare]=useState<string[]>([]); const [variant,setVariant]=useState<ProceduralWorldResult|null>(null); const [fusionRatio,setFusionRatio]=useState(60); const [surpriseRound,setSurpriseRound]=useState(0); const [notice,setNotice]=useState('')
  const [density,setDensity]=useState(45); const [energyValue,setEnergyValue]=useState(45); const [depth,setDepth]=useState(45); const [temperature,setTemperature]=useState(45); const [speed,setSpeed]=useState(45)
  const [locks,setLocks]=useState<WorldLocks>({})
  const active=resolveWorld(activeWorldId)
  const masters=useMemo(()=>MASTER_WORLD_ORDER.map((id)=>DESIGN_WORLDS[id]),[])
  const moods=useMemo(()=>Array.from(new Set(masters.flatMap((w)=>w.emotionalTone))).sort(),[masters])
  const materials=useMemo(()=>Array.from(new Set(masters.flatMap((w)=>w.materials))).sort(),[masters])
  const motions=useMemo(()=>Array.from(new Set(masters.flatMap((w)=>w.motionDna))).sort(),[masters])
  const worldEnergy=(w:DesignWorld)=>w.semanticAffinity.includes('confront')&&w.motionDna.includes('pulse')?'controlled-explosive':w.motionDna.includes('breathe')?'still':w.motionDna.some((x)=>x==='rise')?'rising':w.motionDna.some((x)=>x==='pulse'||x==='orbit')?'pulsing':'balanced'
  const filtered=useMemo(()=>masters.filter((w)=>{const hay=`${w.labelAr} ${w.labelEn} ${w.description} ${w.philosophy} ${w.semanticAffinity.join(' ')} ${w.motifs.join(' ')}`.toLowerCase();return(!query||hay.includes(query.toLowerCase()))&&(family==='all'||w.family===family)&&(mood==='all'||w.emotionalTone.includes(mood))&&(material==='all'||w.materials.includes(material as never))&&(energy==='all'||worldEnergy(w)===energy)&&(motion==='all'||w.motionDna.includes(motion as never))}),[masters,query,family,mood,material,energy,motion])
  useEffect(()=>{try{localStorage.setItem('design-world-favorites-v2',JSON.stringify(favorites))}catch{/* private */}},[favorites])
  const overrides={densityValue:density/100,energyValue:energyValue/100,depthValue:depth/100,temperatureValue:temperature/100,motionSpeed:speed/100}
  const dress=(world:DesignWorld,seedSuffix='dress')=>{const result=generateProceduralWorld(world.id,idea,`${world.id}:${idea}:${seedSuffix}:${surpriseRound}`,overrides,locks);const audit=WorldAudit(result);setVariant(result);setNotice(audit.ready?'':audit.warnings[0]||'النسخة لم تجتز بوابة الجودة.');if(audit.ready){rememberPerceptualSignature(result.perceptualSignature);onDress(result.world)}else onDress(world)}
  const toggleFavorite=(id:string)=>setFavorites((list)=>list.includes(id)?list.filter((x)=>x!==id):[...list,id])
  const toggleCompare=(id:string)=>setCompare((list)=>list.includes(id)?list.filter((x)=>x!==id):[...list,id].slice(-3))
  const distant=()=>{const base=variant||generateProceduralWorld(active?.master?active.id:MASTER_WORLD_ORDER[0],idea,`base:${idea}`,overrides,locks);const recent=new Set(recentPerceptualSignatures());const candidates=masters.flatMap((w,wi)=>Array.from({length:2},(_,i)=>generateProceduralWorld(w.id,idea,`far:${idea}:${wi}:${i}:${surpriseRound}`,overrides,locks))).filter((x)=>WorldAudit(x).ready&&!recent.has(x.perceptualSignature));const selected=selectPerceptuallyDiverse(candidates,vectorFromWorld,{count:3,minDistance:.48,score:(x)=>WorldAudit(x).score+signatureNovelty(x.perceptualSignature)*10,signature:(x)=>x.perceptualSignature,excludeSignatures:recent});const next=[...selected].sort((a,b)=>perceptualDistance(vectorFromWorld(b),vectorFromWorld(base))-perceptualDistance(vectorFromWorld(a),vectorFromWorld(base)))[0];if(next){setVariant(next);rememberPerceptualSignature(next.perceptualSignature);setNotice('');onDress(next.world)}else setNotice('استُهلكت مساحة التنويع الحالية؛ غيّر Lock أو Slider لفتح مساحة جديدة.')}
  const surprise=()=>{const round=surpriseRound+1;setSurpriseRound(round);const recent=new Set(recentPerceptualSignatures());const candidates=masters.map((w,i)=>generateProceduralWorld(w.id,idea,`surprise:${idea}:${round}:${i}`,overrides,locks)).filter((x)=>WorldAudit(x).ready&&!recent.has(x.perceptualSignature));const ranked=candidates.sort((a,b)=>{const affinityA=a.world.semanticAffinity.includes(semantic.semanticMotionVerb)?18:0,affinityB=b.world.semanticAffinity.includes(semantic.semanticMotionVerb)?18:0;return(WorldAudit(b).score+affinityB+signatureNovelty(b.perceptualSignature)*12)-(WorldAudit(a).score+affinityA+signatureNovelty(a.perceptualSignature)*12)});const shortlist=selectPerceptuallyDiverse(ranked.slice(0,24),vectorFromWorld,{count:3,minDistance:.46,score:(x)=>WorldAudit(x).score,signature:(x)=>x.perceptualSignature,excludeSignatures:recent});const next=shortlist[round%Math.max(1,shortlist.length)]||ranked[0];if(next){setVariant(next);rememberPerceptualSignature(next.perceptualSignature);setNotice('');onDress(next.world)}}
  const fusionCompatibility=useMemo(()=>compare.length===2?assessFusionCompatibility(compare[0],compare[1],fusionRatio/100,idea):null,[compare,fusionRatio,idea])
  const fuse=()=>{if(compare.length!==2)return;try{const result=fuseWorlds(compare[0],compare[1],fusionRatio/100,idea,`fusion:${idea}:${surpriseRound}`);const audit=WorldAudit(result);setVariant(result);if(audit.ready){rememberPerceptualSignature(result.perceptualSignature);setNotice('');onDress(result.world)}else setNotice(audit.warnings[0]||'Fusion لم يجتز الجودة.')}catch(error){setNotice(error instanceof Error?error.message:'Fusion مرفوض بسبب تعارض في القراءة أو الهوية.') }}
  const audit=variant?WorldAudit(variant):null
  const cache=proceduralWorldCacheStats()
  return <section className="mt-3 overflow-hidden rounded-2xl border border-hair bg-slate-950 text-right" dir="rtl" data-world-master-count="64" data-procedural-world-engine="true" data-seed-cache="lru">
    <div className="px-4 pb-3 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-base font-bold text-slate-100">عوالم التصميم</h3><span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-1 text-[.55rem] font-bold text-sky-200">64 Master Worlds · 16 عائلة</span></div><p className="mt-1 max-w-3xl text-[.62rem] leading-relaxed text-slate-400">المعنى أولاً: <strong className="text-slate-200">{semantic.centralIdea}</strong> · الفعل <strong className="text-sky-200">{semantic.semanticMotionVerb}</strong> · {semantic.visualMetaphor}</p></div><div className="flex flex-wrap gap-1.5"><button type="button" className={tiny} onClick={distant}>ولّد نسخة بعيدة إدراكياً</button><button type="button" className={tiny} onClick={surprise}>فاجئني · Controlled</button>{activeWorldId&&onClear?<button type="button" className={tiny} onClick={onClear}>أزل العالم</button>:null}</div></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><input className={field} value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="ابحث بالاسم أو المعنى…"/><select className={field} value={family} onChange={(e)=>setFamily(e.target.value)}><option value="all">كل العائلات</option>{WORLD_FAMILY_OPTIONS.map((x)=><option key={x.id} value={x.id}>{x.label}</option>)}</select><select className={field} value={mood} onChange={(e)=>setMood(e.target.value)}><option value="all">كل المزاجات</option>{moods.map((x)=><option key={x}>{x}</option>)}</select><select className={field} value={material} onChange={(e)=>setMaterial(e.target.value)}><option value="all">كل المواد</option>{materials.map((x)=><option key={x} value={x}>{labelMap[x]||x}</option>)}</select><select className={field} value={energy} onChange={(e)=>setEnergy(e.target.value)}><option value="all">كل الطاقات</option>{['still','balanced','pulsing','rising','controlled-explosive'].map((x)=><option key={x} value={x}>{labelMap[x]}</option>)}</select><select className={field} value={motion} onChange={(e)=>setMotion(e.target.value)}><option value="all">كل الحركات</option>{motions.map((x)=><option key={x} value={x}>{labelMap[x]||x}</option>)}</select></div>
      <div className="mt-3 grid gap-2 lg:grid-cols-5">{[['الكثافة',density,setDensity],['الطاقة',energyValue,setEnergyValue],['العمق',depth,setDepth],['الحرارة',temperature,setTemperature],['سرعة الحركة',speed,setSpeed]].map(([label,value,setter])=><label key={String(label)} className="rounded-xl border border-white/10 bg-white/[.025] px-2 py-1.5 text-[.52rem] text-slate-400"><span className="flex justify-between"><span>{String(label)}</span><span>{String(value)}%</span></span><input className="w-full" type="range" min="0" max="100" value={Number(value)} onChange={(e)=>(setter as (value:number)=>void)(Number(e.target.value))}/></label>)}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[.55rem] text-slate-400"><span>Lock:</span>{([['typography','الخط'],['palette','اللون'],['layout','التكوين']] as const).map(([key,label])=><button type="button" key={key} className={`${tiny} ${locks[key]?'border-sky-300/60 text-sky-200':''}`} onClick={()=>setLocks((x)=>({...x,[key]:!x[key]}))}>{locks[key]?'🔒':'○'} {label}</button>)}<span className="mr-auto">{filtered.length} عالم ظاهر · {favorites.length} مفضلة · Seed cache {cache.size}/{cache.limit} · المعاينات تتوقف خارج الشاشة</span></div>
      {compare.length>0?<div className="mt-3 rounded-xl border border-white/10 bg-white/[.025] p-2 text-[.58rem] text-slate-300"><div className="flex flex-wrap items-center gap-2"><strong>المقارنة:</strong>{compare.map((id)=><span key={id} className="rounded-full bg-white/10 px-2 py-1">{DESIGN_WORLDS[id]?.labelAr}</span>)}{compare.length===2?<><label className="flex items-center gap-2">نسبة الأول <input type="range" min="25" max="75" value={fusionRatio} onChange={(e)=>setFusionRatio(Number(e.target.value))}/><span>{fusionRatio}%</span></label><button type="button" className={tiny} disabled={!fusionCompatibility?.allowed} onClick={fuse}>ادمج عالمين</button><span className={fusionCompatibility?.allowed?'text-emerald-300':'text-amber-200'}>{fusionCompatibility?.allowed?`Fusion ${fusionCompatibility.score}/100`:(fusionCompatibility?.critical[0]||'Fusion غير متوافق')}</span></>:<span>اختر عالمين للـFusion أو ثلاثة للمقارنة.</span>}</div></div>:null}
      {notice?<div className="mt-2 rounded-xl border border-amber-300/20 bg-amber-300/[.06] px-3 py-2 text-[.58rem] text-amber-100" role="status">{notice}</div>:null}
      {variant&&audit?<div className="mt-3 grid gap-2 rounded-xl border border-sky-300/15 bg-sky-300/[.045] p-3 text-[.57rem] text-slate-300 md:grid-cols-4"><div><strong className="text-slate-100">سبب الاختيار</strong><br/>{variant.semantic.reasons[0]}</div><div><strong className="text-slate-100">semanticVerb</strong><br/>{variant.semanticVerb}</div><div><strong className="text-slate-100">Quality Score</strong><br/>{audit.score}/100 · {audit.grade}</div><div><strong className="text-slate-100">بصمة التنويع</strong><br/><span className="break-all opacity-75">{variant.perceptualSignature.slice(0,92)}…</span></div>{audit.warnings.length?<div className="md:col-span-4 text-amber-200">تحذيرات: {audit.warnings.join(' · ')}</div>:null}</div>:null}
    </div>
    <div className={`grid gap-3 border-t border-white/10 p-4 ${compact?'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6':'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>{filtered.map((world)=><WorldCard key={world.id} world={world} idea={idea} active={activeWorldId===world.id||variant?.masterWorldId===world.id} favorite={favorites.includes(world.id)} compare={compare.includes(world.id)} onFavorite={()=>toggleFavorite(world.id)} onCompare={()=>toggleCompare(world.id)} onDress={()=>dress(world)} onGenerate={onGenerate?()=>onGenerate(world):undefined}/>)}</div>
  </section>
}
