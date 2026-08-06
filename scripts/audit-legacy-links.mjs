#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
const root=resolve(new URL('..',import.meta.url).pathname)
const rows=[]
const add=(source,target,status,file)=>{if(typeof source==='string'&&source.startsWith('/'))rows.push({source,target:String(target||''),status:Number(status||301),file})}
const firebasePath=resolve(root,'firebase.json')
if(existsSync(firebasePath)){const data=JSON.parse(readFileSync(firebasePath,'utf8'));for(const item of data.hosting?.redirects||[])add(item.source,item.destination,item.type||301,'firebase.json')}
const serverPath=resolve(root,'server.mjs')
if(existsSync(serverPath)){const text=readFileSync(serverPath,'utf8');for(const match of text.matchAll(/\[\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\]/g)){if(/legacy|wordpress|\/en\/|\.php|wp-/i.test(match[1]))add(match[1],match[2],301,'server.mjs')}}
const unique=[...new Map(rows.map(item=>[item.source,item])).values()]
const bySource=new Map(unique.map(item=>[item.source,item]))
const chains=[];const loops=[]
for(const item of unique){let current=item;const visited=new Set([item.source]);let hops=1;while(current.target&&bySource.has(current.target)){if(visited.has(current.target)){loops.push(item.source);break}visited.add(current.target);current=bySource.get(current.target);hops+=1;if(hops>25){loops.push(item.source);break}}if(hops>1&&!loops.includes(item.source))chains.push({source:item.source,hops,final:current.target})}
const report={generatedAt:new Date().toISOString(),total:unique.length,status301:unique.filter(item=>item.status===301).length,status302:unique.filter(item=>item.status===302).length,status410:unique.filter(item=>item.status===410).length,chains,loops,rows:unique}
mkdirSync(resolve(root,'reports'),{recursive:true})
writeFileSync(resolve(root,'reports/legacy-links-report.json'),JSON.stringify(report,null,2)+'\n')
writeFileSync(resolve(root,'reports/legacy-links-report.md'),`# تدقيق الروابط القديمة\n\n- الإجمالي: ${report.total}\n- 301: ${report.status301}\n- 302: ${report.status302}\n- 410: ${report.status410}\n- السلاسل: ${chains.length}\n- الحلقات: ${loops.length}\n`)
console.log(`✓ legacy links: ${report.total}, chains: ${chains.length}, loops: ${loops.length}`)
if(report.status302||loops.length)process.exitCode=1
