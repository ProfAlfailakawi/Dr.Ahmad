#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js')
const source=readFileSync(new URL('../src/lib/bibtex.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const mod=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const assert=(condition,message)=>{if(!condition)throw new Error(message)}
const english=mod.buildBibTeX({type:'article',authors:['Ahmad Alfailakawi','Jane Doe'],title:'Educational Technology {AI}',journal:'Journal',year:2024,volume:'2',number:'1',pages:'1--20',doi:'10.1/test',url:'https://example.com'})
assert(english.includes('@article{Ahmad2024Educational'),'stable English key')
assert(english.includes('Ahmad Alfailakawi and Jane Doe'),'multiple authors')
assert(english.includes('doi = {10.1/test}'),'DOI')
const arabic=mod.buildBibTeX({type:'book',authors:['أحمد الفيلكاوي'],title:'موسوعة تكنولوجيا التعليم',year:2026,publisher:'دار المعرفة',language:'ar'})
assert(arabic.includes('موسوعة تكنولوجيا التعليم'),'Arabic Unicode preserved')
assert(arabic.includes('@book{'),'book type')
assert(!arabic.includes('doi ='),'empty fields hidden')
const thesis=mod.buildBibTeX({type:'phdthesis',authors:['اسم مركب'],title:'عنوان (تجريبي) "خاص"',year:2025,publisher:'جامعة الكويت'})
assert(thesis.includes('@phdthesis{'),'thesis type')
assert(!thesis.includes('undefined'),'no fabricated values')
console.log('✓ BibTeX: العربية والإنجليزية والمؤلفون والحقول الاختيارية والمفتاح الثابت')
