export type CascadeLayerState = 'review_required' | 'reviewed' | 'rerecord_required' | 'stale' | 'hold' | 'verified' | 'supersede_required' | 'superseded'
export type CascadeCorrectionStatus = 'detected' | 'remediating' | 'ready_for_passport' | 'resolved'
export type CascadeCorrectionCase = {
  schemaVersion: 1
  kind: 'cascade-correction-protocol'
  id: string
  status: CascadeCorrectionStatus
  article: { slug: string; title: string }
  trigger: { sourceId: string; sourceTitle: string; sourceStatus: 'needs_review' | 'corrected' | 'retracted'; provider: string; signals: string[]; detectedAt: string }
  triggers: Array<{ sourceId: string; sourceTitle: string; sourceStatus: 'needs_review' | 'corrected' | 'retracted'; provider: string; signals: string[]; detectedAt: string }>
  affectedClaims: Array<{ id: string; text: string }>
  affectedLayers: {
    text: { state: CascadeLayerState; reason: string }
    audio: { state: CascadeLayerState; reason: string }
    design: { state: CascadeLayerState; reason: string }
    social: { state: CascadeLayerState; reason: string }
    campaign: { state: CascadeLayerState; reason: string }
    passport: { state: CascadeLayerState; reason: string; previousPassportId: string; nextPassportId: string }
  }
  previousPassportId: string
  audit: Array<{ event: string; note: string; at: string }>
  impact: { correctionRecorded: boolean; correctedMeaningLanded: boolean | null; checkedAt: string; observation: string }
  blocking: string[]
  holds: { release: boolean; audioReuse: boolean; designExport: boolean; socialReuse: boolean; campaignQueue: boolean }
  nextAction: string
  createdAtClient: string
  updatedAtClient: string
}
export type CascadeCorrectionEvent = 'start' | 'text_reviewed' | 'audio_replaced' | 'design_rebuilt' | 'social_rebuilt' | 'campaign_rebuilt' | 'passport_signed' | 'landing_observed'
export function cascadeCorrectionId(sourceId: string, articleSlug: string): string
export function buildCascadeCorrectionCase(input?: Record<string, any>): CascadeCorrectionCase
export function advanceCascadeCorrection(value: CascadeCorrectionCase, event: CascadeCorrectionEvent, payload?: Record<string, any>): CascadeCorrectionCase
export function correctionLayerBlockers(value?: Partial<CascadeCorrectionCase>): string[]
export function correctionReadyForPassport(value?: Partial<CascadeCorrectionCase>): boolean
export function correctionBlocksRelease(value?: Partial<CascadeCorrectionCase>): boolean
export function cascadeCorrectionSummary(value?: Partial<CascadeCorrectionCase>): Record<string, any>
