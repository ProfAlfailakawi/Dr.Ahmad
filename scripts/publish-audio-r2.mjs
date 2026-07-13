#!/usr/bin/env node
/**
 * يرفع أي ملفات صوت/Transcript محلية جديدة إلى Cloudflare R2 ويحدّث audio-meta.json.
 * يستخدم بعد auto-audio أو podcast-dialogue، ولا يضيف MP3 إلى Git.
 */
import { existsSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO = resolve(ROOT, 'audio')
const META = resolve(ROOT, 'src/data/audio-meta.json')

function loadEnvironment() {
  const values = { ...process.env }
  const file = resolve(ROOT, '.env')
  if (!existsSync(file)) return values
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (match && !values[match[1]]) values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2')
  }
  return values
}

const env = loadEnvironment()
const base = (env.AUDIO_PUBLIC_BASE_URL || env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const bucket = env.CLOUDFLARE_R2_BUCKET || env.R2_BUCKET || ''
const endpoint = env.CLOUDFLARE_R2_ENDPOINT || ''
const key = env.CLOUDFLARE_R2_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID || ''
const secret = env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY || ''

if (!base || !bucket || !endpoint || !key || !secret) {
  console.error('✘ إعدادات R2 غير مكتملة: AUDIO_PUBLIC_BASE_URL + CLOUDFLARE_R2_BUCKET/ENDPOINT/ACCESS_KEY_ID/SECRET_ACCESS_KEY')
  process.exit(1)
}
if (!existsSync(AUDIO)) {
  console.log('لا يوجد مجلد audio؛ لا شيء للنشر.')
  process.exit(0)
}

const files = readdirSync(AUDIO).filter((name) => /\.(mp3|json)$/i.test(name)).sort()
const meta = existsSync(META) ? JSON.parse(readFileSync(META, 'utf8')) : {}

function durationSeconds(file) {
  const probe = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ], { encoding: 'utf8', timeout: 20_000 })
  if (probe.status !== 0) return null
  const seconds = Math.round(Number(probe.stdout.trim()))
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

function upload(name) {
  const file = resolve(AUDIO, name)
  const isJson = name.endsWith('.json')
  const result = spawnSync('aws', [
    's3', 'cp', file, `s3://${bucket}/${name}`,
    '--endpoint-url', endpoint,
    '--cache-control', isJson ? 'public, max-age=300' : 'public, max-age=31536000, immutable',
    '--content-type', isJson ? 'application/json; charset=utf-8' : 'audio/mpeg',
    '--no-progress',
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      AWS_ACCESS_KEY_ID: key,
      AWS_SECRET_ACCESS_KEY: secret,
      AWS_EC2_METADATA_DISABLED: 'true',
    },
    timeout: 120_000,
  })
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || '').trim() || `فشل رفع ${name}`)
}

let uploaded = 0
for (const name of files) {
  upload(name)
  uploaded += 1
  if (name.endsWith('.mp3')) {
    const file = resolve(AUDIO, name)
    meta[name] = {
      bytes: statSync(file).size,
      durationSeconds: durationSeconds(file) || meta[name]?.durationSeconds || null,
    }
  }
}

const rendered = `${JSON.stringify(Object.fromEntries(Object.entries(meta).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`
const tmp = `${META}.tmp-${process.pid}`
try {
  writeFileSync(tmp, rendered, 'utf8')
  renameSync(tmp, META)
} finally {
  if (existsSync(tmp)) unlinkSync(tmp)
}

console.log(`✔ نُشر إلى R2: ${uploaded} ملفاً · ${base}`)
