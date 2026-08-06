#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
const root=process.cwd(); const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'))
const walk=(dir, pred)=>{let n=0; for(const e of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,e.name); if(e.isDirectory()){if(!['node_modules','.git','dist'].includes(e.name))n+=walk(p,pred)}else if(pred(p))n++} return n}
const count=(p,rx)=>existsSync(resolve(root,p))?walk(resolve(root,p),f=>rx.test(f)):0
let commit='unavailable'; try{commit=execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8'}).trim()}catch{}
const node=(pkg.engines?.node||readFileSync(resolve(root,'.nvmrc'),'utf8').trim()).trim()
const react=pkg.dependencies?.react||pkg.devDependencies?.react||'unknown'
const scripts=Object.keys(pkg.scripts||{})
const text=`# PROJECT STATUS\n\nGenerated: ${new Date().toISOString()}\nCommit: ${commit}\nReact: ${react}\nNode: ${node}\nRoutes/pages: ${count('src/pages',/\\.tsx$/)}\nAdmin components: ${count('src/components/admin',/\\.tsx$/)}\nTest commands: ${scripts.filter(x=>/test|self-test|guard|check|verify/.test(x)).length}\nArticles (static): ${count('articles',/\\.(md|mdx|html|json)$/)}\nBooks (static): ${count('books',/\\.(md|mdx|json|pdf)$/)}\nResearch files: ${count('files/research',/./)}\nMedia records/files: ${count('media',/./)}\nEncyclopedia videos fallback: ${JSON.parse(readFileSync(resolve(root,'src/data/encyclopedia-videos-fallback.json'),'utf8')).videos?.length||0}\nTranscript records: ${JSON.parse(readFileSync(resolve(root,'src/data/encyclopedia-video-transcripts.json'),'utf8')).videos?.length||0}\n\nDynamic Firestore counts are intentionally not hard-coded.\n`
writeFileSync(resolve(root,'PROJECT-STATUS.md'),text)
console.log('✓ PROJECT-STATUS.md generated')
