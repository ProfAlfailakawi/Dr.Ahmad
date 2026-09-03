#!/usr/bin/env node
/** حارس خفيف لميزانية الأداء؛ يمنع رجوع الحزمة الرئيسية إلى ملف ضخم واحد. */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')
const index = readFileSync(resolve(DIST, 'index.html'), 'utf8')
const source = /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(index)?.[1]
if (!source) { console.error('✘ performance: لم أجد حزمة الدخول'); process.exit(1) }
const entry = resolve(DIST, source.replace(/^\//, ''))
if (!existsSync(entry)) { console.error(`✘ performance: حزمة الدخول مفقودة ${source}`); process.exit(1) }
const entryBytes = statSync(entry).size
if (entryBytes > 520_000) { console.error(`✘ performance: حزمة الدخول ${Math.round(entryBytes / 1024)}KB؛ تجاوزت 520KB`); process.exit(1) }

/* ── حارس الجرد الإداريّ في حزمة الدخول ──
   السقف وحده لا يكفي: الميزانية انكسرت يوم ٧ أغسطس ٢٠٢٦ لا بكودٍ جديد، بل
   لأنّ `audio-meta.json` (جرد R2 ببصماته الكاملة) كان مستورداً في `extras.tsx`
   فينمو مع كل حلقةٍ ترفعها قافلة الصوت حتى بلغ ٥٩١KB. وحين احمرّت هذه المرحلة
   توقّف معها **نشر dr-api نفسه**، فبقي عقل الواتساب على نسخةٍ قديمة أياماً
   وكل إصلاحٍ يُدفع لا يصل الناس. فالعطب لم يكن في الأداء وحده.
   الرقم يتحرّك بالمحتوى، أما هذا الشرط فيمسك السبب: لا سجلّ بصماتٍ في حزمة
   الدخول. الطريق الصحيح `src/data/audio-fingerprints.json` (بصمة ١٦ خانة). */
const entryText = readFileSync(entry, 'utf8')
const inventoryHashes = (entryText.match(/[a-f0-9]{64}/g) || []).length
if (inventoryHashes > 20) {
  console.error(`✘ performance: حزمة الدخول تحمل جرداً ببصمات كاملة (${inventoryHashes} بصمة sha256).`)
  console.error('  السبب المعتاد: استيراد src/data/audio-meta.json في مكوّنٍ داخل حزمة الدخول.')
  console.error('  العلاج: استورد src/data/audio-fingerprints.json — وأبقِ السجلّ الكامل للوحة التحكم وحدها.')
  process.exit(1)
}

const assets = resolve(DIST, 'assets')
const js = readdirSync(assets).filter((name) => name.endsWith('.js')).map((name) => statSync(resolve(assets, name)).size)
if (js.length < 8) { console.error(`✘ performance: تقسيم الكود غير كافٍ (${js.length} حزم فقط)`); process.exit(1) }
if (!index.includes('/portrait.webp')) { console.error('✘ performance: صورة LCP ليست WebP'); process.exit(1) }
console.log(`✔ performance: دخول ${Math.round(entryBytes / 1024)}KB · ${js.length} حزمة كسولة · LCP WebP`)
