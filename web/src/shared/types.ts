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

/** 이번 주 할 일에서 체크한 기록. 큰 일은 여러 주에 걸쳐 쌓인다. */
export type Completion = { key: string; hours: number }

export type Inputs = { posting: string; resume: string }

export type DirectionsRun = { gaps: Gap[]; directions: Direction[]; picks: string[] }

export type Run = Inputs & {
  id: string
  edits: Record<number, Verdict>
  stage?: 'directions' | 'plan'
  directions?: DirectionsRun
  weeklyHours?: number
  /** 예전 저장 형식. 일 단위로 끝냈는지만 기록했다. */
  doneTasks?: string[]
  completions?: Completion[]
  retries?: number
}
