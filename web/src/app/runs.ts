import { applyEdits } from '../features/comparison/comparison.ts'
import type { Run } from '../shared/types.ts'

export type Step = 'directions' | 'resume' | 'plan' | undefined
export type Progress = 'compare' | 'directions' | 'plan'

// 이 브라우저에 쌓는 기록 수. 기록마다 이력서와 공고 원문이 들어 있어 무한히 쌓지 않는다.
export const MAX_RUNS = 20
const UNFINISHED_KEEP_MS = 24 * 60 * 60 * 1000
const MAX_TITLE_LENGTH = 60

export function runPath(id: string, step?: 'directions' | 'resume' | 'plan'): string {
  return step ? `/runs/${id}/${step}` : `/runs/${id}`
}

/** 기록 목록에 보일 공고 이름. 공고의 첫 제목(#)을 쓰고, 없으면 첫 줄을 쓴다. */
export function postingTitle(posting: string): string {
  const lines = posting.split('\n').map((line) => line.trim()).filter((line) => line !== '')
  const heading = lines.find((line) => /^#\s+\S/.test(line))
  const raw = (heading ?? lines[0] ?? '').replace(/^(?:#+|-|•)\s+/, '')
  if (raw === '') return '이름 없는 공고'
  return raw.length > MAX_TITLE_LENGTH ? `${raw.slice(0, MAX_TITLE_LENGTH)}…` : raw
}

/** 같은 기록은 자리를 지키고 내용만 바꾼다. 새 기록은 맨 앞에 두고 넘치면 가장 오래된 것부터 버린다. */
export function upsertRun(runs: readonly Run[], run: Run): Run[] {
  const exists = runs.some(({ id }) => id === run.id)
  const next = exists ? runs.map((saved) => (saved.id === run.id ? run : saved)) : [run, ...runs]
  return next.slice(0, MAX_RUNS)
}

export function removeRun(runs: readonly Run[], id: string): Run[] {
  return runs.filter((run) => run.id !== id)
}

/** 비교를 끝내지 못한 채 하루가 지난 기록은 쓸모가 없어 버린다. 만든 시각을 모르는 기록은 남긴다. */
export function pruneRuns(runs: readonly Run[], now: number): Run[] {
  return runs.filter((run) => run.rows !== undefined || run.createdAt === undefined || now - run.createdAt < UNFINISHED_KEEP_MS)
}

export function summarizeRun(run: Run) {
  const rows = applyEdits(run.rows ?? [], run.edits)
  const progress: Progress = run.directions ? (run.directions.picks.length > 0 ? 'plan' : 'directions') : 'compare'
  return {
    title: postingTitle(run.posting),
    createdAt: run.createdAt,
    total: rows.length,
    met: rows.filter(({ verdict }) => verdict === 'met').length,
    step: progress,
  }
}

/** 아직 갈 수 없는 단계의 주소로 들어오면 갈 수 있는 가장 가까운 단계의 주소를 돌려준다. 갈 수 있으면 null이다. */
export function guardStep(run: Run, step: Step): string | null {
  if (step === 'directions' && !run.directions) return runPath(run.id)
  if (step === 'resume') {
    if (!run.directions) return runPath(run.id)
    if (!run.sentences) return runPath(run.id, 'directions')
  }
  if (step === 'plan') {
    if (!run.directions) return runPath(run.id)
    if (run.directions.picks.length === 0) return runPath(run.id, 'directions')
  }
  return null
}
