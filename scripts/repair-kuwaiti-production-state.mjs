#!/usr/bin/env node
/**
 * مدخل واحد لاستعادة حالة الإنتاج من مصادرها الثلاثة الصحيحة:
 *   1) شهادات نشر GitHub Actions المحفوظة في تاريخ Git.
 *   2) وجود الملف المطابق على R2 — وجوده وحده لا يمنحه الجودة.
 *   3) شهادات تأجيل الجودة للحلقات التي استنفدت 18 Take.
 *
 * المنطق الفعلي مقسّم إلى حراس مستقلة ومختبرة حتى لا تنشأ نسخة رابعة من
 * قواعد النشر هنا. هذا الملف يشغّلها بالترتيب نفسه الذي يستعمله الـworkflow.
 * لا commit ولا push، والكتابة لا تحدث إلا مع --apply.
 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--apply')
const SELF_TEST = process.argv.includes('--self-test')
const BASE = (process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')

function run(script, args = [], env = process.env) {
  const result = spawnSync(process.execPath, [resolve(ROOT, script), ...args], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status || 1)
}

if (SELF_TEST) {
  run('scripts/guard-audio-meta-regression.mjs', ['--self-test'])
  run('scripts/reconcile-audio-meta.mjs', ['--self-test'])
  run('scripts/guard-kuwaiti-quality-holds-regression.mjs', ['--self-test'])
  console.log('✓ بوابة استعادة الإنتاج: الشهادة + R2 + التأجيل')
  process.exit(0)
}

if (!BASE) {
  console.error('✘ AUDIO_PUBLIC_BASE_URL مفقود؛ ممنوع إصلاح سجل عام من غير إثبات R2.')
  process.exit(1)
}

const shallow = spawnSync('git', ['rev-parse', '--is-shallow-repository'], {
  cwd: ROOT, encoding: 'utf8',
}).stdout?.trim()
if (shallow === 'true') {
  console.error('✘ تاريخ Git ضحل؛ اجلب التاريخ كاملاً قبل استعادة شهادات البوت.')
  process.exit(1)
}

const write = APPLY ? ['--apply'] : []
run('scripts/guard-audio-meta-regression.mjs', write, {
  ...process.env, AUDIO_PUBLIC_BASE_URL: BASE,
})
run('scripts/reconcile-audio-meta.mjs', [...write, '--kuwaiti-only'], {
  ...process.env, AUDIO_PUBLIC_BASE_URL: BASE,
})
run('scripts/guard-kuwaiti-quality-holds-regression.mjs', write)

console.log(APPLY
  ? '✓ استُعيدت حالة الإنتاج محلياً من شهادات البوت وR2؛ لم يحدث commit أو push.'
  : 'ⓘ فحص جاف فقط؛ أضف --apply لكتابة السجلين محلياً بعد مراجعة الناتج.')
