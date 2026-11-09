import { pickKey } from '../../shared/pick-key.ts'
import type { Direction, DirectionOption } from '../../shared/types.ts'

// 서비스의 기본 약속. 이번 주 할 일 화면에서 바꿀 수 있다.
export const DEFAULT_WEEKLY_HOURS = 3

export type WeekTask = DirectionOption & { key: string; requirement: string }

/** 고른 일을 일주일 시간에 맞춰 나눈다. 일이 일주일보다 커도 이번 주에 하나는 정한다. */
export function buildWeekPlan(
  directions: readonly Direction[],
  picks: readonly string[],
  doneKeys: readonly string[],
  weeklyHours: number,
) {
  const tasks: WeekTask[] = directions.flatMap(({ gapNumber, requirement, options }) =>
    options.flatMap((option, index) => {
      const key = pickKey(gapNumber, index)
      return picks.includes(key) ? [{ ...option, key, requirement }] : []
    }),
  )
  const done = tasks.filter(({ key }) => doneKeys.includes(key))
  const open = tasks.filter(({ key }) => !doneKeys.includes(key))

  const thisWeek: WeekTask[] = []
  let hoursThisWeek = 0
  for (const task of open) {
    if (thisWeek.length > 0 && hoursThisWeek + task.hours > weeklyHours) break
    thisWeek.push(task)
    hoursThisWeek += task.hours
  }

  const hoursLeft = open.reduce((total, task) => total + task.hours, 0)
  return {
    thisWeek,
    later: open.slice(thisWeek.length),
    done,
    hoursThisWeek,
    hoursLeft,
    weeksLeft: Math.ceil(hoursLeft / weeklyHours),
  }
}
