import { itemKeys } from '../resume/sentences.ts'
import type { Run } from '../../shared/types.ts'

// 서비스의 기본 약속. 이번 주 할 일 화면에서 바꿀 수 있다.
export const DEFAULT_WEEKLY_HOURS = 3

export type PlanTask = {
  key: string
  groupKey: string
  groupTitle: string
  lane: 'resume' | 'know'
  title: string
  /** 계산에만 쓰는 최소 시간. 화면에는 보이지 않고, 일주일 분량과 전체 기간을 셀 때만 쓴다. */
  hours: number
  done: boolean
  /** 이력서 문장의 할 일이면 그 문장의 키와 할 일 글자. */
  itemKey?: string
  step?: string
}

/**
 * 고른 방법을 할 일로 펼친다. 이력서에 넣을 프로젝트는 문장 하나를 쓰는 데 필요한 할 일 하나하나이고,
 * 공부는 방법 하나가 할 일 하나다. 해당 없음으로 뺀 요건의 공부는 만들지 않는다.
 * 할 일의 시간은 문장의 시간을 할 일 수로 나눈 값이다.
 */
export function buildPlanTasks(run: Run): PlanTask[] {
  const directions = run.directions
  if (!directions) return []
  const done = new Set(run.doneTasks ?? [])
  const items = run.sentences?.items ?? []
  const covered = new Set(items.flatMap(itemKeys))
  const skipped = run.skippedGaps ?? []

  const resume = items.flatMap((item) =>
    item.steps.map((step): PlanTask => ({
      key: `${item.key}|${step}`,
      groupKey: item.key,
      groupTitle: item.label,
      lane: 'resume',
      title: step,
      hours: item.hours / item.steps.length,
      done: item.ticked.includes(step),
      itemKey: item.key,
      step,
    })),
  )

  const others = directions.directions
    .filter(({ requirement }) => !skipped.includes(requirement))
    .flatMap(({ gapNumber, options }) =>
      options.flatMap((option, index): PlanTask[] => {
        const key = `${gapNumber}:${index}`
        if (!directions.picks.includes(key)) return []
        if (option.lane === 'study') {
          return [{ key, groupKey: 'study', groupTitle: '지식 공부', lane: 'know', title: option.label, hours: option.hours, done: done.has(key) }]
        }
        // 이력서 문장을 만들기 전의 예전 기록은 프로젝트 방법 하나를 일 하나로 센다.
        return covered.has(key) ? [] : [{ key, groupKey: key, groupTitle: option.label, lane: 'resume', title: option.label, hours: option.hours, done: done.has(key) }]
      }),
    )
  return [...resume, ...others]
}

/** 할 일을 체크하거나 푼다. 이력서 문장의 할 일은 문장에, 그 밖의 일은 끝낸 일 목록에 기록한다. */
export function toggleTask(run: Run, task: PlanTask): Run {
  if (task.itemKey !== undefined && task.step !== undefined && run.sentences) {
    const step = task.step
    const items = run.sentences.items.map((item) =>
      item.key === task.itemKey ? { ...item, ticked: item.ticked.includes(step) ? item.ticked.filter((other) => other !== step) : [...item.ticked, step] } : item,
    )
    return { ...run, sentences: { ...run.sentences, items } }
  }
  const done = run.doneTasks ?? []
  return { ...run, doneTasks: done.includes(task.key) ? done.filter((key) => key !== task.key) : [...done, task.key] }
}

/** 이번 주에 할 일. 끝나지 않은 일을 순서대로 일주일 시간 안에서 담고, 첫 일이 일주일보다 커도 하나는 담는다. */
export function thisWeekTasks(tasks: readonly PlanTask[], weeklyHours: number): PlanTask[] {
  const picked: PlanTask[] = []
  let used = 0
  for (const task of tasks.filter(({ done }) => !done)) {
    if (picked.length > 0 && used + task.hours > weeklyHours) break
    picked.push(task)
    used += task.hours
  }
  return picked
}

/** 남은 일을 다 끝내는 데 걸리는 주 수(최소). */
export function remainingWeeks(tasks: readonly PlanTask[], weeklyHours: number): number {
  const hours = tasks.filter(({ done }) => !done).reduce((total, task) => total + task.hours, 0)
  return Math.ceil(hours / weeklyHours)
}

/** 주 수를 사람이 말하는 단위(몇 개월 몇 주)로 바꾼다. 4주를 1개월로 센다. */
export function formatDuration(weeks: number): string {
  if (weeks <= 0) return '모두 끝냈어요'
  const months = Math.floor(weeks / 4)
  const rest = weeks % 4
  return [months > 0 ? `${months}개월` : '', rest > 0 ? `${rest}주` : ''].filter(Boolean).join(' ')
}

/** 달력의 칸. 첫 요일만큼 앞을 비우고 날짜를 채운다. */
export function monthCells(year: number, monthIndex: number): (number | null)[] {
  const first = new Date(year, monthIndex, 1).getDay()
  const days = new Date(year, monthIndex + 1, 0).getDate()
  return [...Array.from({ length: first }, () => null), ...Array.from({ length: days }, (_, index) => index + 1)]
}

const pad = (value: number) => String(value).padStart(2, '0')

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function dateLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number]
  return `${month}월 ${day}일 (${'일월화수목금토'[new Date(year, month - 1, day).getDay()]})`
}
