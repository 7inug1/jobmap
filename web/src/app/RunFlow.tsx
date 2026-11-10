import { useFlueAgent } from '@flue/react'
import { Comparison } from '../features/comparison/Comparison.tsx'
import { readComparison, sameGaps } from '../features/comparison/comparison.ts'
import { DirectionPicker } from '../features/directions/DirectionPicker.tsx'
import { fetchDirections } from '../features/directions/fetch-directions.ts'
import { DEFAULT_WEEKLY_HOURS } from '../features/week-plan/week-plan.ts'
import { WeekPlan } from '../features/week-plan/WeekPlan.tsx'
import type { Completion, Gap, Run } from '../shared/types.ts'

/** 예전 기록의 끝낸 일은 전체 시간을 해낸 것으로 본다. 시간은 계산에서 일의 시간으로 줄어든다. */
function completionsOf(run: Run): Completion[] {
  return run.completions ?? (run.doneTasks ?? []).map((key) => ({ key, hours: Number.MAX_SAFE_INTEGER }))
}

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
    if (run.directions && sameGaps(run.directions.gaps, gaps)) {
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
        completions={completionsOf(run)}
        weeklyHours={run.weeklyHours ?? DEFAULT_WEEKLY_HOURS}
        onCompletions={(completions) => onChange({ ...run, completions, doneTasks: undefined })}
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
