export type AdversarialStatus = 'passed' | 'review' | 'blocked' | 'pending'
export type AdversarialScenario = {
  id: string
  actor: string
  attack: string
  vulnerableAsset: string
  risk: number
  severity: 'critical' | 'high' | 'medium' | 'low'
  likelihood: string
  evidence: string
  defense: string
}
export type AdversarialMisunderstandingSimulation = {
  schemaVersion: 1
  kind: 'adversarial-misunderstanding-simulation'
  status: AdversarialStatus
  releaseReady: boolean
  score: number
  highRiskCount: number
  scenarios: AdversarialScenario[]
  defenses: string[]
  alerts: string[]
}
export type ObservedInterpretationAssessment = {
  status: 'aligned' | 'partial' | 'drift' | 'unmeasured'
  score: number
  thesisCoverage: number
  protectedCoverage: number
  caveatCoverage: number
  alerts: string[]
}
export function buildAdversarialMisunderstandingSimulation(input?: Record<string, any>): AdversarialMisunderstandingSimulation
export function assessObservedInterpretation(intent?: Record<string, any>, observedText?: string): ObservedInterpretationAssessment
export function adversarialSimulationSummary(simulation?: Partial<AdversarialMisunderstandingSimulation>): string
