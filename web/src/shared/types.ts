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

/** 고른 프로젝트 방법 하나가 이력서에 넣을 문장. 문장의 {빈칸}은 실제 결과가 나오면 채운다. */
export type SentenceItem = {
  /** 방법을 고른 키(요건 번호:방법 번호). 고른 방법과 같은 키를 쓴다. */
  key: string
  requirement: string
  label: string
  hours: number
  sentence: string
  steps: string[]
  /** 한 프로젝트로 묶은 방법들의 키. 묶지 않았으면 없고 key 하나다. */
  keys?: string[]
  /** 묶은 방법의 이름들. 묶지 않았으면 없다. */
  sources?: string[]
  /** 이 문장이 들어갈 이력서의 기존 문장. 모르면 null이다. */
  after: string | null
  /** 해낸 할 일(글자 그대로). */
  ticked: string[]
  answers: Record<string, string>
  done: boolean
}

export type SentencesState = { items: SentenceItem[]; confirmed: boolean }

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
  sentences?: SentencesState
  weeklyHours?: number
  /** 예전 저장 형식. 일 단위로 끝냈는지만 기록했다. */
  doneTasks?: string[]
  completions?: Completion[]
  /** 서버 검사를 마친 판단. 있으면 대화 기록 대신 이것을 보여 준다. */
  rows?: Row[]
  retries?: number
}
