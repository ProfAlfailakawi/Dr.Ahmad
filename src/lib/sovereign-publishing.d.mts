export type PassportComponentStatus = 'verified' | 'review' | 'pending'
export type PublicationPassportDraft = {
  schemaVersion: 1
  kind: 'sovereign-publication-passport'
  article: { slug: string; title: string }
  components: {
    text: { status: PassportComponentStatus; wordCount: number; title: string; slug: string; body?: string; excerpt?: string; meaningFingerprint: string; bodyHash?: string; excerptHash?: string }
    audio: { status: PassportComponentStatus; assets: string[]; note: string }
    design: { status: PassportComponentStatus; assetCount: number; qualityScore: number; fingerprints?: string[]; fingerprintHashes?: string[] }
    social: { status: PassportComponentStatus; tweetCount: number; platformCount: number; campaignId: string; content?: string; contentHash?: string }
    sources: { status: PassportComponentStatus; ids?: string[]; proofs?: string[]; alerts?: string[]; sourceCount?: number; proofCount?: number; alertCount?: number; idHashes?: string[]; proofHashes?: string[]; alertHashes?: string[] }
  }
  semanticCourt: MultimodalMeaningCourt
  _semanticCourtInput?: Record<string, any>
  releaseDecision: { targetStatus: 'draft' | 'published' | 'scheduled'; manualOverride: boolean; overrideReason?: string; overrideReasonHash?: string; overrideReasonLength?: number }
  releaseReady: boolean
  blocking: string[]
}
export type SignedPublicationPassport = {
  schemaVersion: 1
  passportId: string
  fingerprint: string
  signature: string
  algorithm: 'RS256'
  keyId: string
  publicKey: string
  signedAt: string
  selfVerified: boolean
  manifest: PublicationPassportDraft
}
export type TransformingCampaignStage = { day: number; platform: string; role: string; goal: string; carriesFrom: string; handoff: string; copy: string; decisionSignal: string }
export type TransformingCampaign = { schemaVersion: 2; kind: 'transforming-seven-day-campaign'; id: string; title: string; thesis: string; promise: string; continuityScore: number; stages: TransformingCampaignStage[] }
export type OpportunityRadarItem = {
  id: string; confidence: number; threshold: number
  event: { id: string; title: string; summary: string; source: string; url: string; publishedAt: string; ageHours: number }
  article: { slug: string; title: string; excerpt: string; iso: string }
  sharedConcepts: string[]
  breakdown: { topical: number; recency: number; evidence: number; archiveStrength: number }
  whyNow: string; recommendation: string
}
export function stableCanonicalJson(value: unknown): string
export function buildPublicationPassportDraft(input?: Record<string, any>): PublicationPassportDraft
export function sealPublicationPassportDraft(draft: PublicationPassportDraft, digest: (value: string) => Promise<string>): Promise<PublicationPassportDraft>
export function buildTransformingCampaign(input?: Record<string, any>): TransformingCampaign
export function buildOpportunityRadar(events?: Record<string, any>[], articles?: Record<string, any>[], options?: { now?: number; threshold?: number; limit?: number }): OpportunityRadarItem[]
import type { MultimodalMeaningCourt } from './semantic-court.mjs'
