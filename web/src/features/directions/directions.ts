import { pickKey } from '../../shared/pick-key.ts'
import type { Direction, DirectionOption } from '../../shared/types.ts'

export function recommendedPicks(directions: readonly Direction[]): string[] {
  return directions.map(({ gapNumber, options }) => pickKey(gapNumber, options.findIndex((option) => option.recommended)))
}

export function summarizePicks(directions: readonly Direction[], picks: readonly string[], weeklyHours: number) {
  const picked = directions.flatMap(({ gapNumber, options }) =>
    options.filter((_, index) => picks.includes(pickKey(gapNumber, index))),
  )
  const hoursOf = (lane: DirectionOption['lane']) =>
    picked.filter((option) => option.lane === lane).reduce((total, option) => total + option.hours, 0)
  const studyHours = hoursOf('study')
  const projectHours = hoursOf('project')
  return { studyHours, projectHours, weeks: Math.ceil((studyHours + projectHours) / weeklyHours) }
}
