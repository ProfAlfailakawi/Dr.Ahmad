import { access, readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const requiredFiles = [
  'src/components/admin/ManualDialogueEditor.tsx',
  'scripts/fetch-manual-dialogues.mjs',
  'scripts/lib/manual-dialogue-source.mjs',
  'scripts/verify-manual-dialogue-lock.mjs',
  'src/lib/podcast-dialogue-lock.ts',
  'src/lib/podcast-generation.ts',
  'src/lib/audio-management.ts',
  'scripts/audio-control-status.mjs',
  'scripts/clear-audio-assets.mjs',
  '.github/workflows/admin-audio-clear.yml',
  'src/lib/social-templates.ts',
  'manual-dialogues/success-that-does-not-bring-joy-to-its-ownerarabic.json',
  'storage.rules',
  'firestore.rules',
  'src/pages/CvFile.tsx',
  '.github/workflows/firebase-hosting-live.yml',
]

for (const file of requiredFiles) {
  await access(resolve(root, file)).catch(() => {
    throw new Error(`[guard-critical] missing protected file: ${file}`)
  })
}

async function textFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await textFiles(full))
    else if (/\.(?:ts|tsx|js|jsx|mjs|html)$/i.test(entry.name)) files.push(full)
  }
  return files
}

const manualEditor = await readFile(resolve(root, 'src/components/admin/ManualDialogueEditor.tsx'), 'utf8')
const fetchBridge = await readFile(resolve(root, 'scripts/fetch-manual-dialogues.mjs'), 'utf8')
const socialTemplates = await readFile(resolve(root, 'src/lib/social-templates.ts'), 'utf8')
const hostingWorkflow = await readFile(resolve(root, '.github/workflows/firebase-hosting-live.yml'), 'utf8')
const podcastWorkflow = await readFile(resolve(root, '.github/workflows/podcast-pilot-release.yml'), 'utf8')
const podcastEngine = await readFile(resolve(root, 'scripts/podcast-dialogue.mjs'), 'utf8')
const ideaFeatures = await readFile(resolve(root, 'src/components/IdeaFeatures.tsx'), 'utf8')
const contentManager = await readFile(resolve(root, 'src/components/admin/ContentManager.tsx'), 'utf8')
const cvFile = await readFile(resolve(root, 'src/pages/CvFile.tsx'), 'utf8')
const firestoreRules = await readFile(resolve(root, 'firestore.rules'), 'utf8')
const serverSource = await readFile(resolve(root, 'server.mjs'), 'utf8')
const podcastDispatch = await readFile(resolve(root, 'src/lib/podcast-generation.ts'), 'utf8')
const autoAudio = await readFile(resolve(root, 'scripts/auto-audio.mjs'), 'utf8')
const audioManagement = await readFile(resolve(root, 'src/lib/audio-management.ts'), 'utf8')
const audioClearWorkflow = await readFile(resolve(root, '.github/workflows/admin-audio-clear.yml'), 'utf8')
const autoAudioWorkflow = await readFile(resolve(root, '.github/workflows/auto-audio-r2.yml'), 'utf8')
const liveSource = (await Promise.all((await textFiles(resolve(root, 'src'))).map((file) => readFile(file, 'utf8')))).join('\n')

const assertions = [
  [manualEditor.includes('turnsFromScript') && manualEditor.includes('documentText(file)'), 'Word must be parsed locally in the browser'],
  [manualEditor.includes("doc(db, 'podcast_dialogues', slug)"), 'manual dialogue must save to podcast_dialogues'],
  [!liveSource.toLowerCase().includes('submitmanualdialogue'), 'legacy submitmanualdialogue endpoint must stay retired from all live src files'],
  [fetchBridge.includes('manual-dialogues') && fetchBridge.includes('podcast_dialogues'), 'nightly Firestore-to-repository bridge must remain active'],
  [fetchBridge.includes('manual-upload-locked') && fetchBridge.includes('revisionSha256'), 'manual dialogue bridge must fail closed with a cloud source lock'],
  [podcastWorkflow.includes('--manual-exact') && podcastWorkflow.includes('--no-gemini') && !podcastWorkflow.includes('fetch-manual-dialogues.mjs --slugs="$REQUESTED" || true'), 'podcast release must use locked manual dialogue only and never swallow fetch failures'],
  [manualEditor.includes('expectedDialogueContentSha256') && manualEditor.includes('queue-readback-mismatch'), 'manual editor must queue the exact verified dialogue revision'],
  [manualEditor.includes('dispatchPodcastGeneration') && podcastDispatch.includes('/api/admin/podcast/dispatch'), 'manual dialogue submit must start generation from the admin panel'],
  [serverSource.includes('GITHUB_WORKFLOW_TOKEN') && serverSource.includes('podcastDispatchPath') && serverSource.includes('actions/workflows'), 'server must dispatch the locked podcast workflow without exposing the GitHub token'],
  [podcastEngine.includes('manualRevisionSha256') && podcastEngine.includes('const saveKey = MANUAL_EXACT') && podcastEngine.includes('? lookupKey'), 'manual exact cache must be bound to the complete uploaded revision'],
  [podcastEngine.includes("if (!MANUAL_TEXT_MODE && issue.method === 'rephrase'") && podcastEngine.includes('ملاحظات تحريرية على الحوار المرفوع (لا تحجب ولا تغيّر النص)'), 'manual dialogue must never be rephrased or blocked by editorial style gates'],
  [socialTemplates.includes("type Composition = 'midad' | 'layl' | 'jarida' | 'sharit' | 'mishkat' | 'tawqee'"), 'six signed social compositions must remain present'],
  /* الصيغة المدموجة firestore:rules,storage كانت العطل نفسه: فشل تفعيل Storage يُسقط
     قواعد Firestore معه بصمت فيتعطل رفع السيرة. الفصل: قواعد Firestore وحدها بصوت
     عالٍ (فشلها يفشل النشر)، وStorage محاولة اختيارية بعدها. */
  [hostingWorkflow.includes('--only firestore:rules') && hostingWorkflow.includes('--only storage'),
    'hosting deploy must publish Firestore rules standalone (loud) and still attempt Storage rules'],
  [ideaFeatures.includes('window.visualViewport') && ideaFeatures.includes('firstPress'), 'PWA selection toolbar and first-tap quote controls must remain protected'],
  [contentManager.includes('uploadCvPdfToFirestore') && contentManager.includes("'site_cv_files'"), 'CV upload must keep its Storage-independent Firestore bridge'],
  [contentManager.includes('النص المُشكَّل لتوليد الصوت') && contentManager.includes("'bodyVocalized'") && autoAudio.includes('fields.bodyVocalized'), 'vocalized article text must remain visible in admin and connected to audio generation'],
  [contentManager.includes('إدارة الصوت') && contentManager.includes('إعادة التوليد') && contentManager.includes('إلغاء الصوت') && audioManagement.includes('/api/admin/audio/manage'), 'article admin must keep manual reading/dialogue cancellation and regeneration controls'],
  [serverSource.includes('audioManagePath') && serverSource.includes('admin-audio-clear.yml') && serverSource.includes("force: 'true'") && autoAudio.includes('explicit_manual_regeneration'), 'server must dispatch protected clear/regenerate workflows and force a selected reading only'],
  [audioClearWorkflow.includes('Delete published objects from R2') && audioClearWorkflow.includes('clear-audio-assets.mjs') && autoAudioWorkflow.includes("github.event.inputs.force == 'true'"), 'audio cancellation must delete published assets while manual reading regeneration remains explicit'],
  [cvFile.includes("'site_cv_files'") && cvFile.includes('cv-files-v1'), 'public CV reconstruction and local cache must remain active'],
  [firestoreRules.includes('match /site_cv_files/{kind}') && firestoreRules.includes('match /chunks/{chunkId}'), 'Firestore CV file rules must remain deployed'],
]

for (const [pass, message] of assertions) {
  if (!pass) throw new Error(`[guard-critical] ${message}`)
}

console.log('[guard-critical] dialogue, audio lifecycle, social templates, CV files, rules, and PWA quote controls are protected')
