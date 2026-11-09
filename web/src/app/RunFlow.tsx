import { useFlueAgent } from '@flue/react'
import { Comparison } from '../features/comparison/Comparison.tsx'
import { readComparison } from '../features/comparison/comparison.ts'
import { DirectionPicker } from '../features/directions/DirectionPicker.tsx'
import { fetchDirections } from '../features/directions/fetch-directions.ts'
import { DEFAULT_WEEKLY_HOURS } from '../features/week-plan/week-plan.ts'
import { WeekPlan } from '../features/week-plan/WeekPlan.tsx'
import type { Gap, Run } from '../shared/types.ts'

export function RunFlow({
  run,
  onChange,
  onRestart,
}: {
  run: Run
  onChange: (run: Run) => void
  onRestart: () => void
}) {
  const agent = useFlueAgent({ url: `/agents/jobmap/${run.id}` })
  const view = readComparison(agent.messages, agent.settlements, agent.status)

  async function openDirections(gaps: Gap[]) {
    if (run.directions && JSON.stringify(run.directions.gaps) === JSON.stringify(gaps)) {
      onChange({ ...run, stage: 'directions' })
      return
    }
    const directions = await fetchDirections(gaps, run.resume)
    onChange({ ...run, stage: 'directions', directions: { gaps, directions, picks: [] } })
  }

  if (run.stage === 'plan' && run.directions) {
    return (
      <WeekPlan
        directions={run.directions.directions}
        picks={run.directions.picks}
        doneKeys={run.doneTasks ?? []}
        weeklyHours={run.weeklyHours ?? DEFAULT_WEEKLY_HOURS}
        onDone={(doneTasks) => onChange({ ...run, doneTasks })}
        onWeeklyHours={(weeklyHours) => onChange({ ...run, weeklyHours })}
        onBack={() => onChange({ ...run, stage: 'directions' })}
        onRestart={onRestart}
      />
    )
  }
  if (run.stage === 'directions' && run.directions) {
    const saved = run.directions
    return (
      <DirectionPicker
        directions={saved.directions}
        picks={saved.picks}
        weeklyHours={run.weeklyHours ?? DEFAULT_WEEKLY_HOURS}
        onPicks={(picks) => onChange({ ...run, directions: { ...saved, picks } })}
        onConfirm={() => onChange({ ...run, stage: 'plan' })}
        onBack={() => onChange({ ...run, stage: undefined })}
      />
    )
  }

  return (
    <Comparison
      run={run}
      view={view}
      onChange={onChange}
      onVerdict={(index, verdict) => onChange({ ...run, edits: { ...run.edits, [index]: verdict } })}
      onNext={openDirections}
      onRestart={onRestart}
    />
  )
}
