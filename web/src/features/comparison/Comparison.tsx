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
  if (view.phase === 'working') return <Working run={run} view={view} onRestart={onRestart} />
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

type StepState = 'done' | 'on' | 'wait'

function Working({ run, view, onRestart }: { run: Run; view: Extract<ComparisonView, { phase: 'working' }>; onRestart: () => void }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const { requirementCount, checking, retries } = view
  const fixing = retries > 0 && !checking
  const steps: { label: string; state: StepState }[] = [
    { label: `이력서에서 글자 ${run.resume.length.toLocaleString('ko-KR')}자를 읽었어요.`, state: 'done' },
    { label: `공고 본문 ${run.posting.length.toLocaleString('ko-KR')}자를 읽었어요.`, state: 'done' },
    requirementCount === null
      ? { label: 'AI가 공고에서 요건을 찾아 이력서와 비교하고 있어요.', state: 'on' }
      : { label: `AI가 요건 ${requirementCount}개를 찾아 이력서와 비교했어요.`, state: 'done' },
  ]
  if (retries > 0) {
    steps.push(
      fixing
        ? { label: `근거 문장이 원문과 달라서 AI가 다시 고치고 있어요. (${retries}번째)`, state: 'on' }
        : { label: `원문과 다른 근거 문장을 ${retries}번 고쳤어요.`, state: 'done' },
    )
  }
  steps.push(
    checking
      ? { label: '근거 문장이 이력서와 공고 원문에 실제로 있는지 확인하고 있어요.', state: 'on' }
      : { label: '근거 문장이 이력서와 공고 원문에 실제로 있는지 확인할게요.', state: 'wait' },
    { label: '확인이 끝나면 요건별 비교 결과를 보여 드릴게요.', state: 'wait' },
  )

  return (
    <>
      <div className="head">
        <h1>이력서와 공고를 비교하고 있어요</h1>
        <span className="lead-line">시작한 지 {seconds}초 지났어요.</span>
      </div>
      <ol className="work-steps" role="status" aria-live="polite">
        {steps.map(({ label, state }) => (
          <li className={`work-step ${state}`} key={label}>
            <span className="icon" aria-hidden="true">
              {state === 'done' ? '✓' : state === 'on' ? <span className="dot" /> : null}
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ol>
      {seconds >= SLOW_AFTER_MS / 1000 ? (
        <p className="lead-line">평소보다 오래 걸리고 있어요. 조금 더 기다리거나 처음으로 돌아가 다시 시작해 주세요.</p>
      ) : null}
      <div className="actions-row">
        <button className="btn-line" type="button" onClick={onRestart}>
          처음 화면으로 돌아갈게요
        </button>
      </div>
    </>
  )
}
