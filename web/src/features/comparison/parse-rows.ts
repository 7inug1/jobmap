import type { Row } from '../../shared/types.ts'

const VERDICTS = new Set(['met', 'partial', 'unmet'])

function toRow(value: unknown): Row | null {
  if (typeof value !== 'object' || value === null) return null
  const { requirement, verdict, postingQuote, resumeQuote } = value as Record<string, unknown>
  const valid =
    typeof requirement === 'string' &&
    typeof verdict === 'string' &&
    VERDICTS.has(verdict) &&
    typeof postingQuote === 'string' &&
    (resumeQuote === null || typeof resumeQuote === 'string')
  return valid ? { requirement, verdict: verdict as Row['verdict'], postingQuote, resumeQuote: resumeQuote as string | null } : null
}

/**
 * AI가 한 줄에 하나씩 쓴 판단을 읽는다. 쓰는 중에는 마지막 줄이 덜 끝났을 수 있어 읽지 않는다.
 * 코드 블록 표시, 설명 문장, 깨진 줄은 건너뛴다. 근거가 맞는지는 서버 검사에서 따로 본다.
 */
export function parseRows(text: string, { streaming }: { streaming: boolean }): Row[] {
  const lines = text.split('\n')
  const finished = streaming ? lines.slice(0, -1) : lines
  return finished.flatMap((line) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) return []
    try {
      const row = toRow(JSON.parse(trimmed))
      return row ? [row] : []
    } catch {
      return []
    }
  })
}
