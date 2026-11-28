export type ImpactObservationSource = 'comment' | 'conversation' | 'message' | 'field' | 'other'
export type ImpactMirrorObservation = {
  id: string
  text: string
  source: ImpactObservationSource
  at: string
  assessment: { status: 'aligned' | 'partial' | 'drift' | 'unmeasured'; score: number; thesisCoverage: number; protectedCoverage: number; caveatCoverage: number; alerts: string[] }
}
export type EditorialImpactMirror = {
  schemaVersion: 1
  kind: 'editorial-impact-mirror'
  status: 'awaiting-observations' | 'preliminary' | 'aligned' | 'mixed' | 'drift'
  intent: { title: string; thesis: string; protectedPoints: string[]; caveats: string[]; expectedAction: string; audience: string; fingerprintHash: string }
  observations: ImpactMirrorObservation[]
  evidenceQuality: 'unmeasured' | 'limited' | 'useful'
  semanticScore: number | null
  resonance: { score: number | null; shareRate: number | null; listenCompletion: number | null; onwardRate: number | null; metrics: Record<string, number | string | null> }
  counts: { total: number; aligned: number; partial: number; drift: number }
  reopenRecommended: boolean
  learning: { protect: string[]; clarify: string[]; amplify: string[] }
  correction?: { caseId: string; status: string; sourceStatus: string; previousFingerprintHash: string; correctedFingerprintHash: string; correctedAt: string; correctedMeaningLanded: boolean | null }
  note: string
  updatedAt: string
}
export function buildImpactMirror(input?: Record<string, any>): EditorialImpactMirror
export function impactMirrorSummary(mirror?: Partial<EditorialImpactMirror>): string
