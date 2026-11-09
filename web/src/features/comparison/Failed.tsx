import { useState } from 'react'
import { startRun } from '../../shared/start-run.ts'
import type { Run } from '../../shared/types.ts'

export function Failed({
  run,
  onChange,
  onRestart,
}: {
  run: Run
  onChange: (run: Run) => void
  onRestart: () => void
}) {
  const [sending, setSending] = useState(false)

  async function retry() {
    setSending(true)
    try {
      onChange(await startRun(run))
    } catch {
      setSending(false)
    }
  }

  return (
    <>
      <div className="head">
        <h1>비교를 끝내지 못했어요</h1>
        <span className="lead-line">근거 문장을 원문에서 확인하지 못했거나 연결이 끊겼어요.</span>
      </div>
      <div className="actions-row">
        <button className="btn" type="button" disabled={sending} onClick={retry}>
          {sending ? '시작하는 중' : '다시 시도하기'}
        </button>
        <button className="btn-line" type="button" onClick={onRestart}>
          입력 고치기
        </button>
      </div>
    </>
  )
}
