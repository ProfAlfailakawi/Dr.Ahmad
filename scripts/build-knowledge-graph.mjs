import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { buildContentIndex, normalizeArabic } from '../whatsapp-agent/content-index.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'); const items=buildContentIndex(root)
const stop=new Set('من في على الى عن هذا هذه ذلك التي الذي مع او ثم ما ماذا كيف هل لم لن قد كل بين عند بعد قبل'.split(' '))
const tok=(v)=>[...new Set(normalizeArabic(v).split(' ').filter((x)=>x.length>2&&!stop.has(x)))].slice(0,100)
const nodes=items.map((item)=>({id:item.id,kind:item.kind,slug:item.slug,title:item.title,url:item.url,tokens:tok(`${item.title} ${item.excerpt} ${item.keywords}`)}))
const edges=[]; for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const a=nodes[i],b=nodes[j],bs=new Set(b.tokens),common=a.tokens.filter((x)=>bs.has(x)).length;const titleA=tok(a.title),titleB=new Set(tok(b.title)),titles=titleA.filter((x)=>titleB.has(x)).length;const score=common*2+titles*5+(a.kind!==b.kind?1:0);if(score<7)continue;edges.push({from:a.id,to:b.id,score});edges.push({from:b.id,to:a.id,score})}
edges.sort((a,b)=>b.score-a.score); const graph={version:1,builtAt:new Date().toISOString(),nodes,edges}
fs.writeFileSync(path.join(root,'src/data/knowledge-graph.json'),JSON.stringify(graph,null,2)+'\n'); console.log(`Knowledge graph: ${nodes.length} nodes / ${edges.length} directed edges`)
