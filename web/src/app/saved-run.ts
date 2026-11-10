import type { Run } from '../shared/types.ts'

const RUN_KEY = 'jobmap-run'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === 'string'
const isVerdict = (value: unknown) => value === 'met' || value === 'partial' || value === 'unmet'
const isOptional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value)
const isArrayOf = (value: unknown, check: (item: unknown) => boolean) => Array.isArray(value) && value.every(check)

function isOption(value: unknown): boolean {
  return (
    isObject(value) &&
    isString(value.label) &&
    isString(value.description) &&
    (value.lane === 'study' || value.lane === 'project') &&
    typeof value.hours === 'number' &&
    typeof value.recommended === 'boolean'
  )
}

function isGap(value: unknown): boolean {
  return isObject(value) && isString(value.requirement) && isVerdict(value.verdict)
}

function isDirection(value: unknown): boolean {
  return isGap(value) && typeof (value as Record<string, unknown>).gapNumber === 'number' && isArrayOf((value as Record<string, unknown>).options, isOption)
}

function isDirectionsRun(value: unknown): boolean {
  return isObject(value) && isArrayOf(value.gaps, isGap) && isArrayOf(value.directions, isDirection) && isArrayOf(value.picks, isString)
}

function isRun(value: unknown): value is Run {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.posting) &&
    isString(value.resume) &&
    isObject(value.edits) &&
    Object.values(value.edits).every(isVerdict) &&
    isOptional(value.stage, (stage) => stage === 'directions' || stage === 'plan') &&
    isOptional(value.directions, isDirectionsRun) &&
    isOptional(value.weeklyHours, (hours) => typeof hours === 'number') &&
    isOptional(value.doneTasks, (tasks) => isArrayOf(tasks, isString)) &&
    isOptional(value.retries, (retries) => typeof retries === 'number')
  )
}

/** 저장된 글을 믿지 않고 형식을 확인한다. 틀리면 첫 화면에서 다시 시작한다. */
export function parseSavedRun(saved: string | null): Run | null {
  if (saved === null) return null
  try {
    const value: unknown = JSON.parse(saved)
    return isRun(value) ? value : null
  } catch {
    return null
  }
}

export function loadRun(): Run | null {
  try {
    return parseSavedRun(localStorage.getItem(RUN_KEY))
  } catch {
    return null
  }
}

export function saveRun(run: Run | null) {
  try {
    if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run))
    else localStorage.removeItem(RUN_KEY)
  } catch {
    // 저장이 막힌 브라우저에서도 지금 화면은 계속 쓸 수 있다.
  }
}
