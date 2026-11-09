import type { Gap, Run, Verdict } from '../../shared/types.ts'
import { applyEdits, type ComparisonView } from './comparison.ts'
import { Failed } from './Failed.tsx'
import { Result } from './Result.tsx'

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
  if (view.phase === 'failed') return <Failed run={run} onChange={onChange} onRestart={onRestart} />

  return (
    <Result
      posting={run.posting}
      rows={applyEdits(view.rows, run.edits)}
      onVerdict={onVerdict}
      onNext={onNext}
      onRestart={onRestart}
    />
  )
}

function Working({ step, onRestart }: { step: string | null; onRestart: () => void }) {
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
      <div className="actions-row">
        <button className="btn-line" type="button" onClick={onRestart}>
          처음으로 돌아가기
        </button>
      </div>
    </>
  )
}
