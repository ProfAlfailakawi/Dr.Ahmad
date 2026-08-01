import type { AdversarialMisunderstandingSimulation } from './adversarial-misunderstanding.mjs'

export type SemanticCourtStatus = 'passed' | 'review' | 'blocked' | 'pending'
export type SemanticCourtUnit = { id: string; channel: string; status: SemanticCourtStatus; score: number; thesisCoverage: number; protectedCoverage: number; caveats: { status: SemanticCourtStatus; score: number; preserved: number; total: number; missing: string[] }; alerts: string[] }
export type SemanticCourtChamber = { label: string; status: SemanticCourtStatus; score: number; checked: number; passed: number; alerts: string[]; units: SemanticCourtUnit[]; sourceLocked?: boolean; verificationMode?: 'source-lock' }
export type SemanticCourtSafeguard = { label: string; status: SemanticCourtStatus; score: number; alerts: string[]; preserved?: number; total?: number }
export type MultimodalMeaningCourt = { schemaVersion: 2; kind: 'multimodal-meaning-court'; fingerprintHash: string; status: SemanticCourtStatus; releaseReady: boolean; score: number; chambers: Record<'text' | 'audio' | 'design' | 'social' | 'sources', SemanticCourtChamber>; safeguards: Record<'headlineGuard' | 'caveatCovenant' | 'claimLineage', SemanticCourtSafeguard>; adversarialSimulation: AdversarialMisunderstandingSimulation; alerts: string[] }
export function buildMultimodalMeaningCourt(input?: Record<string, any>): MultimodalMeaningCourt
export function semanticCourtSummary(court?: Partial<MultimodalMeaningCourt>): string
