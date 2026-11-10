import { isQuotaError, type FailureReason } from '../../shared/failure-reasons.ts'
import { parseRows } from './parse-rows.ts'
import type { DirectionsRun, Gap, Row, Verdict } from '../../shared/types.ts'

export type EditedRow = Row & { aiVerdict: Verdict }

export type ComparisonView =
  | { phase: 'working'; rows: Row[]; retries: number; answered: boolean }
  | { phase: 'done'; rows: Row[] }
  | { phase: 'failed'; reason: FailureReason }

type Settlement = { outcome: string; error?: unknown }
type Part = { type: string; toolName?: string; state?: string; text?: string; output?: unknown }
type Message = { role?: string; parts: readonly Part[] }

/**
 * 대화 기록에서 비교 상태를 읽는다.
 * AI는 판단을 한 줄 JSON 글로 쓰고, 화면은 쓰이는 대로 끝난 줄을 보여 준다. 응답이 끝나면(answered) 서버 검사를 부른다.
 * 근거를 고쳐 달라고 다시 보낸 횟수(retries)는 사용자 메시지 수로 센다.
 */
export function readComparison(messages: readonly Message[], settlements: readonly Settlement[], status: string): ComparisonView {
  const parts = messages.flatMap((message) => message.parts)

  // 도구로 저장하던 예전 기록도 그대로 보여 준다.
  const saved = parts.findLast(
    (part) => part.type === 'dynamic-tool' && part.toolName === 'save_comparison' && part.state === 'output-available',
  )
  if (saved) return { phase: 'done', rows: (saved.output as { rows: Row[] }).rows }

  if (settlements.some(({ error }) => isQuotaError(error))) return { phase: 'failed', reason: 'quota' }
  if (status === 'error' || settlements.some(({ outcome }) => outcome !== 'completed')) return { phase: 'failed', reason: 'connection' }

  const sent = messages.filter(({ role }) => role === 'user').length
  const lastUser = messages.findLastIndex(({ role }) => role === 'user')
  const reply = messages.slice(lastUser + 1).find(({ role }) => role === 'assistant')
  const answered = sent > 0 && settlements.length >= sent && status !== 'streaming' && status !== 'submitted'
  const text = (reply?.parts ?? []).filter((part) => part.type === 'text').map((part) => part.text ?? '').join('')

  return { phase: 'working', rows: parseRows(text, { streaming: !answered }), retries: Math.max(0, sent - 1), answered }
}

export function applyEdits(rows: readonly Row[], edits: Readonly<Record<number, Verdict>>): EditedRow[] {
  return rows.map((row, index) => ({ ...row, verdict: edits[index] ?? row.verdict, aiVerdict: row.verdict }))
}

function normalize(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim()
}

/** 공고를 줄로 나누고, 각 행을 근거 문장이 있는 줄에 붙인다. */
export function annotatePosting(posting: string, rows: readonly Pick<Row, 'postingQuote'>[]) {
  const lines = posting
    .split('\n')
    .filter((text) => text.trim() !== '')
    .map((text) => ({ text, rowIndexes: [] as number[] }))
  const unplaced: number[] = []

  rows.forEach((row, index) => {
    const quote = normalize(row.postingQuote)
    const line = lines.find(({ text }) => normalize(text).includes(quote))
    if (line) line.rowIndexes.push(index)
    else unplaced.push(index)
  })

  return { lines, unplaced }
}

export function gapsFromRows(rows: readonly Row[]): Gap[] {
  return rows.flatMap(({ requirement, verdict }) => (verdict === 'met' ? [] : [{ requirement, verdict }]))
}

export function sameGaps(a: readonly Gap[], b: readonly Gap[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** 판단을 고쳐서 이미 고른 방향이 사라지는 경우를 가려낸다. */
export function directionsWillReset(saved: DirectionsRun | undefined, gaps: readonly Gap[]): boolean {
  return saved !== undefined && saved.picks.length > 0 && !sameGaps(saved.gaps, gaps)
}

/** 요건 이름이 공고 줄을 그대로 옮긴 것이면 같은 문장을 두 번 보여 주지 않는다. */
export function repeatsLine(line: string, requirement: string): boolean {
  return normalize(line).includes(normalize(requirement))
}
