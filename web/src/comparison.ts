export type Verdict = 'met' | 'partial' | 'unmet'

export type Row = {
  requirement: string
  verdict: Verdict
  postingQuote: string
  resumeQuote: string | null
}

export type EditedRow = Row & { aiVerdict: Verdict }

export type ComparisonView =
  | { phase: 'working'; step: string | null }
  | { phase: 'done'; rows: Row[] }
  | { phase: 'failed' }

type Part = { type: string; toolName?: string; state?: string; output?: unknown; data?: unknown }

/**
 * 대화 기록에서 비교 상태를 읽는다.
 * 모델 문장은 깨지거나 틀릴 수 있어 도구 결과와 대화 종료 여부만 본다.
 */
export function readComparison(
  messages: readonly { parts: readonly Part[] }[],
  settlements: readonly unknown[],
  status: string,
): ComparisonView {
  const parts = messages.flatMap((message) => message.parts)

  const saved = parts.findLast(
    (part) => part.type === 'dynamic-tool' && part.toolName === 'save_comparison' && part.state === 'output-available',
  )
  if (saved) return { phase: 'done', rows: (saved.output as { rows: Row[] }).rows }

  if (settlements.length > 0 || status === 'error') return { phase: 'failed' }

  const progress = parts.findLast((part) => part.type === 'data-progress')
  return { phase: 'working', step: progress ? (progress.data as { step: string }).step : null }
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
