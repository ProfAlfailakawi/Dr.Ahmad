import assert from 'node:assert/strict'; import fs from 'node:fs'
const read=(p)=>fs.readFileSync(p,'utf8'); const json=(p)=>JSON.parse(read(p))
const graph=json('src/data/knowledge-graph.json'); assert.ok(graph.nodes.length>=190); assert.ok(graph.edges.length>1000); assert.equal(graph.version,1)
const guardian=json('src/data/site-guardian.json'); assert.ok(guardian.counts.articles>=140); assert.ok(typeof guardian.status==='string')
const engine=read('src/lib/social-design-engine.ts'); assert.match(engine,/fingerprintDesign/); assert.match(engine,/critiqueCompositionPlan/); assert.match(engine,/requestedCount = 8/); assert.match(engine,/visibleCount = 4/); assert.match(engine,/generateSocialCampaign/)
const studio=read('src/components/admin/SocialDesignStudio.tsx'); assert.match(studio,/QUALITY_THRESHOLD_KEY/); assert.match(studio,/منع محرك الجودة التصدير/); assert.match(studio,/الخط الزمني المقترح للحملة/)
const whatsapp=read('whatsapp-agent/content-index.mjs'); assert.match(whatsapp,/رسم معرفة خفيف داخل الفهرس/); assert.match(whatsapp,/item\.related/)
const admin=read('src/pages/Admin.tsx'); assert.match(admin,/ProductionMonitor/); assert.match(admin,/(tab === 'monitor'|monitor:\s*<ProductionMonitor)/)
console.log(JSON.stringify({ok:true,systems:10,knowledgeNodes:graph.nodes.length,knowledgeEdges:graph.edges.length,guardianArticles:guardian.counts.articles},null,2))
