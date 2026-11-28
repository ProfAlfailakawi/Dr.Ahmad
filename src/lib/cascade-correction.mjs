function clean(value) { return typeof value === 'string' ? value.trim() : '' }
function unique(values, limit = 80) { return [...new Set((Array.isArray(values) ? values : []).map((item) => clean(item)).filter(Boolean))].slice(0, limit) }
function record(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }

function shortHash(value) {
  let hash = 2166136261
  for (const character of String(value || '')) {
    hash ^= character.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).padStart(7, '0')
}

function safeSlug(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'article'
}

function sourceStatus(value) {
  return ['corrected', 'retracted'].includes(String(value)) ? String(value) : 'needs_review'
}

function layerState(value, fallback) {
  return clean(record(value).state) || fallback
}

function auditEntry(event, note, at = new Date().toISOString()) {
  return { event, note: clean(note), at: clean(at) || new Date().toISOString() }
}

export function cascadeCorrectionId(sourceId, articleSlug) {
  const slug = safeSlug(articleSlug)
  return `correction-${slug}-${shortHash(slug)}`
}

export function correctionLayerBlockers(value = {}) {
  const item = record(value)
  const layers = record(item.affectedLayers)
  const blockers = []
  if (layerState(layers.text, 'review_required') !== 'reviewed') blockers.push('النص والادعاءات')
  if (layerState(layers.audio, 'rerecord_required') !== 'verified') blockers.push('الصوت')
  if (layerState(layers.design, 'stale') !== 'verified') blockers.push('التصاميم')
  if (layerState(layers.social, 'hold') !== 'verified') blockers.push('التغريدات والمنصات')
  if (layerState(layers.campaign, 'hold') !== 'verified') blockers.push('الحملة')
  if (layerState(layers.passport, 'supersede_required') !== 'superseded') blockers.push('الجواز البديل')
  return blockers
}

export function correctionReadyForPassport(value = {}) {
  return correctionLayerBlockers(value).every((item) => item === 'الجواز البديل')
}

export function correctionBlocksRelease(value = {}) {
  const item = record(value)
  return Boolean(item.id) && item.status !== 'resolved'
}

function recalculate(value) {
  const next = JSON.parse(JSON.stringify(value))
  const blockers = correctionLayerBlockers(next)
  const resolved = blockers.length === 0
  next.status = resolved ? 'resolved'
    : correctionReadyForPassport(next) ? 'ready_for_passport'
      : next.status === 'detected' ? 'detected' : 'remediating'
  next.blocking = blockers
  next.holds = {
    release: !resolved,
    audioReuse: layerState(next.affectedLayers?.audio, '') !== 'verified',
    designExport: layerState(next.affectedLayers?.design, '') !== 'verified',
    socialReuse: layerState(next.affectedLayers?.social, '') !== 'verified',
    campaignQueue: layerState(next.affectedLayers?.campaign, '') !== 'verified',
  }
  next.nextAction = blockers[0] || 'راقب وصول المعنى المصحح في مرآة الأثر.'
  return next
}

/**
 * يبني سلسلة تصحيح خاصة لا تمس المادة العامة. كل طبقة متأثرة تتوقف وحدها،
 * ويبقى جوازها السابق دليلا تاريخيا حتى يوقع الخادم جوازا بديلا مرتبطا به.
 */
export function buildCascadeCorrectionCase(input = {}) {
  const source = record(input.source)
  const dependency = record(input.dependency)
  const article = record(input.article)
  const previous = record(input.previousPassport || article.publicationPassport)
  const existing = record(input.existingCase)
  const id = clean(existing.id) || cascadeCorrectionId(source.id || source.sourceId, article.slug || dependency.slug)
  const now = clean(input.now) || new Date().toISOString()
  const sourceId = clean(source.id || source.sourceId).replace(/^personal:/, '')
  const sourceRef = sourceId ? `personal:${sourceId}` : clean(source.reference)
  const trigger = {
    sourceId: sourceRef,
    sourceTitle: clean(source.title || source.sourceTitle),
    sourceStatus: sourceStatus(source.status || source.suggestedStatus || source.sourceStatus),
    provider: clean(source.provider || record(source.watch).provider),
    signals: unique(source.signals || record(source.watch).signals, 12),
    detectedAt: now,
  }
  const existingTriggers = Array.isArray(existing.triggers) ? existing.triggers.map(record) : clean(record(existing.trigger).sourceId) ? [record(existing.trigger)] : []
  const isNewTrigger = !existingTriggers.some((item) => clean(item.sourceId) === trigger.sourceId && clean(item.sourceStatus) === trigger.sourceStatus)
  const triggers = [...existingTriggers, ...(isNewTrigger ? [trigger] : [])].slice(-20)
  const reopensResolvedCase = existing.status === 'resolved' && isNewTrigger
  const evidence = record(dependency.evidenceChain)
  const claims = (Array.isArray(evidence.claims) ? evidence.claims : [])
    .filter((claim) => {
      const row = record(claim)
      const ids = [...(Array.isArray(row.sourceIds) ? row.sourceIds : []), row.sourceId]
      return !sourceRef || ids.map(String).includes(sourceRef)
    })
    .map((claim) => {
      const row = record(claim)
      return { id: clean(row.id), text: clean(row.text || row.claim).slice(0, 700) }
    })
    .filter((claim) => claim.id || claim.text)
    .slice(0, 40)
  const oldLayers = reopensResolvedCase ? {} : record(existing.affectedLayers)
  const previousPassportId = clean(reopensResolvedCase
    ? previous.passportId || dependency.publicationPassportId
    : record(oldLayers.passport).previousPassportId || existing.previousPassportId || previous.passportId || dependency.publicationPassportId)
  const created = clean(existing.createdAtClient) || now
  const status = trigger.sourceStatus
  const fresh = {
    schemaVersion: 1,
    kind: 'cascade-correction-protocol',
    id,
    status: reopensResolvedCase ? 'detected' : clean(existing.status) || 'detected',
    article: {
      slug: clean(article.slug || dependency.slug),
      title: clean(article.title || dependency.title),
    },
    trigger: { ...trigger, detectedAt: isNewTrigger ? now : clean(record(existing.trigger).detectedAt) || now },
    triggers,
    affectedClaims: claims.length ? claims : (Array.isArray(existing.affectedClaims) ? existing.affectedClaims : []),
    affectedLayers: {
      text: { state: layerState(oldLayers.text, 'review_required'), reason: 'يلزم فحص الادعاء المرتبط بالمصدر قبل أي تعديل أو إعادة نشر.' },
      audio: { state: layerState(oldLayers.audio, 'rerecord_required'), reason: 'لا يعاد استخدام القراءة القديمة حتى يثبت توافقها مع النص المصحح.' },
      design: { state: layerState(oldLayers.design, 'stale'), reason: 'التصميم القديم قد يحمل عنوانا أو اختزالاً من النسخة السابقة.' },
      social: { state: layerState(oldLayers.social, 'hold'), reason: 'تتوقف التغريدات والنسخ المشتقة الخاصة بهذه المادة فقط.' },
      campaign: { state: layerState(oldLayers.campaign, 'hold'), reason: 'تتوقف رحلة الحملة المرتبطة حتى يعاد بناؤها من النسخة المصححة.' },
      passport: {
        state: layerState(oldLayers.passport, 'supersede_required'),
        reason: 'الجواز السابق لا يحذف؛ يربط به جواز بديل موقع.',
        previousPassportId,
        nextPassportId: clean(record(oldLayers.passport).nextPassportId),
      },
    },
    previousPassportId,
    audit: [
      ...(Array.isArray(existing.audit) ? existing.audit : []),
      ...(!existing.audit?.length || isNewTrigger ? [auditEntry('detected', `اكتشفت حالة ${status} في المصدر وفتحت سلسلة الاعتماد.`, now)] : []),
    ].slice(-60),
    impact: {
      correctionRecorded: true,
      correctedMeaningLanded: record(existing.impact).correctedMeaningLanded ?? null,
      checkedAt: clean(record(existing.impact).checkedAt),
      observation: clean(record(existing.impact).observation),
    },
    createdAtClient: created,
    updatedAtClient: now,
  }
  return recalculate(fresh)
}

export function advanceCascadeCorrection(value = {}, event = '', payload = {}) {
  const current = buildCascadeCorrectionCase({ existingCase: value, source: record(value).trigger, dependency: {}, article: record(value).article, now: payload.at })
  const next = JSON.parse(JSON.stringify(current))
  const at = clean(payload.at) || new Date().toISOString()
  const setLayer = (name, state) => { next.affectedLayers[name] = { ...next.affectedLayers[name], state } }
  const notes = {
    start: 'بدأت المراجعة التنفيذية للسلسلة.',
    text_reviewed: 'ثبتت مراجعة النص والادعاءات المتأثرة.',
    audio_replaced: 'ثبتت قراءة صوتية موافقة للنسخة المصححة.',
    design_rebuilt: 'ثبتت إعادة بناء التصاميم من النسخة المصححة.',
    social_rebuilt: 'ثبتت إعادة بناء التغريدات والنسخ الاجتماعية.',
    campaign_rebuilt: 'ثبتت إعادة بناء الحملة المتسلسلة.',
    passport_signed: 'وقع الجواز البديل وربط بالجواز السابق من دون محو التاريخ.',
    landing_observed: 'سجلت مرآة الأثر نتيجة وصول المعنى المصحح.',
  }
  if (event === 'start') next.status = 'remediating'
  else if (event === 'text_reviewed') setLayer('text', 'reviewed')
  else if (event === 'audio_replaced') setLayer('audio', 'verified')
  else if (event === 'design_rebuilt') setLayer('design', 'verified')
  else if (event === 'social_rebuilt') setLayer('social', 'verified')
  else if (event === 'campaign_rebuilt') setLayer('campaign', 'verified')
  else if (event === 'passport_signed') {
    if (!correctionReadyForPassport(next)) throw new Error(`لا يمكن توقيع الجواز البديل قبل إكمال: ${correctionLayerBlockers(next).filter((item) => item !== 'الجواز البديل').join('، ')}`)
    setLayer('passport', 'superseded')
    next.affectedLayers.passport.nextPassportId = clean(payload.passportId)
  } else if (event === 'landing_observed') {
    next.impact.correctedMeaningLanded = payload.landed === true ? true : payload.landed === false ? false : null
    next.impact.checkedAt = at
    next.impact.observation = clean(payload.observation).slice(0, 900)
  } else throw new Error('حدث تصحيح غير معروف.')
  next.audit = [...(Array.isArray(next.audit) ? next.audit : []), auditEntry(event, clean(payload.note) || notes[event] || event, at)].slice(-60)
  next.updatedAtClient = at
  return recalculate(next)
}

export function cascadeCorrectionSummary(value = {}) {
  const item = recalculate(record(value))
  return {
    id: clean(item.id),
    status: clean(item.status),
    articleSlug: clean(record(item.article).slug),
    sourceStatus: clean(record(item.trigger).sourceStatus),
    blocking: Array.isArray(item.blocking) ? item.blocking : [],
    holds: record(item.holds),
    readyForPassport: correctionReadyForPassport(item),
    previousPassportId: clean(item.previousPassportId),
    nextPassportId: clean(record(record(item.affectedLayers).passport).nextPassportId),
    correctedMeaningLanded: record(item.impact).correctedMeaningLanded ?? null,
    updatedAtClient: clean(item.updatedAtClient),
  }
}
