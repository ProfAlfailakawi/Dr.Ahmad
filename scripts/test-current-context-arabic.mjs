import assert from 'node:assert/strict'
import { localizeCurrentContextItems } from '../server.mjs'

const source = 'MIT Technology Review'
const url = 'https://example.com/original'
const items = await localizeCurrentContextItems([
  { id: 'montana', title: 'The Download: Montana&#8217;s new experimental drug rules', source, url },
  { id: 'laptop', title: 'Schools are rethinking whether every student needs a laptop', source: 'The Conversation', url },
])

assert.equal(items[0].titleAr, 'ذا داونلود: قواعد مونتانا التجريبية الجديدة لتنظيم الأدوية')
assert.equal(items[0].originalTitle, 'The Download: Montana’s new experimental drug rules')
assert.equal(items[0].source, source, 'اسم المرجع يجب أن يبقى كما ورد')
assert.equal(items[0].url, url, 'رابط المرجع يجب ألا يتغير')
assert.match(items[1].titleAr, /المدارس تعيد النظر/)
assert.doesNotMatch(items.map((item) => item.titleAr).join(' '), /&#\d+;/)

console.log('✓ تعريب اللحظة الحالية: العناوين عربية والمراجع الأصلية محفوظة')
