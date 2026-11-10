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
  /** 비교를 시작한 시각(ms). 예전 기록에는 없다. */
  createdAt?: number
  edits: Record<number, Verdict>
  /** 예전 저장 형식의 화면 단계. 이제는 주소가 대신한다. */
  stage?: 'directions' | 'plan'
  directions?: DirectionsRun
  /** 나에게 해당하지 않아 뺀 요건의 이름. 방법 제안과 이번 주 할 일에서 빠진다. */
  skippedGaps?: string[]
  weeklyHours?: number
  /** 예전 저장 형식. 일 단위로 끝냈는지만 기록했다. */
  doneTasks?: string[]
  completions?: Completion[]
  /** 서버 검사를 마친 판단. 있으면 대화 기록 대신 이것을 보여 준다. */
  rows?: Row[]
  retries?: number
}
