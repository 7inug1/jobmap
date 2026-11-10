import { useEffect, useState } from 'react'

export type StepState = 'done' | 'on' | 'wait'
export type Step = { label: string; state: StepState }

// 이미 끝난 단계도 한꺼번에 체크하지 않고 차례로 체크해, 무엇을 거쳤는지 보이게 한다.
const REVEAL_MS = 450

/**
 * 진행 단계 목록. 앞쪽의 끝난 단계는 하나씩 차례로 체크된다.
 * 앞 화면에서 이미 보여 준 단계 수는 startRevealed로 알려 다시 체크하지 않는다.
 */
export function ProgressSteps({ steps, startRevealed = 0 }: { steps: Step[]; startRevealed?: number }) {
  const leadingDone = steps.findIndex(({ state }) => state !== 'done')
  const doneCount = leadingDone === -1 ? steps.length : leadingDone
  const [revealed, setRevealed] = useState(startRevealed)

  useEffect(() => {
    if (revealed >= doneCount) return
    const timer = setTimeout(() => setRevealed((count) => count + 1), REVEAL_MS)
    return () => clearTimeout(timer)
  }, [revealed, doneCount])

  const shown = (index: number, state: StepState): StepState => {
    if (index < revealed) return state
    if (index === revealed) return state === 'wait' ? 'wait' : 'on'
    return 'wait'
  }

  return (
    <ol className="work-steps" role="status" aria-live="polite">
      {steps.map(({ label, state }, index) => {
        const display = shown(index, state)
        return (
          <li className={`work-step ${display}`} key={label}>
            <span className="icon" aria-hidden="true">
              {display === 'done' ? '✓' : display === 'on' ? <span className="dot" /> : null}
            </span>
            <span>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
