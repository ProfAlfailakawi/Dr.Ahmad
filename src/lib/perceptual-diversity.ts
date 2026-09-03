import type { CompositionPlan } from './social-design-engine'
import type { ProceduralWorldResult } from './procedural-world-engine'

export interface PerceptualVector {
  layout:string; center:string; reading:string; framing:string; negativeSpace:string; blocks:string; material:string; depth:string; lighting:string; metaphor:string; motion:string; rhythm:string; typography:string; palette:string; visualWeight:string; density:string; world:string
}
export interface PerceptualSelectionOptions<T>{count?:number;minDistance?:number;score?:(item:T)=>number;signature?:(item:T)=>string;excludeSignatures?:Iterable<string>}
const memory:string[]=[]
const MAX_MEMORY=20
const fields:(keyof PerceptualVector)[]=['layout','center','reading','framing','negativeSpace','blocks','material','depth','lighting','metaphor','motion','rhythm','typography','palette','visualWeight','density','world']
const weights:Partial<Record<keyof PerceptualVector,number>>={layout:1.6,center:1.2,reading:1,framing:1.1,negativeSpace:1.2,blocks:1.2,material:1.25,depth:1.15,lighting:1,metaphor:1.55,motion:1.35,rhythm:1.1,typography:1.25,palette:.85,visualWeight:1,density:1,world:1.5}
function tokenDistance(a:string,b:string){if(a===b)return 0; const A=new Set(a.split(/[|:+]/).filter(Boolean)),B=new Set(b.split(/[|:+]/).filter(Boolean)); const union=new Set([...A,...B]); if(!union.size)return 0; let common=0; A.forEach((x)=>{if(B.has(x))common+=1}); return 1-common/union.size}
export function perceptualDistance(a:PerceptualVector,b:PerceptualVector){let sum=0,total=0; for(const field of fields){const w=weights[field]||1; sum+=tokenDistance(a[field],b[field])*w; total+=w} return total?sum/total:0}
export function vectorFromWorld(result:ProceduralWorldResult):PerceptualVector { const w=result.world; return {layout:result.layoutGenome,center:w.spatial,reading:'rtl',framing:w.framing,negativeSpace:`${w.spatial}:${result.axes.density}`,blocks:`${w.layout}:${w.layoutGrammar.join('+')}`,material:result.materialProfile,depth:result.depthGenome,lighting:result.axes.lighting,metaphor:result.semantic.visualMetaphor,motion:result.motionProfile,rhythm:result.axes.rhythm,typography:result.typographyGenome,palette:result.paletteGenome,visualWeight:`${result.axes.energy}:${result.axes.depth}`,density:result.axes.density,world:`${result.familyId}:${result.masterWorldId}`}}
export function vectorFromPlan(plan:CompositionPlan,worldSignature=''):PerceptualVector {const g=plan.geometry; return {layout:plan.layout,center:plan.spatial,reading:'rtl',framing:plan.framing,negativeSpace:`${g.safeInset}:${plan.spatial}`,blocks:`${plan.layout}:${plan.accent}`,material:'renderer',depth:plan.spatial,lighting:plan.paletteOverride?.atmo?.edgeLight?'edge':'base',metaphor:plan.content.heroWord||plan.content.title,motion:'static',rhythm:plan.density,typography:plan.typography,palette:plan.paletteOverride?.label||plan.palette,visualWeight:`${plan.accent}:${plan.typography}`,density:plan.density,world:worldSignature||plan.paletteOverride?.label||''}}

/** Greedy Max-Min: the first result is the strongest; every next result maximises its distance to the closest already selected result. */
export function greedyMaxMin<T>(items:T[],vector:(item:T)=>PerceptualVector,count=3,score:(item:T)=>number=()=>0):T[]{
  if(!items.length||count<=0)return[]
  const pool:T[]=[...items]
  pool.sort((a,b)=>score(b)-score(a))
  const selected:T[]=[]
  const first=pool.shift(); if(first===undefined)return selected; selected.push(first)
  while(pool.length&&selected.length<count){
    let bestIndex=0,best=-Infinity
    pool.forEach((candidate,index)=>{const min=Math.min(...selected.map((chosen)=>perceptualDistance(vector(candidate),vector(chosen)))); const value=min+Math.min(.1,Math.max(-.1,score(candidate)/1000)); if(value>best){best=value;bestIndex=index}})
    const next=pool.splice(bestIndex,1)[0]; if(next!==undefined)selected.push(next)
  }
  return selected
}

export function selectPerceptuallyDiverse<T>(items:T[],vector:(item:T)=>PerceptualVector,options:PerceptualSelectionOptions<T>={}):T[]{
  const count=options.count??3,minDistance=options.minDistance??.44,score=options.score??(()=>0),signature=options.signature
  const excluded=new Set(options.excludeSignatures||[])
  const candidates=items.filter((item)=>!signature||!excluded.has(signature(item)))
  const selected=greedyMaxMin(candidates,vector,Math.max(count,Math.min(candidates.length,count*4)),score)
  const accepted:T[]=[]
  for(const candidate of selected){const distance=accepted.length?Math.min(...accepted.map((x)=>perceptualDistance(vector(candidate),vector(x)))):1;if(distance>=minDistance||accepted.length===0)accepted.push(candidate);if(accepted.length>=count)break}
  if(accepted.length<count){for(const candidate of selected){if(accepted.includes(candidate))continue;accepted.push(candidate);if(accepted.length>=count)break}}
  return accepted
}
export function pairwiseMinimumDistance<T>(items:T[],vector:(item:T)=>PerceptualVector){if(items.length<2)return 1;let min=1;for(let i=0;i<items.length;i+=1)for(let j=i+1;j<items.length;j+=1)min=Math.min(min,perceptualDistance(vector(items[i]),vector(items[j])));return min}

export function rememberPerceptualSignature(signature:string){if(!signature)return; const i=memory.indexOf(signature); if(i>=0)memory.splice(i,1); memory.push(signature); while(memory.length>MAX_MEMORY)memory.shift(); try{localStorage.setItem('dr-ahmad-world-signatures-v2',JSON.stringify(memory))}catch{/* SSR/privacy */}}
export function recentPerceptualSignatures(){try{const stored=JSON.parse(localStorage.getItem('dr-ahmad-world-signatures-v2')||'[]'); if(Array.isArray(stored)) return stored.slice(-MAX_MEMORY).map(String)}catch{/* ignore */} return [...memory]}
export function signatureNovelty(signature:string){const recent=recentPerceptualSignatures(); return recent.includes(signature)?0:Math.max(.2,1-recent.filter((x)=>x.split('::')[0]===signature.split('::')[0]).length*.16)}
