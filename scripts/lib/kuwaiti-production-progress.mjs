import assert from 'node:assert/strict'

export const QUALITY_HOLD_STATUS = 'quality-hold'

export function isVerifiedKuwaitiEpisode(audioMeta, slug) {
  return audioMeta?.[`${slug}.dialogue-kw.mp3`]?.validationStatus === 'verified-r2'
}

export function validateKuwaitiQualityHolds(document, knownSlugs = []) {
  assert.equal(document?.schemaVersion, 1, 'نسخة سجل تأجيل الجودة غير معروفة')
  assert.ok(Array.isArray(document?.episodes), 'سجل تأجيل الجودة بلا episodes')
  const known = new Set(knownSlugs)
  const seen = new Set()
  for (const episode of document.episodes) {
    assert.equal(episode?.status, QUALITY_HOLD_STATUS, `${episode?.slug || 'unknown'}: حالة تأجيل غير صالحة`)
    assert.match(String(episode?.slug || ''), /^[a-z0-9-]+$/u, 'slug غير صالح في سجل التأجيل')
    assert.ok(!seen.has(episode.slug), `${episode.slug}: مكرر في سجل التأجيل`)
    if (known.size) assert.ok(known.has(episode.slug), `${episode.slug}: ليس من مقالات الإنتاج المعتمدة`)
    assert.ok(Number(episode.failedRunId) > 0, `${episode.slug}: run id مفقود`)
    assert.ok(Number(episode.failedRunAttempt) >= 3, `${episode.slug}: لم يستنفد ثلاث جولات كاملة`)
    assert.ok(Number(episode.failedRounds) >= 3, `${episode.slug}: عدد الجولات غير كاف`)
    assert.ok(Number(episode.failedTakes) >= 18, `${episode.slug}: عدد العينات غير كاف`)
    assert.ok(String(episode.reason || '').trim(), `${episode.slug}: سبب التأجيل مفقود`)
    seen.add(episode.slug)
  }
  return document
}

export function getKuwaitiQualityHoldSet(document, knownSlugs = []) {
  validateKuwaitiQualityHolds(document, knownSlugs)
  return new Set(document.episodes.map((episode) => episode.slug))
}

export function getKuwaitiProductionProgress({ slugs, audioMeta, qualityHolds }) {
  const ordered = [...slugs]
  const holds = getKuwaitiQualityHoldSet(qualityHolds, ordered)
  const verifiedSlugs = ordered.filter((slug) => isVerifiedKuwaitiEpisode(audioMeta, slug))
  const missingSlugs = ordered.filter((slug) => !isVerifiedKuwaitiEpisode(audioMeta, slug))
  const heldMissingSlugs = missingSlugs.filter((slug) => holds.has(slug))
  const actionableSlugs = missingSlugs.filter((slug) => !holds.has(slug))
  return {
    total: ordered.length,
    verified: verifiedSlugs.length,
    missing: missingSlugs.length,
    actionable: actionableSlugs.length,
    heldMissing: heldMissingSlugs.length,
    complete: missingSlugs.length === 0,
    nextSlug: actionableSlugs[0] || '',
    verifiedSlugs,
    missingSlugs,
    actionableSlugs,
    heldMissingSlugs,
  }
}

export function selectKuwaitiProductionSlug({
  slugs,
  audioMeta,
  qualityHolds,
  explicitSlug = '',
  includeQualityHolds = false,
  batch = 1,
}) {
  const progress = getKuwaitiProductionProgress({ slugs, audioMeta, qualityHolds })
  const holds = getKuwaitiQualityHoldSet(qualityHolds, slugs)
  if (explicitSlug) {
    assert.ok(slugs.includes(explicitSlug), `${explicitSlug}: slug غير معتمد`)
    assert.ok(!isVerifiedKuwaitiEpisode(audioMeta, explicitSlug), `${explicitSlug}: منشور ومتحقق؛ ممنوع صرفه مرة ثانية`)
    assert.ok(includeQualityHolds || !holds.has(explicitSlug),
      `${explicitSlug}: مؤجل بعد ثلاث جولات؛ فعّل include_quality_holds فقط عند مراجعته لاحقا`)
    return explicitSlug
  }
  assert.ok(Number.isInteger(batch) && batch >= 1, 'batch يجب أن يكون عددا موجبا')
  return progress.actionableSlugs[batch - 1] || ''
}

export function deferKuwaitiQualityHold(document, entry) {
  const episodes = [...(document?.episodes || [])]
  const normalized = {
    slug: String(entry.slug || '').trim(),
    status: QUALITY_HOLD_STATUS,
    failedRunId: Number(entry.failedRunId),
    failedRunAttempt: Number(entry.failedRunAttempt),
    failedRounds: Number(entry.failedRounds),
    failedTakes: Number(entry.failedTakes),
    reason: String(entry.reason || '').trim(),
    deferredAt: String(entry.deferredAt || new Date().toISOString()),
  }
  const index = episodes.findIndex((episode) => episode.slug === normalized.slug)
  if (index >= 0) {
    const previous = episodes[index]
    if (previous.failedRunId === normalized.failedRunId
      && previous.failedRunAttempt === normalized.failedRunAttempt
      && previous.failedTakes === normalized.failedTakes
      && previous.reason === normalized.reason) {
      normalized.deferredAt = previous.deferredAt
    }
    episodes[index] = normalized
  } else {
    episodes.push(normalized)
  }
  return { ...document, episodes }
}

export function releaseKuwaitiQualityHold(document, slug) {
  return {
    ...document,
    episodes: (document?.episodes || []).filter((episode) => episode.slug !== slug),
  }
}
