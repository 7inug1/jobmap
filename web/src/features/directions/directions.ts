import { pickKey } from '../../shared/pick-key.ts'
import type { Direction, DirectionOption, Gap } from '../../shared/types.ts'

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

// 한 번에 방법을 보는 요건 수. 전부 보여 주면 방법이 너무 많아 고르기 어렵고 AI 응답도 요건 수만큼 오래 걸린다(13개에서 44~79초).
export const FIRST_BATCH = 5

/** 불충족을 먼저, 일부 충족을 그다음에 둔다. 같은 판단끼리는 공고에 나온 순서를 지킨다. */
export function rankGaps(gaps: readonly Gap[]): Gap[] {
  return [...gaps.filter(({ verdict }) => verdict === 'unmet'), ...gaps.filter(({ verdict }) => verdict === 'partial')]
}

/** 방법을 이미 본 요건(covered개) 다음에서 size개를 고른다. */
export function nextBatch(ranked: readonly Gap[], covered: number, size = FIRST_BATCH): Gap[] {
  return ranked.slice(covered, covered + size)
}

/** 다음 묶음의 요건 번호를 이어서 매겨, 이미 고른 방법의 키(요건 번호:방법 번호)가 바뀌지 않게 한다. */
export function appendDirections(existing: readonly Direction[], incoming: readonly Direction[]): Direction[] {
  return [...existing, ...incoming.map((direction, index) => ({ ...direction, gapNumber: existing.length + index + 1 }))]
}

