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
  'src/components/admin/SoundCaravanBoard.tsx',
  'src/components/admin/ProductionMonitor.tsx',
  'src/components/admin/admin-navigation.ts',
  'scripts/audio-control-status.mjs',
  'scripts/sync-audio-firestore.mjs',
  'scripts/clear-audio-assets.mjs',
  '.github/workflows/admin-audio-clear.yml',
  '.github/workflows/audio-dashboard-sync.yml',
  'src/lib/social-templates.ts',
  'manual-dialogues/success-that-does-not-bring-joy-to-its-ownerarabic.json',
  'storage.rules',
  'firestore.rules',
  'scripts/deploy-firestore-rules-admin.mjs',
  'src/pages/CvFile.tsx',
  '.github/workflows/firebase-hosting-live.yml',
  'src/components/admin/WhatsAppAgentPanel.tsx',
  'src/components/admin/BotMessagesPanel.tsx',
  'whatsapp-agent/intent-engine.mjs',
  'whatsapp-agent/bot-messages.mjs',
  'src/components/admin/SocialDesignStudio.tsx',
  'public/sw.js',
  'src/server/admin-communications.mjs',
  'Dockerfile',
  'src/lib/admin-push.ts',
  'src/lib/inbox-intelligence.ts',
  'src/components/admin/NewsletterCenter.tsx',
  'src/components/admin/InboxIntelligence.tsx',
  'src/components/admin/PersonalKnowledgeGraph.tsx',
  'scripts/build-knowledge-graph.mjs',
  'src/data/knowledge-graph-index.json',
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
const firestoreRulesDeploy = await readFile(resolve(root, 'scripts/deploy-firestore-rules-admin.mjs'), 'utf8')
const podcastWorkflow = await readFile(resolve(root, '.github/workflows/podcast-pilot-release.yml'), 'utf8')
const podcastEngine = await readFile(resolve(root, 'scripts/podcast-dialogue.mjs'), 'utf8')
const ideaFeatures = await readFile(resolve(root, 'src/components/IdeaFeatures.tsx'), 'utf8')
const contentManager = await readFile(resolve(root, 'src/components/admin/ContentManager.tsx'), 'utf8')
const audioLibrary = await readFile(resolve(root, 'src/components/admin/AudioLibrary.tsx'), 'utf8')
const soundCaravan = await readFile(resolve(root, 'src/components/admin/SoundCaravanBoard.tsx'), 'utf8')
const audioFirestoreSync = await readFile(resolve(root, 'scripts/sync-audio-firestore.mjs'), 'utf8')
const productionMonitor = await readFile(resolve(root, 'src/components/admin/ProductionMonitor.tsx'), 'utf8')
const adminPage = await readFile(resolve(root, 'src/pages/Admin.tsx'), 'utf8')
const adminArchitecture = await readFile(resolve(root, 'src/components/admin/AdminArchitecture.tsx'), 'utf8')
const adminNavigation = await readFile(resolve(root, 'src/components/admin/admin-navigation.ts'), 'utf8')
const cvFile = await readFile(resolve(root, 'src/pages/CvFile.tsx'), 'utf8')
const firestoreRules = await readFile(resolve(root, 'firestore.rules'), 'utf8')
const serverSource = await readFile(resolve(root, 'server.mjs'), 'utf8')
const podcastDispatch = await readFile(resolve(root, 'src/lib/podcast-generation.ts'), 'utf8')
const autoAudio = await readFile(resolve(root, 'scripts/auto-audio.mjs'), 'utf8')
const audioManagement = await readFile(resolve(root, 'src/lib/audio-management.ts'), 'utf8')
const audioClearWorkflow = await readFile(resolve(root, '.github/workflows/admin-audio-clear.yml'), 'utf8')
const autoAudioWorkflow = await readFile(resolve(root, '.github/workflows/auto-audio-r2.yml'), 'utf8')
const audioDashboardWorkflow = await readFile(resolve(root, '.github/workflows/audio-dashboard-sync.yml'), 'utf8')
const publishingStudio = await readFile(resolve(root, 'src/components/admin/PublishingStudio.tsx'), 'utf8')
const articleDetail = await readFile(resolve(root, 'src/pages/ArticleDetail.tsx'), 'utf8')
const homePage = await readFile(resolve(root, 'src/pages/Home.tsx'), 'utf8')
const uiSource = await readFile(resolve(root, 'src/components/ui.tsx'), 'utf8')
const cvSource = await readFile(resolve(root, 'src/pages/CV.tsx'), 'utf8')
const whatsappPanel = await readFile(resolve(root, 'src/components/admin/WhatsAppAgentPanel.tsx'), 'utf8')
const whatsappMessagesPanel = await readFile(resolve(root, 'src/components/admin/BotMessagesPanel.tsx'), 'utf8')
const whatsappBridge = await readFile(resolve(root, 'whatsapp-bridge/bridge.mjs'), 'utf8')
const whatsappWebBridge = await readFile(resolve(root, 'whatsapp-web-bridge/index.mjs'), 'utf8')
const whatsappResidentRunner = await readFile(resolve(root, 'whatsapp-web-bridge/service-runner.mjs'), 'utf8')
const whatsappResidentInstaller = await readFile(resolve(root, 'whatsapp-web-bridge/install-autostart-mac.command'), 'utf8')
const whatsappController = await readFile(resolve(root, 'src/server/whatsapp-controller.mjs'), 'utf8')
const whatsappIntentEngine = await readFile(resolve(root, 'whatsapp-agent/intent-engine.mjs'), 'utf8')
const whatsappBotMessages = await readFile(resolve(root, 'whatsapp-agent/bot-messages.mjs'), 'utf8')
const designStudio = await readFile(resolve(root, 'src/components/admin/SocialDesignStudio.tsx'), 'utf8')
const serviceWorkerSource = await readFile(resolve(root, 'public/sw.js'), 'utf8')
const communicationsSource = await readFile(resolve(root, 'src/server/admin-communications.mjs'), 'utf8')
const dockerfileSource = await readFile(resolve(root, 'Dockerfile'), 'utf8')
const adminPushSource = await readFile(resolve(root, 'src/lib/admin-push.ts'), 'utf8')
const inboxIntelligenceSource = await readFile(resolve(root, 'src/lib/inbox-intelligence.ts'), 'utf8')
const newsletterCenterSource = await readFile(resolve(root, 'src/components/admin/NewsletterCenter.tsx'), 'utf8')
const knowledgeGraphPanelSource = await readFile(resolve(root, 'src/components/admin/PersonalKnowledgeGraph.tsx'), 'utf8')
const knowledgeGraphBuilderSource = await readFile(resolve(root, 'scripts/build-knowledge-graph.mjs'), 'utf8')
const socialDesignEngine = await readFile(resolve(root, 'src/lib/social-design-engine.ts'), 'utf8')
const socialDesignRenderer = await readFile(resolve(root, 'src/lib/social-design-renderer.ts'), 'utf8')
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
  [
    (hostingWorkflow.includes('--only firestore:rules')
      || (hostingWorkflow.includes('node scripts/deploy-firestore-rules-admin.mjs')
        && firestoreRulesDeploy.includes('releaseFirestoreRulesetFromSource')
        && firestoreRulesDeploy.includes('account.project_id !== projectId')))
      && hostingWorkflow.includes('--only storage'),
    'hosting deploy must publish Firestore rules standalone (CLI or guarded Admin SDK, loud) and still attempt Storage rules',
  ],
  [ideaFeatures.includes('window.visualViewport') && ideaFeatures.includes('firstPress'), 'PWA selection toolbar and first-tap quote controls must remain protected'],
  [contentManager.includes('uploadCvPdfToFirestore') && contentManager.includes("'site_cv_files'"), 'CV upload must keep its Storage-independent Firestore bridge'],
  [contentManager.includes('النص المُشكَّل لتوليد الصوت') && contentManager.includes("'bodyVocalized'") && autoAudio.includes('fields.bodyVocalized'), 'vocalized article text must remain visible in admin and connected to audio generation'],
  [audioLibrary.includes('مكتبة الصوت') && audioLibrary.includes('نورة') && audioLibrary.includes('فهد') && audioLibrary.includes('الحوار') && audioLibrary.includes("'clear'") && audioManagement.includes("'reading' | 'dialogue'"), 'admin audio library must expose Noura, Fahed and dialogue while keeping article-facing labels generic'],
  [audioLibrary.includes('<audio') && audioLibrary.includes('سماع') && audioLibrary.includes('قراءة المقال') && audioLibrary.includes('الحوار') && audioLibrary.includes('12_000'), 'central audio library must preview reading/dialogue files with generic labels and refresh generation status'],
  [adminPage.includes("'audio-library': <AudioLibrary") && adminNavigation.includes("tab: 'audio-library'") && adminNavigation.includes('السماع وإعادة التوليد والحذف'), 'audio lifecycle must remain a dedicated visible admin tab generated from the official registry'],
  [adminArchitecture.includes('data-admin-desktop-rail="true"')
    && adminArchitecture.includes('data-admin-desktop-flyout="true"')
    && adminArchitecture.includes('useState<AdminArea | null>(null)')
    && adminArchitecture.includes('setOpenArea(null)')
    && adminPage.includes('lg:grid-cols-[76px_minmax(0,1fr)]')
    && adminArchitecture.includes('AdminMobileSubnav')
    && adminArchitecture.includes('lg:hidden'),
  'desktop admin navigation must stay as a non-crowding closed rail/flyout while the approved mobile navigation remains independent'],
  [adminArchitecture.includes('data-admin-rail-visible')
    && adminArchitecture.includes('scheduleRailHide')
    && adminArchitecture.includes("translate-x-[52px]")
    && adminArchitecture.includes('onPointerEnter={revealRail}'),
  'desktop admin rail must auto-hide when idle and reveal contextually without covering the workspace'],
  [adminPage.includes('useAdminInboxNotifications()')
    && adminPage.includes("collection(db, 'subscribers')")
    && adminPage.includes('showNewSubscriberNotification')
    && adminPage.includes('إشعارات الرسائل والاشتراكات')
    && serviceWorkerSource.includes("self.addEventListener('notificationclick'")
    && serviceWorkerSource.includes('/admin?tab=inbox'),
  'admin inbox notifications must cover both private messages and newsletter subscriptions and open the inbox on click'],
  [communicationsSource.includes("url.pathname === '/api/contact'")
    && communicationsSource.includes("url.pathname === '/api/newsletter/subscribe'")
    && communicationsSource.includes("url.pathname === '/api/admin/push'")
    && communicationsSource.includes("url.pathname === '/api/admin/newsletter'")
    && adminPushSource.includes("getToken(messaging")
    && serviceWorkerSource.includes("self.addEventListener('push'")
    && adminPage.includes('فعّل Push الحقيقي')
    && firestoreRules.includes('match /admin_push_tokens/{id}')
    && firestoreRules.includes('match /newsletter_sends/{id}')
    && dockerfileSource.includes('COPY src/server/admin-communications.mjs /app/src/server/admin-communications.mjs'),
  'private messages and newsletter subscriptions must reach the admin through real server push, and newsletter send history must remain private'],
  [newsletterCenterSource.includes('معاينة ← تعديل ← اختبار لنفسك ← إرسال')
    && newsletterCenterSource.includes("send('test')")
    && newsletterCenterSource.includes("send('send')")
    && newsletterCenterSource.includes('مقبول')
    && adminPage.includes('<NewsletterCenter draft={newsletterDraft} />'),
  'newsletter center must preserve explicit preview, test, confirmed send, and per-recipient provider acceptance history'],
  [hostingWorkflow.includes('Deploy matching dr-api revision before Hosting')
    && hostingWorkflow.includes('gcloud run deploy dr-api')
    && hostingWorkflow.indexOf('gcloud run deploy dr-api') < hostingWorkflow.indexOf('Deploy to Firebase Hosting live'),
  'Cloud Run dr-api must deploy from the same commit before Hosting so frontend and backend cannot drift'],
  [knowledgeGraphBuilderSource.includes("kind: 'concept'")
    && knowledgeGraphBuilderSource.includes("kind: 'audio'")
    && knowledgeGraphBuilderSource.includes("collection('social_queue')")
    && knowledgeGraphBuilderSource.includes('knowledge-graph-index.json')
    && knowledgeGraphPanelSource.includes('DR_AHMAD_GLOSSARY_CONCEPT_CAPACITY')
    && knowledgeGraphPanelSource.includes('عقل الأرشيف')
    && adminPage.includes('<InboxIntelligence messages={items} />')
    && inboxIntelligenceSource.includes('buildAudienceSignals'),
  'personal knowledge graph and inbox intelligence must keep concepts, archive, audio, social history, and repeated audience signals connected'],
  [!contentManager.includes('<ArticleAudioManager') && !contentManager.includes('إدارة صوت المقال'), 'audio controls must stay out of the article editor and inside the dedicated library'],
  [serverSource.includes('audioManagePath') && serverSource.includes('admin-audio-clear.yml') && autoAudio.includes('ALL_VOICES') && serverSource.includes("requestedMode === 'fahed' ? 'reading'"), 'server must dispatch protected generic reading/dialogue lifecycle workflows while accepting the legacy alias'],
  [audioClearWorkflow.includes('reading) FILES=') && audioClearWorkflow.includes('.noura.mp3') && audioClearWorkflow.includes('clear-audio-assets.mjs') && !audioClearWorkflow.includes("description: 'fahed") && !autoAudioWorkflow.includes('github.event.inputs.voice') && autoAudioWorkflow.includes('MODE="reading"'), 'audio cancellation and regeneration must use generic reading/dialogue modes, clear both compatible reading files, and expose no internal voice selector'],
  [hostingWorkflow.includes('workflow_run:') && hostingWorkflow.includes('توليد الصوت تلقائياً إلى R2'), 'successful audio ledger workflows must trigger a fresh site deployment'],
  [audioDashboardWorkflow.includes("'*/15 * * * *'") && audioDashboardWorkflow.includes('--from-r2') && audioDashboardWorkflow.includes('audio:firestore:sync'), 'audio dashboard must independently rescan live R2 every 15 minutes without waiting for a long generation run'],
  [audioDashboardWorkflow.includes('CLOUDFLARE_R2_ACCESS_KEY_ID')
    && audioDashboardWorkflow.includes('CLOUDFLARE_R2_SECRET_ACCESS_KEY')
    && audioFirestoreSync.includes('listR2Objects()')
    && audioFirestoreSync.includes("'r2-signed-list'")
    && audioFirestoreSync.includes('lastAttemptComplete: false')
    && audioFirestoreSync.includes('حُفظ آخر عدّاد صحيح')
    && audioFirestoreSync.includes('bySlug'),
  'audio inventory must use one signed R2 listing, preserve the last complete count on transient failure, and persist per-article truth'],
  [soundCaravan.includes('data-audio-self-healing-inventory="true"')
    && soundCaravan.includes("doc(db, 'site_settings', 'audio_inventory')")
    && soundCaravan.includes("action: 'audio-sync'")
    && soundCaravan.includes('AUTO_SYNC_COOLDOWN_MS')
    && soundCaravan.includes('authoritative ? exists(cloud.fahed)')
    && soundCaravan.includes('افحص R2 الآن'),
  'audio caravan must subscribe to authoritative R2 inventory, automatically dispatch stale reconciliation, and expose manual recovery without code'],
  [productionMonitor.includes('data-autopilot-control-center="true"')
    && productionMonitor.includes('data-safe-repair-all="true"')
    && productionMonitor.includes('data-continuous-whatsapp-proof="true"')
    && productionMonitor.includes('data-weekly-operations-report="true"')
    && productionMonitor.includes('data-admin-settings-backup="true"')
    && productionMonitor.includes('data-incident-history="true"')
    && productionMonitor.includes('data-persistent-critical-alert="true"')
    && productionMonitor.includes('/api/admin/control-center')
    && productionMonitor.includes('/api/admin/whatsapp/recover')
    && productionMonitor.includes('/api/admin/whatsapp/simulate-sequence')
    && productionMonitor.includes('لا يحذف محتوى، ولا يمس جلسة واتساب')
    && serverSource.includes("const controlCenterPath = '/api/admin/control-center'")
    && serverSource.includes("'repair-safe'")
    && serverSource.includes("action === 'verify-all'")
    && serverSource.includes("action === 'backup-settings'")
    && serverSource.includes("action === 'restore-settings'")
    && serverSource.includes("collection('control_center_incidents')")
    && serverSource.includes("'audio-dashboard-sync.yml'")
    && serverSource.includes("'site-guardian.yml'"),
  'admin control center must keep live diagnosis, multi-turn proof, incidents, alerts, weekly evidence, backups and one non-destructive repair action'],
  [whatsappPanel.includes('إصلاح الاتصال تلقائياً') && whatsappPanel.includes('/admin/repair') && whatsappPanel.includes('window.confirm'), 'WhatsApp admin must expose safe recovery and explicit destructive re-pairing'],
  [whatsappPanel.includes('data-whatsapp-recovery-center="true"') && whatsappPanel.includes('/admin/recover') && whatsappPanel.includes('مركز التشخيص والإحياء') && whatsappController.includes('buildWhatsAppDiagnostics') && whatsappController.includes("path === '/recover'"), 'WhatsApp admin must diagnose every operating layer and expose one safe non-destructive recovery action without code access'],
  [whatsappBridge.includes('watchdog_restart_stuck_authenticated') && whatsappBridge.includes("process.exit(75)") && whatsappBridge.includes("WHATSAPP_BRIDGE_SECRET || ''") && whatsappWebBridge.includes('sendTextWithRecovery') && whatsappWebBridge.includes("'send-self-message'") && whatsappWebBridge.includes('waitUntilMsgSent: true') && whatsappWebBridge.includes('duplicate_command_acknowledged_without_resend') && whatsappWebBridge.includes('manual_message_closed_bot_session') && whatsappWebBridge.includes('owner_private_chat_ignored') && whatsappWebBridge.includes('late_loading_screen_ignored') && whatsappWebBridge.includes('catchUpMissedMessages') && whatsappWebBridge.includes('inbound-checkpoint.json') && whatsappWebBridge.includes('heartbeatBusy') && whatsappWebBridge.includes('sanitizeServerReply') && whatsappWebBridge.includes('legacy_duplicate_decision_retrying_as_distinct_turn') && whatsappController.includes("path === '/emergency-stop'") && whatsappController.includes("defaultReplyMode: 'wake-phrase-only'") && whatsappController.includes('wakeEpoch: 2') && whatsappController.includes("reason: 'awaiting-wake-phrase'") && whatsappController.includes('Number(data.wakeVersion || 0) >= 2') && whatsappController.includes("reason: 'duplicate-delivery'") && whatsappController.includes("reason: 'duplicate-delivery-replay'") && whatsappController.includes('recentInboundResponses') && whatsappController.includes('isDuplicateInboundDelivery') && whatsappController.includes('WAKE_PHRASES'), 'WhatsApp bridge must self-restart when stuck, catch up missed messages, stay ABSOLUTELY silent for every chat until its owner types the exact wake phrase (wake epoch 2 — legacy always-on sessions are void), stay silent after a manual owner reply until the exact wake phrase, ignore the owner private chat, neutralize legacy silent/human-promise responses, replay exact duplicate deliveries safely only inside woken sessions, stop queued sends, deduplicate commands, and never ship a fallback secret'],
  [whatsappController.includes('REPAIR_COOLDOWN_MS') && whatsappController.includes('repairAllowed') && whatsappController.includes('رفضت اللوحة مسحها'), 'WhatsApp destructive recovery must keep its connected-session lock and scan-rate cooldown'],
  [whatsappController.includes("path === '/simulate-sequence'")
    && whatsappController.includes('تُقابل بالصمت التام')
    && whatsappController.includes('شنو تحب أسوي بعدها')
    && whatsappIntentEngine.includes('CONTEXT_ACTION_INTENTS')
    && whatsappIntentEngine.includes('عطني|اعطني|ابي|اريد'),
  'WhatsApp must prove continuous multi-turn replies inside woken sessions only, prefer explicit follow-up actions over pronoun references, and ask a useful next question'],
  [whatsappPanel.includes('data-whatsapp-catchup-status="true"')
    && whatsappController.includes("'missed-message-recovery'")
    && whatsappMessagesPanel.includes('LEGACY_HUMAN_PROMISE')
    && whatsappMessagesPanel.includes('safeTemplateValue')
    && whatsappBotMessages.includes('legacyPromise')
    && whatsappIntentEngine.includes("reason: 'active-clarify'"),
  'WhatsApp admin and runtime must expose missed-message recovery, quarantine legacy human-follow-up promises, and answer every active-session turn'],
  [whatsappResidentRunner.includes('loadBridgeSecret')
    && whatsappResidentRunner.includes('readKeychainSecret')
    && whatsappResidentRunner.includes('cacheKeychainSecret')
    && whatsappResidentRunner.includes('bridge_secret_loaded_from_keychain')
    && whatsappResidentRunner.includes('ensureDependencies')
    && whatsappResidentRunner.includes('session_quarantined_for_repair'),
  'resident WhatsApp service must self-heal dependencies, keep an encrypted Keychain fallback for its secret, and quarantine repaired sessions'],
  [whatsappResidentInstaller.includes('DrAhmadWhatsAppBridge') && whatsappResidentInstaller.includes('com.alturath.whatsapp-bridge') && whatsappResidentInstaller.includes('legacy-launch-agents'), 'WhatsApp installer must keep one resident launch service and retire conflicting legacy services'],
  [designStudio.includes('BufferedIdeaTextarea')
    && designStudio.includes('data-performance-island="studio-idea"')
    && designStudio.includes("'generate' | 'ready'")
    && designStudio.includes("'latest-approved'")
    && designStudio.includes('data-professional-visual-gate="true"')
    && designStudio.includes('premiumReadyQueries')
    && designStudio.includes('cheapStockPenalty')
    && designStudio.includes('maxAttempts = 4')
    && designStudio.includes('browser-original-editorial')
    && designStudio.includes('repairRound < 2')
    && !designStudio.includes("setVisualMode('library')"),
  'design studio must keep zero-render typing, exactly two original/curated routes, premium ready-image curation, automatic image/release repair, a professional release gate, and latest-approved-only storage'],
  [socialDesignEngine.includes("displayFamily: 'El Messiri'")
    && socialDesignRenderer.includes("fetch('/fonts/fonts.css')")
    && socialDesignRenderer.includes('/El Messiri|Tajawal/.test(block)')
    && socialDesignRenderer.includes('U\\+0000-00FF')
    && socialDesignRenderer.includes("family: 'El Messiri'"),
  'social studio must keep its approved Arabic display face embedded in exported raster artwork'],
  [cvFile.includes("'site_cv_files'") && cvFile.includes('cv-files-v1'), 'public CV reconstruction and local cache must remain active'],
  [firestoreRules.includes('match /site_cv_files/{kind}') && firestoreRules.includes('match /chunks/{chunkId}'), 'Firestore CV file rules must remain deployed'],
  [publishingStudio.includes('مكتبة القوالب كاملة — 24 تكويناً')
    && publishingStudio.includes("key: 'iqtibas'")
    && publishingStudio.includes("key: 'masfufa'")
    && publishingStudio.includes("key: 'mizan'")
    && publishingStudio.includes('data-standalone-phrase-understanding="true"')
    && publishingStudio.includes('data-professional-standalone-directions="true"')
    && serverSource.includes('socialPackCreativeAudit')
    && serverSource.includes('creativeDirectives'),
  'standalone publishing must preserve all 24 laboratory layouts while promoting phrase-aware professional directions and server-side creative quality repair'],
  [articleDetail.includes('<StudentArchive') && articleDetail.includes('openAudioPlayer(`article-audio-${slug}`)') && (articleDetail.match(/<ArticleExtensions/g) || []).length === 1, 'article features must remain preserved inside the single related-content ending layer'],
  [homePage.includes('home:selected-works:v2') && !homePage.includes('لا مواعيد معلنة حالياً') && !homePage.includes('عرض بصري واحد بلا تكرار'), 'home selections must vary and empty/upholstery copy must remain hidden'],
  [uiSource.includes('جميع المقالات') && uiSource.includes("expanded ? 'إغلاق' : 'فروع'") && uiSource.includes('EnglishOverlay'), 'menus must keep clear all-content links and discoverable branches in both languages'],
  [cvSource.includes('SHOW_CITATION_IMPACT = false') && cvSource.includes('<CitationImpact'), 'Scholar impact module must stay preserved but hidden for future activation'],
]

for (const [pass, message] of assertions) {
  if (!pass) throw new Error(`[guard-critical] ${message}`)
}

console.log('[guard-critical] dialogue, audio lifecycle, social templates, CV files, rules, and PWA quote controls are protected')
