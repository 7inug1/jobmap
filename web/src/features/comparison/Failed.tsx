import { useState } from 'react'
import { startRun } from '../../shared/start-run.ts'
import { canRetry, DAILY_LIMIT_DETAIL, FAILURE_COPY, isDailyLimit, RETRIES_USED_UP, type FailureReason } from '../../shared/failure-reasons.ts'
import type { Run } from '../../shared/types.ts'

export function Failed({
  run,
  reason,
  onChange,
  onRestart,
}: {
  run: Run
  reason: FailureReason
  onChange: (run: Run) => void
  onRestart: () => void
}) {
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const retries = run.retries ?? 0
  const retryable = canRetry(reason, retries)
  const { title, detail } = FAILURE_COPY[reason]

  async function retry() {
    setSending(true)
    setSendError(null)
    try {
      onChange({ ...(await startRun({ posting: run.posting, resume: run.resume })), retries: retries + 1 })
    } catch (error) {
      setSendError(isDailyLimit(error) ? DAILY_LIMIT_DETAIL : '다시 시도하지 못했어요. 연결을 확인하고 한 번 더 눌러 주세요.')
      setSending(false)
    }
  }

  return (
    <>
      <div className="head">
        <h1>{title}</h1>
        <span className="lead-line">{detail}</span>
      </div>
      {!retryable && reason !== 'quota' ? <p className="lead-line">{RETRIES_USED_UP}</p> : null}
      {sendError ? (
        <p className="error" role="alert">
          {sendError}
        </p>
      ) : null}
      <div className="actions-row">
        {retryable ? (
          <button className="btn" type="button" disabled={sending} onClick={retry}>
            {sending ? '시작하는 중' : '다시 시도하기'}
          </button>
        ) : null}
        <button className="btn-line" type="button" onClick={onRestart}>
          입력 고치기
        </button>
      </div>
    </>
  )
}
