import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

export function readJson(filePath, fallback = null) {
  try { return JSON.parse(readFileSync(filePath, 'utf8')) } catch { return fallback }
}

export function writeJsonAtomic(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true })
  const temp = `${filePath}.${process.pid}.tmp`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  try {
    renameSync(temp, filePath)
  } finally {
    rmSync(temp, { force: true })
  }
}

export function parseArgs(argv) {
  const options = {
    modelType: 'fasterwhisper',
    modelSize: 'medium',
    language: 'ar',
    force: false,
    keepAudio: false,
    skipDownload: false,
    dryRun: false,
    limit: Infinity,
    videoIds: [],
    retries: 2,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--force') options.force = true
    else if (arg === '--keep-audio') options.keepAudio = true
    else if (arg === '--skip-download') options.skipDownload = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--model-type') options.modelType = argv[++index] || options.modelType
    else if (arg === '--model-size') options.modelSize = argv[++index] || options.modelSize
    else if (arg === '--language') options.language = argv[++index] || options.language
    else if (arg === '--limit') options.limit = Math.max(0, Number(argv[++index]) || 0)
    else if (arg === '--video-id') options.videoIds.push(argv[++index])
    else if (arg === '--retries') options.retries = Math.max(0, Number(argv[++index]) || 0)
  }
  options.videoIds = options.videoIds.filter(Boolean)
  return options
}

function commandExists(command, args = ['--version'], timeout = 8_000) {
  const result = spawnSync(command, args, { stdio: 'ignore', shell: false, timeout })
  return result.status === 0
}

export function resolveBuzzCommand(platform = process.platform) {
  const candidates = []
  if (process.env.BUZZ_COMMAND) candidates.push({ command: process.env.BUZZ_COMMAND, prefix: [] })
  candidates.push({ command: 'buzz', prefix: [] })
  if (platform === 'darwin') candidates.push({ command: '/Applications/Buzz.app/Contents/MacOS/Buzz', prefix: [] })
  if (platform === 'win32') {
    candidates.push({ command: 'C:\\Program Files\\Buzz\\Buzz.exe', prefix: [] })
    candidates.push({ command: 'C:\\Program Files (x86)\\Buzz\\Buzz.exe', prefix: [] })
  }
  for (const candidate of candidates) {
    if ((candidate.command.includes('/') || candidate.command.includes('\\')) && !existsSync(candidate.command)) continue
    if (commandExists(candidate.command, ['--help'])) return candidate
  }
  if (commandExists('python', ['-m', 'buzz', '--version'])) return { command: 'python', prefix: ['-m', 'buzz'] }
  if (commandExists('python3', ['-m', 'buzz', '--version'])) return { command: 'python3', prefix: ['-m', 'buzz'] }
  return null
}

export function resolveYtDlpCommand() {
  if (process.env.YTDLP_COMMAND && commandExists(process.env.YTDLP_COMMAND)) return { command: process.env.YTDLP_COMMAND, prefix: [] }
  if (commandExists('yt-dlp')) return { command: 'yt-dlp', prefix: [] }
  if (commandExists('python', ['-m', 'yt_dlp', '--version'])) return { command: 'python', prefix: ['-m', 'yt_dlp'] }
  if (commandExists('python3', ['-m', 'yt_dlp', '--version'])) return { command: 'python3', prefix: ['-m', 'yt_dlp'] }
  return null
}

export function completedVideoIds(index) {
  return new Set(Object.values(index?.records || {})
    .filter((record) => (record?.available && Array.isArray(record.segments) && record.segments.length > 0) || record?.status === 'no-speech')
    .map((record) => record.videoId))
}

export function buildQueue(catalog, index, options = {}) {
  const completed = completedVideoIds(index)
  const requested = new Set(options.videoIds || [])
  return (catalog?.videos || [])
    .filter((video) => video?.id && video?.url)
    .filter((video) => !requested.size || requested.has(video.id))
    .filter((video) => options.force || !completed.has(video.id))
    .slice(0, Number.isFinite(options.limit) ? options.limit : undefined)
}

function run(commandSpec, args, { cwd, env = process.env, stdio = 'inherit' } = {}) {
  const result = spawnSync(commandSpec.command, [...(commandSpec.prefix || []), ...args], { cwd, env, stdio, shell: false })
  return { ok: result.status === 0, status: result.status, error: result.error }
}

function matchingFiles(dir, videoId, extensions) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.includes(videoId) && extensions.includes(extname(name).toLowerCase()))
    .map((name) => join(dir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
}

export function findTranscriptFile(dir, videoId) {
  return matchingFiles(dir, videoId, ['.vtt', '.srt', '.json'])[0] || null
}

export function findAudioFile(dir, videoId) {
  return matchingFiles(dir, videoId, ['.m4a', '.mp3', '.wav', '.webm', '.opus', '.mp4'])[0] || null
}

export function downloadAudio({ ytDlp, video, audioDir, dryRun = false }) {
  mkdirSync(audioDir, { recursive: true })
  const existing = findAudioFile(audioDir, video.id)
  if (existing) return existing
  if (dryRun) return join(audioDir, `${video.id}.m4a`)
  const template = join(audioDir, '%(id)s.%(ext)s')
  const browser = process.env.YTDLP_COOKIES_BROWSER || (process.platform === 'darwin' ? 'safari' : '')
  const browserArgs = browser && process.env.YTDLP_NO_BROWSER_COOKIES !== '1'
    ? ['--cookies-from-browser', browser]
    : []
  const result = run(ytDlp, [
    ...browserArgs,
    '--js-runtimes', 'node',
    '--remote-components', 'ejs:github',
    '--no-playlist', '--extract-audio', '--audio-format', 'm4a', '--audio-quality', '0',
    '--write-info-json', '--no-overwrites', '--output', template, video.url,
  ])
  if (!result.ok) throw new Error(`تعذر تنزيل الصوت للفيديو ${video.id}`)
  const file = findAudioFile(audioDir, video.id)
  if (!file) throw new Error(`اكتمل التنزيل لكن لم يُعثر على ملف الصوت للفيديو ${video.id}`)
  return file
}

export function transcribeWithBuzz({ buzz, audioFile, transcriptDir, videoId, modelType, modelSize, language, dryRun = false }) {
  mkdirSync(transcriptDir, { recursive: true })
  const target = join(transcriptDir, `${videoId}.vtt`)
  if (existsSync(target)) return target
  if (dryRun) return target
  const before = new Set(readdirSync(dirname(audioFile)))
  const result = run(buzz, [
    'add', '--task', 'transcribe', '--model-type', modelType, '--model-size', modelSize,
    '--language', language, '--vtt', '--hide-gui', audioFile,
  ], { cwd: dirname(audioFile), env: { ...process.env, BUZZ_DISABLE_TELEMETRY: 'true' } })
  if (!result.ok) throw new Error(`فشل Buzz في تفريغ الفيديو ${videoId}`)
  const candidates = matchingFiles(dirname(audioFile), videoId, ['.vtt'])
    .filter((file) => !before.has(basename(file)) || statSync(file).mtimeMs >= statSync(audioFile).mtimeMs)
  const generated = candidates[0]
  if (!generated) throw new Error(`أنهى Buzz المهمة لكن لم يُنشئ ملف VTT للفيديو ${videoId}`)
  writeFileSync(target, readFileSync(generated))
  if (resolve(generated) !== resolve(target)) rmSync(generated, { force: true })
  return target
}

export function cleanupAudio(audioFile) {
  if (!audioFile || !existsSync(audioFile)) return
  rmSync(audioFile, { force: true })
  const infoFile = audioFile.replace(/\.[^.]+$/, '.info.json')
  rmSync(infoFile, { force: true })
}

export function createInitialState(total) {
  return { version: 1, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), total, completed: {}, failed: {} }
}

export function updateState(filePath, state) {
  state.updatedAt = new Date().toISOString()
  writeJsonAtomic(filePath, state)
}

export function ensureTools({ skipDownload = false } = {}) {
  const buzz = resolveBuzzCommand()
  if (!buzz) throw new Error('لم يتم العثور على Buzz CLI. ثبّت Buzz ثم أعد تشغيل الملف بنقرة واحدة.')
  const ytDlp = skipDownload ? null : resolveYtDlpCommand()
  if (!skipDownload && !ytDlp) throw new Error('لم يتم العثور على yt-dlp. ثبّته بالأمر: python -m pip install --user yt-dlp')
  return { buzz, ytDlp }
}
