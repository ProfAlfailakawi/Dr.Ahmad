/* يولّد جدول المصفوفة (الشاشات × الوضعيات A–J) من audit-after.json وaudit-routes.json وlive-and-stress.json.
   node docs/iphone-duo-final/make-matrix.cjs > /tmp/matrix.md */
const fs = require('fs')
const path = require('path')
const load = (f) => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')) } catch { return null } }
const after = load('audit-after.json')
const routes = load('audit-routes.json')
const live = load('live-and-stress.json')
const rows = [...(routes ? routes.rows : []), ...(after ? after.rows : [])] // after يغلب: أحدث وأوسع
// صفحات صُمّم لها الكتاب المفتوح وروجعت لقطاتها بالعين.
const DESIGNED = new Set(['article', 'articles', 'publications', 'book', 'search-empty', 'search-start', 'contact', 'mihwar', 'not-found', 'mylib', 'privacy', 'terms', 'data-deletion',
  // الجزآن 3 و4 (لقطات C/D روجعت بالعين لكل منها):
  'home', 'launch', 'live', 'research', 'paper', 'encyclopedia', 'listen', 'radio', 'search-askbook', 'ask', 'decade', 'thought-paths', 'paths', 'path',
  'concept', 'thought', 'atlas', 'media', 'media-detail', 'questions', 'radar', 'admin', 'curated', 'upcoming', 'inbox', 'about', 'cv', 'impact', 'cv-file',
  'card', 'cards', 'en', 'en-cv', 'en-research', 'en-contact'])
const REVIEWED = new Set(['home', 'article', 'articles', 'publications', 'book', 'search-empty', 'contact', 'mihwar', 'not-found', 'privacy'])
const POSES = {
  A: ['382x580', '385x571', '320x568'], B: ['594x368'], C: ['669x867'], D: ['951x585'], E: ['951x350', '600x350'],
  F: ['669x520', '600x480'], G: ['768x1024', '1024x768', '1280x800', '1440x900'], H: ['360x640', '390x844', '844x390'],
}
const INNER = new Set(['669x867', '951x585', '669x520'])
const pages = [...new Set([...(after ? after.rows : []), ...(routes ? routes.rows : [])].map((r) => r.page))]
const pathOf = (p) => rows.find((r) => r.page === p).path
const cell = (page, pose) => {
  // آخر قياس لكل مقاس يغلب.
  const m = new Map()
  for (const r of rows) if (r.page === page && POSES[pose].includes(`${r.w}x${r.h}`)) m.set(`${r.w}x${r.h}`, r)
  const got = [...m.values()]
  if (!got.length) return 'NOT_TESTED'
  const ox = got.some((r) => r.top.overflowX > 0)
  const clip = got.reduce((s, r) => s + r.top.clipped.length, 0)
  const spine = got.reduce((s, r) => s + (INNER.has(`${r.w}x${r.h}`) ? r.top.spineHits.length + (r.mid ? r.mid.spineHits.length : 0) : 0), 0)
  if (ox || clip) return `FAIL (${ox ? 'تمرير أفقي' : ''}${clip ? ` ${clip} مقصوص` : ''})`
  if (['C', 'D', 'F'].includes(pose)) {
    if (spine) return `PARTIAL (${spine} على الكعب)`
    return DESIGNED.has(page) ? 'PASS' : 'PASS·م'
  }
  return REVIEWED.has(page) ? 'PASS' : 'PASS·م'
}
const liveCell = (page) => {
  if (!live) return 'NOT_TESTED'
  const map = { article: 'article', contact: 'contact', mihwar: 'mihwar', articles: 'dialog', listen: 'listen' }
  const k = map[page]
  if (!k || !live.live[k]) return 'NOT_TESTED'
  return 'PASS'
}
const stressCell = (page) => {
  if (!live) return 'NOT_TESTED'
  const p = pathOf(page).split('?')[0]
  const hits = live.stress.filter((s) => s.page === p)
  if (!hits.length) return 'NOT_TESTED'
  return hits.some((s) => s.overflowX > 0) ? 'FAIL' : 'PARTIAL'
}
let md = '| الشاشة | المسار | A | B | C | D | E | F | G | H | I | J |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n'
for (const p of pages) {
  md += `| ${p} | \`${pathOf(p)}\` | ${['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((k) => cell(p, k)).join(' | ')} | ${liveCell(p)} | ${stressCell(p)} |\n`
}
process.stdout.write(md)
