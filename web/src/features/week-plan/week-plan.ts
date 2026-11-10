import { pickKey } from '../../shared/pick-key.ts'
import type { Completion, Direction, DirectionOption } from '../../shared/types.ts'

// 서비스의 기본 약속. 이번 주 할 일 화면에서 바꿀 수 있다.
export const DEFAULT_WEEKLY_HOURS = 3

export type WeekTask = DirectionOption & { key: string; requirement: string }

/** 이번 주 할 일이면 weekHours가 있고, leftHours는 이번 주 전까지 남은 시간이다. 다음에 할 일이면 이번 주 분량을 뺀 남은 시간이다. */
export type PlanItem = WeekTask & { doneHours: number; leftHours: number; weekHours?: number }

/**
 * 고른 일을 일주일 시간에 맞춰 나눈다.
 * 일주일보다 큰 일은 이번 주 분량만 정하고, 해낸 시간을 기록해 다음 주에 이어 간다.
 */
export function buildWeekPlan(
  directions: readonly Direction[],
  picks: readonly string[],
  completions: readonly Completion[],
  weeklyHours: number,
) {
  const tasks: WeekTask[] = directions.flatMap(({ gapNumber, requirement, options }) =>
    options.flatMap((option, index) => {
      const key = pickKey(gapNumber, index)
      return picks.includes(key) ? [{ ...option, key, requirement }] : []
    }),
  )
  const doneHoursOf = (task: WeekTask) =>
    Math.min(
      task.hours,
      completions.filter(({ key }) => key === task.key).reduce((total, { hours }) => total + hours, 0),
    )

  const done: WeekTask[] = []
  const thisWeek: PlanItem[] = []
  const later: PlanItem[] = []
  let capacity = weeklyHours
  let hoursLeft = 0

  for (const task of tasks) {
    const doneHours = doneHoursOf(task)
    const leftHours = task.hours - doneHours
    if (leftHours <= 0) {
      done.push(task)
      continue
    }
    hoursLeft += leftHours
    const weekHours = Math.min(leftHours, capacity)
    if (weekHours > 0) {
      thisWeek.push({ ...task, doneHours, leftHours, weekHours })
      capacity -= weekHours
    }
    if (leftHours > weekHours) later.push({ ...task, doneHours, leftHours: leftHours - weekHours })
  }

  const hoursThisWeek = weeklyHours - capacity
  return { thisWeek, later, done, hoursThisWeek, hoursLeft, weeksLeft: Math.ceil(hoursLeft / weeklyHours) }
}

/** 잘못 누른 체크를 되돌린다. 그 일의 마지막 기록만 지운다. */
export function undoLastCompletion(completions: readonly Completion[], key: string): Completion[] {
  const index = completions.findLastIndex((record) => record.key === key)
  return index === -1 ? [...completions] : completions.filter((_, position) => position !== index)
}
