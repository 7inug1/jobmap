import type { Run } from '../shared/types.ts'

export type Stage = Run['stage']

/** 로고를 누르면 가는 곳. 할 일을 정했으면 이번 주 할 일, 아니면 비교 결과다. */
export function homeStage(run: Run): Stage {
  return run.directions && run.directions.picks.length > 0 ? 'plan' : undefined
}

/** 이미 지나온 단계만 탭으로 보여 준다. 데모의 상단 탭 중 지금 있는 화면만 연결한다. */
export function tabsFor(run: Run): { label: string; stage: Stage }[] {
  const tabs: { label: string; stage: Stage }[] = []
  if (homeStage(run) === 'plan') tabs.push({ label: '이번 주 할 일', stage: 'plan' })
  tabs.push({ label: '공고 같이 보기', stage: undefined })
  if (run.directions) tabs.push({ label: '방향 고르기', stage: 'directions' })
  return tabs
}
