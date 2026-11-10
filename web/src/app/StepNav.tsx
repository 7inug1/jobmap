import { Link } from 'react-router'
import type { Run } from '../shared/types.ts'
import { guardStep, runPath, type Step } from './runs.ts'

const STEPS: { label: string; step: Step }[] = [
  { label: '비교 결과', step: undefined },
  { label: '방법 고르기', step: 'directions' },
  { label: '이력서 문장', step: 'resume' },
  { label: '이번 주 할 일', step: 'plan' },
]

/** 비교, 방향, 이번 주 할 일 중 어디에 있는지 보여 준다. 이미 갈 수 있는 단계만 눌러 이동할 수 있다. */
export function StepNav({ run, step, onRemove }: { run: Run; step: Step; onRemove: () => void }) {
  return (
    <div className="step-nav">
      <ol className="stepper" aria-label="진행 단계">
        {STEPS.map((item, index) => {
          const current = item.step === step
          const reachable = !current && (item.step === undefined ? run.rows !== undefined : guardStep(run, item.step) === null)
          return (
            <li key={item.label} className={current ? 'is-now' : undefined}>
              <span className="n" aria-hidden="true">
                {index + 1}
              </span>
              {reachable ? <Link to={runPath(run.id, item.step)}>{item.label}</Link> : <span aria-current={current ? 'step' : undefined}>{item.label}</span>}
            </li>
          )
        })}
      </ol>
      <button className="link-button" type="button" onClick={onRemove}>
        이 기록을 지울게요
      </button>
    </div>
  )
}
