import type { Row } from '../../shared/types.ts'

export type CheckResult = { ok: true; rows: Row[] } | { ok: false; issues: string[] }

/** AI를 부르지 않는 서버 근거 검사. */
export async function checkComparison(input: { posting: string; resume: string; rows: Row[] }): Promise<CheckResult> {
  const response = await fetch('/api/comparison/check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return (await response.json()) as CheckResult
}

/** 검사에서 걸린 줄을 AI에게 고쳐 달라고 보내는 메시지. */
export function fixRequest(issues: readonly string[]): string {
  return `검사 결과 아래 줄이 틀렸습니다. 고친 줄을 포함해 모든 줄을 처음부터 다시 쓰세요.\n${issues.join('\n')}`
}
