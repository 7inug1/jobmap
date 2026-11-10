import { useEffect, useState } from 'react'
import type { Gap, Run, Verdict } from '../../shared/types.ts'
import { applyEdits, type ComparisonView } from './comparison.ts'
import { Failed } from './Failed.tsx'
import { Result } from './Result.tsx'

// 실제 실행이 끝난 시간을 재서 정한 값이 아니다. 측정 뒤 고친다.
const SLOW_AFTER_MS = 90_000

export function Comparison({
  run,
  view,
  onChange,
  onVerdict,
  onNext,
  onRestart,
}: {
  run: Run
  view: ComparisonView
  onChange: (run: Run) => void
  onVerdict: (index: number, verdict: Verdict) => void
  onNext: (gaps: Gap[]) => Promise<void>
  onRestart: () => void
}) {
  if (view.phase === 'working') return <Working step={view.step} onRestart={onRestart} />
  if (view.phase === 'failed') return <Failed run={run} reason={view.reason} onChange={onChange} onRestart={onRestart} />

  return (
    <Result
      posting={run.posting}
      rows={applyEdits(view.rows, run.edits)}
      onVerdict={onVerdict}
      onNext={onNext}
      savedDirections={run.directions}
      onRestart={onRestart}
    />
  )
}

function Working({ step, onRestart }: { step: string | null; onRestart: () => void }) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <div className="head">
        <h1>이력서와 공고를 비교하고 있어요</h1>
      </div>
      <div className="work-steps" role="status">
        <div className={`work-step ${step ? 'done' : 'on'}`}>
          <span className="icon">{step ? '✓' : <span className="dot" />}</span>
          <b>요건별로 이력서 살펴보기</b>
        </div>
        <div className={`work-step ${step ? 'on' : ''}`}>
          <span className="icon">{step ? <span className="dot" /> : null}</span>
          <b>근거 문장이 원문에 있는지 확인하기</b>
        </div>
      </div>
      {slow ? <p className="lead-line">평소보다 오래 걸리고 있어요. 조금 더 기다리거나 처음으로 돌아가 다시 시작해 주세요.</p> : null}
      <div className="actions-row">
        <button className="btn-line" type="button" onClick={onRestart}>
          처음으로 돌아가기
        </button>
      </div>
    </>
  )
}
