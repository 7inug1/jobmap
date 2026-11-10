import { useEffect, useState } from 'react'
import type { Gap, Run, Verdict } from '../../shared/types.ts'
import { ProgressSteps, type Step } from '../../shared/ProgressSteps.tsx'
import { applyEdits, requirementLabel, type ComparisonView } from './comparison.ts'
import { Failed } from './Failed.tsx'
import { Result } from './Result.tsx'
import { VERDICTS } from './verdicts.ts'

// 실제 실행이 끝난 시간을 재서 정한 값이 아니다. 측정 뒤 고친다.
const SLOW_AFTER_MS = 90_000

export function Comparison({
  run,
  view,
  checking,
  onChange,
  onVerdict,
  onNext,
  onRestart,
}: {
  run: Run
  view: ComparisonView
  checking: boolean
  onChange: (run: Run) => void
  onVerdict: (index: number, verdict: Verdict) => void
  onNext: (gaps: Gap[]) => Promise<void>
  onRestart: () => void
}) {
  if (view.phase === 'working') return <Working run={run} view={view} checking={checking} onRestart={onRestart} />
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

function Working({
  run,
  view,
  checking,
  onRestart,
}: {
  run: Run
  view: Extract<ComparisonView, { phase: 'working' }>
  checking: boolean
  onRestart: () => void
}) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const { rows, retries, answered } = view
  const steps: Step[] = [
    { label: `이력서에서 글자 ${run.resume.length.toLocaleString('ko-KR')}자를 읽었어요.`, state: 'done' },
    { label: `공고 본문 ${run.posting.length.toLocaleString('ko-KR')}자를 읽고 지원 요건이 들어 있는 것을 확인했어요.`, state: 'done' },
  ]
  if (retries > 0) {
    steps.push({ label: `근거가 원문과 다른 줄이 있어서 AI에게 다시 쓰게 했어요. (${retries}번째)`, state: 'done' })
  }
  steps.push(
    answered
      ? { label: `AI가 요건 ${rows.length}개를 비교했어요.`, state: 'done' }
      : rows.length === 0
        ? { label: 'AI가 공고에서 요건을 찾고 있어요.', state: 'on' }
        : { label: `AI가 요건을 하나씩 비교하고 있어요. 지금까지 ${rows.length}개를 비교했어요.`, state: 'on' },
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
      {/* 앞의 두 단계(이력서, 공고)는 입력 화면의 진행 표시에서 이미 보여 줬다. */}
      <ProgressSteps steps={steps} startRevealed={2} />
      {rows.length > 0 ? (
        <section className="draft-rows" aria-label="지금까지 비교한 요건">
          <p className="small">근거를 확인하기 전의 판단이에요. 확인이 끝나면 바뀔 수 있어요.</p>
          <ul>
            {rows.map((row, index) => {
              const verdict = VERDICTS.find(({ value }) => value === row.verdict)!
              return (
                <li className="draft-row" key={index}>
                  <span className={`pill ${verdict.className}`}>{verdict.label}</span>
                  <span>{requirementLabel(row)}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
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
