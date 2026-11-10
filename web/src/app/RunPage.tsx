import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { guardStep, type Step } from './runs.ts'
import { RunFlow } from './RunFlow.tsx'
import { useRuns } from './runs-context.ts'
import { StepNav } from './StepNav.tsx'

/** /runs/:id, /runs/:id/directions, /runs/:id/plan. 아직 갈 수 없는 단계의 주소로 들어오면 갈 수 있는 단계로 보낸다. */
export function RunPage({ step }: { step: Step }) {
  const { id } = useParams()
  const { runs, remove } = useRuns()
  const navigate = useNavigate()
  const run = runs.find((saved) => saved.id === id)

  if (!run) {
    return (
      <>
        <div className="head">
          <h1>이 비교 기록을 찾을 수 없어요</h1>
          <span className="lead-line">기록은 만든 브라우저에만 저장돼요. 지웠거나 다른 브라우저에서 열었다면 볼 수 없어요.</span>
        </div>
        <div className="actions-row">
          <Link className="btn" to="/history">
            내 기록을 볼게요
          </Link>
          <Link className="btn-line" to="/">
            처음 화면으로 갈게요
          </Link>
        </div>
      </>
    )
  }

  const redirect = guardStep(run, step)
  if (redirect) return <Navigate to={redirect} replace />

  return (
    <>
      <StepNav
        run={run}
        step={step}
        onRemove={() => {
          remove(run.id)
          navigate('/history')
        }}
      />
      <RunFlow key={run.id} run={run} step={step} />
    </>
  )
}
