/* ردود تجريبية لمسارات /api/admin/whatsapp/* — بياناتٌ مجمّعة خيالية، بلا أرقام ولا نصوص أشخاص حقيقيين. */
const DAY = 86_400_000
const iso = (agoMs: number) => new Date(Date.now() - agoMs).toISOString()

export function whatsappMock(sub: string, method: string): unknown {
  const now = Date.now()
  if (sub === '/status') {
    return {
      status: 'connected', indexed: 214, last_error: null, device_name: 'جهاز العرض التجريبي', updated_at: iso(20_000), flags: { agent: true, send: true, autoReply: true, privateAutoReply: true, voice: true, reminders: true, quoteCard: true },
      runtimePaused: false, timeZone: 'Asia/Kuwait', bridgeOnline: true, lastHeartbeatAt: iso(8_000), heartbeatAgeMs: 8_000, restartRequestedAt: null, port: 3100, qr: null, qrImage: null,
      repairAllowed: true, repairCooldownMs: 0, bridgeVersion: '2026.09.28-demo', bridgeInstanceId: 'demo-bridge-01', bridgeStateAt: iso(30_000),
      lastCatchupAt: iso(25 * 60_000), lastCatchupRecovered: 2, lastCatchupError: null, lastDeviceActivityPulseAt: iso(3 * 3600_000), nextDeviceActivityPulseAt: new Date(now + 5 * 3600_000).toISOString(), nextDeviceActivityPulseInMs: 5 * 3600_000, deviceActivityPulseAgeMs: 3 * 3600_000,
      deviceActivityProtection: { state: 'protected', label: 'الحماية مفعّلة', detail: 'نبض نشاط الجهاز يعمل بانتظام ولا يحتاج تدخلاً.' },
      health: { code: 'ready', label: 'مساعد واتساب يعمل', why: 'النبض حديث والطابور فارغ والجلسة محفوظة.', fix: 'لا يحتاج تدخلاً.', ready: true, needsAuthScan: false, pollFailures: 0, quietNow: false, silenced: 0, connected: true },
      diagnostics: {
        code: 'healthy', level: 'healthy', title: 'كل شيء سليم', summary: 'الجسر متصل والردود تصل خلال ثوانٍ.', action: 'لا يحتاج تدخلاً.', checkedAt: iso(10_000),
        checks: [{ id: 'bridge', label: 'الجسر', state: 'ok', detail: 'متصل ونبضه حديث' }, { id: 'queue', label: 'الطابور', state: 'ok', detail: 'لا رسائل معلّقة' }, { id: 'brain', label: 'العقل المركزي', state: 'ok', detail: 'يجيب بسرعة' }, { id: 'session', label: 'الجلسة', state: 'ok', detail: 'محفوظة ولا تحتاج مسحاً' }],
        queue: { active: 0, pending: 0, leased: 0, held: 0, failed: 0, staleLeased: 0 },
        activity: { lastInboundAt: iso(14 * 60_000), lastReplyAt: iso(13 * 60_000), lastManualAt: iso(2 * DAY) }, privacy: 'تعرض اللوحة أعداداً مجمعة فقط، من دون نصوص الناس أو أرقامهم.',
      },
    }
  }
  if (sub === '/rules' && method === 'GET') {
    return [
      { id: 'r1', name: 'ترحيب الصباح', keywords: ['السلام عليكم', 'صباح الخير', 'موقع د. أحمد'], priority: 10, matchType: 'any', actionType: 'text', responseText: 'أهلاً بك في موقع د. أحمد. اكتب موضوعاً تريد القراءة عنه، أو اختر: ٣٠ ثانية · دقيقتان · تعمّق.', contentQuery: '', enabled: true, updatedAt: iso(5 * DAY) },
      { id: 'r2', name: 'طلب محاضرة', keywords: ['محاضرة', 'ورشة', 'دعوة'], priority: 8, matchType: 'any', actionType: 'text', responseText: 'يسعدنا اهتمامك. الأفضل تعبئة نموذج التواصل في الموقع لتصل التفاصيل مرتبة.', contentQuery: '', enabled: true, updatedAt: iso(9 * DAY) },
      { id: 'r3', name: 'مقالات التقييم', keywords: ['تقييم', 'امتحان', 'اختبار'], priority: 5, matchType: 'any', actionType: 'site-content', responseText: '', contentQuery: 'التقييم التربوي', enabled: true, updatedAt: iso(12 * DAY) },
      { id: 'r4', name: 'التحويل لصاحب الموقع', keywords: ['أريد التحدث مباشرة'], priority: 1, matchType: 'exact', actionType: 'transfer', responseText: 'سأنقل رسالتك ليراها صاحب الموقع حين يتوفر.', contentQuery: '', enabled: true, updatedAt: iso(20 * DAY) },
      { id: 'r5', name: 'الكتب الإلكترونية', keywords: ['كتاب', 'موسوعة', 'تحميل'], priority: 4, matchType: 'any', actionType: 'site-content', responseText: '', contentQuery: 'الموسوعة', enabled: false, updatedAt: iso(30 * DAY) },
    ]
  }
  if (sub.startsWith('/rules/') && sub.endsWith('/versions')) return [{ id: 3, createdAt: iso(2 * DAY) }, { id: 2, createdAt: iso(9 * DAY) }, { id: 1, createdAt: iso(21 * DAY) }]
  if (sub === '/learning') {
    return {
      total: 12, learned: 5, observing: 4, ignored: 1, taught: 2, policy: 'لا يتعلم البوت تلقائياً؛ يسجّل الصياغات المتكررة وأنت تقرر ما يُعتمد.',
      items: [
        { id: 'l1', phrase: 'كيف أذاكر بدون توتر', hits: 14, intent: 'قلق الامتحانات', confirmations: 6, evidenceSources: 3, evidenceDays: 5, kind: 'question', status: 'learned', firstSeenAt: iso(20 * DAY), lastSeenAt: iso(1 * DAY), learnedAt: iso(6 * DAY) },
        { id: 'l2', phrase: 'أفضل تطبيقات للمعلمين', hits: 9, intent: 'أدوات المعلم', confirmations: 3, evidenceSources: 2, evidenceDays: 4, kind: 'question', status: 'observing', firstSeenAt: iso(12 * DAY), lastSeenAt: iso(2 * DAY) },
        { id: 'l3', phrase: 'ابني ما يحب القراءة', hits: 7, intent: 'القراءة والأسرة', confirmations: 2, evidenceSources: 2, evidenceDays: 3, kind: 'question', status: 'observing', firstSeenAt: iso(9 * DAY), lastSeenAt: iso(1 * DAY) },
        { id: 'l4', phrase: 'الذكاء الاصطناعي والغش', hits: 11, intent: 'الذكاء الاصطناعي', confirmations: 5, evidenceSources: 3, evidenceDays: 6, kind: 'topic', status: 'taught', firstSeenAt: iso(25 * DAY), lastSeenAt: iso(3 * DAY), learnedAt: iso(10 * DAY), teachQuery: 'الذكاء الاصطناعي في التعليم' },
        { id: 'l5', phrase: 'رابط التسجيل', hits: 3, intent: 'غير محدد', confirmations: 1, evidenceSources: 1, evidenceDays: 1, kind: 'phrase', status: 'ignored', firstSeenAt: iso(7 * DAY), lastSeenAt: iso(5 * DAY) },
      ],
    }
  }
  if (sub === '/knowledge') {
    return {
      modes: [{ id: 'site', label: 'من الموقع فقط', boundary: 'يجيب من المحتوى المنشور ولا يخترع.' }, { id: 'guided', label: 'إرشاد القراءة', boundary: 'يقترح مادة ثم يسأل سؤالاً واحداً.' }],
      sourcePolicies: { education: ['جامعة أو دورية محكّمة', 'تقرير منظمة دولية'], technology: ['دورية محكّمة'] },
      evidence: { total: 18, enabled: 16, lastUpdatedAt: iso(3 * DAY), domains: [{ domain: 'education', total: 9, enabled: 8 }, { domain: 'technology', total: 5, enabled: 5 }, { domain: 'family', total: 4, enabled: 3 }] },
      conversations: {
        active: 23, human: 3,
        intents: [{ intent: 'طلب مقال', total: 41, confidence: 0.91 }, { intent: 'قلق الامتحانات', total: 22, confidence: 0.87 }, { intent: 'الذكاء الاصطناعي', total: 18, confidence: 0.84 }, { intent: 'طلب محاضرة', total: 9, confidence: 0.93 }],
        gaps: [{ topic: 'التعلم بالألعاب', reason: 'لا مادة منشورة مطابقة', total: 6 }, { topic: 'الصف المقلوب', reason: 'مادة قديمة تحتاج تحديثاً', total: 4 }],
        answers: [{ intent: 'طلب مقال', total: 39 }, { intent: 'قلق الامتحانات', total: 20 }, { intent: 'الذكاء الاصطناعي', total: 15 }],
      },
      personality: { verbosity: 'layered', dialect: 'kuwaiti-light', initiative: 'one-question', signature: 'always', memoryConsent: 'explicit' },
      privacy: 'تعرض اللوحة أعداداً مجمعة فقط، من دون نصوص الناس أو أرقامهم.',
    }
  }
  if (sub.startsWith('/trusted-evidence')) {
    return [
      { id: 'ev1', domain: 'education', sourceName: 'منظمة اليونسكو', sourceType: 'تقرير منظمة دولية', title: 'الذكاء الاصطناعي والتعليم: إرشادات لصانعي السياسات', claim: 'يوصي التقرير بإطار بشري المحور لاستخدام الذكاء الاصطناعي في التعليم.', quote: 'human-centred approach', url: 'https://example.org/unesco-ai-education', publishedAt: '2025-03-12', retrievedAt: '2026-09-02', authority: 'عالية', enabled: true, createdAt: iso(20 * DAY) },
      { id: 'ev2', domain: 'education', sourceName: 'دورية التعلم والتقنية', sourceType: 'جامعة أو دورية محكّمة', title: 'أثر القراءة الصوتية على الفهم القرائي', claim: 'تحسّن الفهم القرائي لدى القرّاء المترددين بعد ثمانية أسابيع.', quote: 'significant gains', url: 'https://example.org/audio-reading-study', publishedAt: '2024-11-01', retrievedAt: '2026-08-18', authority: 'عالية', enabled: true, createdAt: iso(34 * DAY) },
      { id: 'ev3', domain: 'family', sourceName: 'مركز دراسات الأسرة', sourceType: 'جامعة أو دورية محكّمة', title: 'قلق الاختبارات لدى المراهقين', claim: 'الدعم الأسري الهادئ يخفف أعراض القلق قبل الاختبارات.', quote: 'family support', url: 'https://example.org/test-anxiety', publishedAt: '2023-06-20', retrievedAt: '2026-07-30', authority: 'متوسطة', enabled: true, createdAt: iso(52 * DAY) },
    ]
  }
  if (sub === '/quality') return { week: { total: 168, answered: 141, clarified: 12, missed: 9, escalated: 6, concept: 38, taught: 11, missedPercent: 5, answeredPercent: 84 }, note: 'جودة الأسبوع الأخير مستقرة؛ الإخفاقات تتركز في موضوعين لا مادة منشورة عنهما.', glossary: { concepts: 64, aliases: 212 } }
  if (sub === '/weekly-report') return { days: 7, conversations: 74, awakened: 31, askedAbout: [{ label: 'قلق الامتحانات', count: 19 }, { label: 'الذكاء الاصطناعي في التعليم', count: 16 }, { label: 'كتب الدكتور', count: 11 }, { label: 'المحاضرات والورش', count: 8 }], notFound: [{ label: 'التعلم بالألعاب', count: 6 }, { label: 'الصف المقلوب', count: 4 }], note: 'أسبوع نشيط؛ أكثر الأسئلة عن الامتحانات والذكاء الاصطناعي.' }
  if (sub === '/self-check') return { ok: true, verdict: 'البوت سليم ويجيب كل المحادثات.', mutedCount: 0, checkedAt: iso(30_000), checks: [{ id: 'bridge', label: 'الجسر', state: 'ok', detail: 'متصل' }, { id: 'brain', label: 'العقل', state: 'ok', detail: 'يجيب خلال ثانيتين' }, { id: 'mute', label: 'المحادثات الصامتة', state: 'ok', detail: 'لا توجد محادثات صامتة' }] }
  if (sub === '/self-heal') return { ok: true, healed: 0, summary: 'لا شيء يحتاج علاجاً.', actions: [], healedAt: iso(0) }
  if (sub === '/personality') return { verbosity: 'layered', dialect: 'kuwaiti-light', initiative: 'one-question', signature: 'always', memoryConsent: 'explicit' }
  return { ok: true, demo: true, items: [] }
}
