export type FailureReason = 'quota' | 'evidence' | 'connection'

const MAX_RETRIES = 2

const QUOTA_DETAIL = 'AI 사용량은 하루 단위로 다시 채워져요. 내일 다시 시도해 주세요.'

export const FAILURE_COPY: Record<FailureReason, { title: string; detail: string }> = {
  quota: { title: '오늘 쓸 수 있는 AI 사용량을 다 썼어요', detail: QUOTA_DETAIL },
  evidence: { title: '비교를 끝내지 못했어요', detail: '근거 문장을 원문에서 확인하지 못했어요.' },
  connection: { title: '비교를 끝내지 못했어요', detail: '서버 연결이 끊겼거나 응답을 받지 못했어요.' },
}

export const DAILY_LIMIT_DETAIL = '오늘 서비스에서 처리할 수 있는 횟수를 다 썼어요. 내일 다시 시도해 주세요.'

export const RETRIES_USED_UP = '여러 번 실패했어요. 입력을 고치거나 잠시 뒤 새로 시작해 주세요.'

/** Workers AI의 일일 무료 한도 오류(4006)인지 본다. */
export function isQuotaError(error: unknown): boolean {
  const text = typeof error === 'string' ? error : error instanceof Error ? error.message : (JSON.stringify(error) ?? '')
  return /\b4006\b|daily free allocation/i.test(text)
}

/** 서버가 서비스 전체 하루 총량을 넘겨 거절했는지 본다. */
export function isDailyLimit(error: unknown): boolean {
  return error instanceof Error && ((error as { status?: unknown }).status === 429 || error.message === 'daily_limit')
}

/** 다시 시도해도 뉴런만 쓰는 경우를 막는다. */
export function canRetry(reason: FailureReason, retries: number): boolean {
  return reason !== 'quota' && retries < MAX_RETRIES
}

/** 채울 방법 제안의 실패 안내. failures는 이번 실패까지 센 횟수다. */
export function directionsFailure(error: unknown, failures: number): { message: string; canRetry: boolean } {
  if (error instanceof Error && error.message === 'quota') return { message: QUOTA_DETAIL, canRetry: false }
  if (isDailyLimit(error)) return { message: DAILY_LIMIT_DETAIL, canRetry: false }
  if (failures > MAX_RETRIES) return { message: RETRIES_USED_UP, canRetry: false }
  return { message: '채울 방법을 정리하지 못했어요. 다시 눌러 주세요.', canRetry: true }
}
