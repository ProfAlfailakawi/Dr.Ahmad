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
  'src/components/admin/AudioLibrary.tsx',
  'scripts/audio-control-status.mjs',
  'scripts/clear-audio-assets.mjs',
  '.github/workflows/admin-audio-clear.yml',
  'src/lib/social-templates.ts',
  'manual-dialogues/success-that-does-not-bring-joy-to-its-ownerarabic.json',
  'storage.rules',
  'firestore.rules',
  'src/pages/CvFile.tsx',
  '.github/workflows/firebase-hosting-live.yml',
  'src/components/admin/WhatsAppAgentPanel.tsx',
  'src/components/admin/SocialDesignStudio.tsx',
  'whatsapp-bridge/bridge.mjs',
  'whatsapp-web-bridge/index.mjs',
  'whatsapp-web-bridge/service-runner.mjs',
  'whatsapp-web-bridge/install-autostart-mac.command',
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
const audioLibrary = await readFile(resolve(root, 'src/components/admin/AudioLibrary.tsx'), 'utf8')
const adminPage = await readFile(resolve(root, 'src/pages/Admin.tsx'), 'utf8')
const adminArchitecture = await readFile(resolve(root, 'src/components/admin/AdminArchitecture.tsx'), 'utf8')
const cvFile = await readFile(resolve(root, 'src/pages/CvFile.tsx'), 'utf8')
const firestoreRules = await readFile(resolve(root, 'firestore.rules'), 'utf8')
const serverSource = await readFile(resolve(root, 'server.mjs'), 'utf8')
const podcastDispatch = await readFile(resolve(root, 'src/lib/podcast-generation.ts'), 'utf8')
const autoAudio = await readFile(resolve(root, 'scripts/auto-audio.mjs'), 'utf8')
const audioManagement = await readFile(resolve(root, 'src/lib/audio-management.ts'), 'utf8')
const audioClearWorkflow = await readFile(resolve(root, '.github/workflows/admin-audio-clear.yml'), 'utf8')
const autoAudioWorkflow = await readFile(resolve(root, '.github/workflows/auto-audio-r2.yml'), 'utf8')
const publishingStudio = await readFile(resolve(root, 'src/components/admin/PublishingStudio.tsx'), 'utf8')
const articleDetail = await readFile(resolve(root, 'src/pages/ArticleDetail.tsx'), 'utf8')
const homePage = await readFile(resolve(root, 'src/pages/Home.tsx'), 'utf8')
const uiSource = await readFile(resolve(root, 'src/components/ui.tsx'), 'utf8')
const cvSource = await readFile(resolve(root, 'src/pages/CV.tsx'), 'utf8')
const whatsappPanel = await readFile(resolve(root, 'src/components/admin/WhatsAppAgentPanel.tsx'), 'utf8')
const whatsappBridge = await readFile(resolve(root, 'whatsapp-bridge/bridge.mjs'), 'utf8')
const whatsappWebBridge = await readFile(resolve(root, 'whatsapp-web-bridge/index.mjs'), 'utf8')
const whatsappResidentRunner = await readFile(resolve(root, 'whatsapp-web-bridge/service-runner.mjs'), 'utf8')
const whatsappResidentInstaller = await readFile(resolve(root, 'whatsapp-web-bridge/install-autostart-mac.command'), 'utf8')
const whatsappController = await readFile(resolve(root, 'src/server/whatsapp-controller.mjs'), 'utf8')
const designStudio = await readFile(resolve(root, 'src/components/admin/SocialDesignStudio.tsx'), 'utf8')
const liveSource = (await Promise.all((await textFiles(resolve(root, 'src'))).map((file) => readFile(file, 'utf8')))).join('\n')

const assertions = [
  [manualEditor.includes('turnsFromScript') && manualEditor.includes('documentText(file)'), 'Word must be parsed locally in the browser'],
  [manualEditor.includes("doc(db, 'podcast_dialogues', slug)"), 'manual dialogue must save to podcast_dialogues'],
  [!liveSource.toLowerCase().includes('submitmanualdialogue'), 'legacy submitmanualdialogue endpoint must stay retired from all live src files'],
  [fetchBridge.includes('manual-dialogues') && fetchBridge.includes('podcast_dialogues'), 'nightly Firestore-to-repository bridge must remain active'],
  [fetchBridge.includes('manual-upload-locked') && fetchBridge.includes('revisionSha256'), 'manual dialogue bridge must fail closed with a cloud source lock'],
  [podcastWorkflow.includes('--manual-exact --no-gemini')
    && podcastEngine.includes('sttQuotaExhausted && MANUAL_EXACT')
    && podcastEngine.includes('providerQuotaFallback')
    && !podcastWorkflow.includes('fetch-manual-dialogues.mjs --slugs="$REQUESTED" || true'),
  'podcast release must keep the exact locked manual dialogue, survive external judge/STT quota exhaustion only for that locked source, and never swallow fetch failures'],
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
  [audioLibrary.includes('مكتبة الصوت') && audioLibrary.includes('صوت فهد') && audioLibrary.includes('الحوار') && !audioLibrary.includes('صوت نورة') && audioLibrary.includes("'clear'") && audioManagement.includes("'fahed' | 'dialogue'"), 'article audio library must keep Fahed reading and two-voice dialogue as the only active modes'],
  [audioLibrary.includes('<audio') && audioLibrary.includes('سماع') && audioLibrary.includes('فهد هو صوت التوليد الجديد لقراءة المقالات') && audioLibrary.includes('نورة جاهزة') && audioLibrary.includes('12_000'), 'central audio library must preview current Noura/Fahed/dialogue files and refresh generation status'],
  [adminPage.includes("tab === 'audio-library'") && adminArchitecture.includes("tab: 'audio-library'") && adminArchitecture.includes('سماع وإعادة توليد وحذف'), 'audio lifecycle must remain a dedicated visible admin tab'],
  [!contentManager.includes('<ArticleAudioManager') && !contentManager.includes('إدارة صوت المقال'), 'audio controls must stay out of the article editor and inside the dedicated library'],
  [serverSource.includes('audioManagePath') && serverSource.includes('admin-audio-clear.yml') && autoAudio.includes("--voice=") && autoAudio.includes('ALL_VOICES'), 'server must dispatch protected Fahed/dialogue lifecycle workflows'],
  [audioClearWorkflow.includes('fahed) FILES=') && audioClearWorkflow.includes('clear-audio-assets.mjs') && autoAudioWorkflow.includes('github.event.inputs.voice') && autoAudioWorkflow.includes('--voice=$VOICE'), 'audio cancellation and regeneration must keep Fahed reading isolated from dialogue'],
  [hostingWorkflow.includes('workflow_run:') && hostingWorkflow.includes('توليد الصوت تلقائياً إلى R2'), 'successful audio ledger workflows must trigger a fresh site deployment'],
  [whatsappPanel.includes('إصلاح الاتصال تلقائيًا') && whatsappPanel.includes('/admin/repair') && whatsappPanel.includes('window.confirm'), 'WhatsApp admin must expose safe recovery and explicit destructive re-pairing'],
  [whatsappBridge.includes('watchdog_restart_stuck_authenticated') && whatsappBridge.includes("process.exit(75)") && whatsappBridge.includes("WHATSAPP_BRIDGE_SECRET || ''") && whatsappWebBridge.includes('sendTextWithRecovery') && whatsappWebBridge.includes("'send-self-message'") && whatsappWebBridge.includes('waitUntilMsgSent: true') && whatsappWebBridge.includes('duplicate_command_acknowledged_without_resend') && whatsappWebBridge.includes('manual_message_closed_bot_session') && whatsappWebBridge.includes('late_loading_screen_ignored') && whatsappController.includes("path === '/emergency-stop'") && whatsappController.includes('awaiting-wake-phrase') && whatsappController.includes('WAKE_PHRASES'), 'WhatsApp bridge must self-restart when stuck, remain silent until the exact wake phrase, close on manual owner messages, ignore late sync regressions, stop queued sends, deduplicate commands, and never ship a fallback secret'],
  [whatsappController.includes('REPAIR_COOLDOWN_MS') && whatsappController.includes('repairAllowed') && whatsappController.includes('رفضت اللوحة مسحها'), 'WhatsApp destructive recovery must keep its connected-session lock and scan-rate cooldown'],
  [whatsappResidentRunner.includes('loadBridgeSecret') && whatsappResidentRunner.includes('ensureDependencies') && whatsappResidentRunner.includes('session_quarantined_for_repair'), 'resident WhatsApp service must self-heal dependencies, fetch its secret, and quarantine repaired sessions'],
  [whatsappResidentInstaller.includes('DrAhmadWhatsAppBridge') && whatsappResidentInstaller.includes('com.alturath.whatsapp-bridge') && whatsappResidentInstaller.includes('legacy-launch-agents'), 'WhatsApp installer must keep one resident launch service and retire conflicting legacy services'],
  [designStudio.includes('BufferedIdeaTextarea') && designStudio.includes('data-performance-island="studio-idea"') && designStudio.includes("'generate' | 'library' | 'ready'") && designStudio.includes('resolveLibraryImagePassport'), 'design studio must keep zero-render typing and a working site-library mode'],
  [cvFile.includes("'site_cv_files'") && cvFile.includes('cv-files-v1'), 'public CV reconstruction and local cache must remain active'],
  [firestoreRules.includes('match /site_cv_files/{kind}') && firestoreRules.includes('match /chunks/{chunkId}'), 'Firestore CV file rules must remain deployed'],
  [publishingStudio.includes('مكتبة القوالب كاملة — 24 تكويناً') && publishingStudio.includes("key: 'iqtibas'") && publishingStudio.includes("key: 'masfufa'") && publishingStudio.includes("key: 'mizan'"), 'all 24 standalone social layouts must remain visible in the publishing studio'],
  [articleDetail.includes('<StudentArchive') && articleDetail.includes('openAudioPlayer(`article-audio-${slug}`)') && (articleDetail.match(/<ArticleExtensions/g) || []).length === 1, 'article features must remain preserved inside the single related-content ending layer'],
  [homePage.includes('home:selected-works:v2') && !homePage.includes('لا مواعيد معلنة حالياً') && !homePage.includes('عرض بصري واحد بلا تكرار'), 'home selections must vary and empty/upholstery copy must remain hidden'],
  [uiSource.includes('جميع المقالات') && uiSource.includes("expanded ? 'إغلاق' : 'فروع'") && uiSource.includes('EnglishOverlay'), 'menus must keep clear all-content links and discoverable branches in both languages'],
  [cvSource.includes('SHOW_CITATION_IMPACT = false') && cvSource.includes('<CitationImpact'), 'Scholar impact module must stay preserved but hidden for future activation'],
]

for (const [pass, message] of assertions) {
  if (!pass) throw new Error(`[guard-critical] ${message}`)
}

console.log('[guard-critical] dialogue, audio lifecycle, social templates, CV files, rules, and PWA quote controls are protected')
