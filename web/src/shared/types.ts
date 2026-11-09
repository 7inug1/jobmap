export type Verdict = 'met' | 'partial' | 'unmet'

export type Row = {
  requirement: string
  verdict: Verdict
  postingQuote: string
  resumeQuote: string | null
}

export type Gap = { requirement: string; verdict: 'partial' | 'unmet' }

export type DirectionOption = {
  label: string
  description: string
  lane: 'study' | 'project'
  hours: number
  recommended: boolean
}

export type Direction = Gap & { gapNumber: number; options: DirectionOption[] }

export type Inputs = { posting: string; resume: string }

export type DirectionsRun = { gaps: Gap[]; directions: Direction[]; picks: string[] }

export type Run = Inputs & {
  id: string
  edits: Record<number, Verdict>
  stage?: 'directions' | 'plan'
  directions?: DirectionsRun
  weeklyHours?: number
  doneTasks?: string[]
}
