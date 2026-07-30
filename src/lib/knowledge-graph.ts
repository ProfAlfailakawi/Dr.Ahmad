import type { ArticleRecord, BookRecord, MediaRecord, PaperRecord } from './cms'

export type KnowledgeKind = 'article' | 'book' | 'paper' | 'media' | 'curated' | 'podcast' | 'audio' | 'social' | 'concept'
export type KnowledgeNode = { id:string; kind:KnowledgeKind; slug:string; title:string; text:string; url:string; year?:string; tokens:string[] }
export type KnowledgeEdge = { from:string; to:string; score:number; reasons:string[] }
export type KnowledgeGraph = { version:1|2; builtAt:string; nodes:KnowledgeNode[]; edges:KnowledgeEdge[]; byId:Record<string,KnowledgeNode>; neighbors:Record<string,KnowledgeEdge[]> }

const normalize = (value='') => value.toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ؤئ]/g,'ء').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim()
const stop = new Set('من في على الى عن هذا هذه ذلك التي الذي مع او ثم ما ماذا كيف هل لم لن قد كل بين عند بعد قبل هو هي كان تكون يكون'.split(' '))
const tokens = (value:string) => [...new Set(normalize(value).split(' ').filter((word)=>word.length>2&&!stop.has(word)))].slice(0,80)
const overlap = (a:string[],b:string[]) => { const bs=new Set(b); return a.filter((x)=>bs.has(x)).length }
const node = (kind:KnowledgeKind, item:any, text:string, url:string):KnowledgeNode => ({ id:`${kind}:${item.slug}`, kind, slug:item.slug, title:item.title, text, url, year:String(item.year||item.iso||'').slice(0,4)||undefined, tokens:tokens(`${item.title} ${text}`) })

export function buildKnowledgeGraph(input:{articles:ArticleRecord[];books:BookRecord[];papers:PaperRecord[];media?:MediaRecord[]}):KnowledgeGraph {
  const nodes:KnowledgeNode[] = [
    ...input.articles.map((x)=>node('article',x,`${x.cat||''} ${x.excerpt||''} ${x.body||''}`,`/articles/${x.slug}`)),
    ...input.books.map((x:any)=>node('book',x,`${x.desc||''} ${x.meta||''}`,`/publications/${x.slug}`)),
    ...input.papers.map((x:any)=>node('paper',x,`${x.abstractAr||''} ${x.meta||''} ${x.journal||''}`,`/research/${x.slug}`)),
    ...(input.media||[]).map((x:any)=>node('media',x,`${x.desc||''} ${x.meta||''}`,`/media/${x.slug}`)),
  ].filter((x)=>x.slug)
  const edges:KnowledgeEdge[]=[]
  for(let i=0;i<nodes.length;i+=1) for(let j=i+1;j<nodes.length;j+=1){
    const a=nodes[i],b=nodes[j], common=overlap(a.tokens,b.tokens)
    const titleCommon=overlap(tokens(a.title),tokens(b.title))
    const crossKind=a.kind!==b.kind?1:0
    const score=common*2+titleCommon*5+crossKind+(a.year&&a.year===b.year?1:0)
    if(score<7) continue
    const reasons=[titleCommon?'تقاطع مباشر في العنوان':'',common>=4?'محور معرفي مشترك':'',crossKind?'امتداد بين نوعين من المحتوى':''].filter(Boolean)
    edges.push({from:a.id,to:b.id,score,reasons}); edges.push({from:b.id,to:a.id,score,reasons})
  }
  edges.sort((a,b)=>b.score-a.score)
  const byId=Object.fromEntries(nodes.map((x)=>[x.id,x]))
  const neighbors:Record<string,KnowledgeEdge[]>={}
  for(const edge of edges) (neighbors[edge.from]||=[]).push(edge)
  for(const key of Object.keys(neighbors)) neighbors[key]=neighbors[key].slice(0,12)
  return {version:1,builtAt:new Date().toISOString(),nodes,edges,byId,neighbors}
}

export function graphSearch(graph:KnowledgeGraph, query:string, limit=20){
  const q=tokens(query)
  return graph.nodes.map((n)=>({node:n,score:overlap(q,n.tokens)*3+overlap(q,tokens(n.title))*8})).filter((x)=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit)
}

export function graphNeighbors(graph:KnowledgeGraph,id:string,limit=6){ return (graph.neighbors[id]||[]).slice(0,limit).map((e)=>({edge:e,node:graph.byId[e.to]})).filter((x)=>x.node) }
