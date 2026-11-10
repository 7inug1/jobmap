import { useFlueAgent } from '@flue/react'
import { createFlueClient } from '@flue/sdk'
import { useEffect, useRef, useState } from 'react'
import { checkComparison, fixRequest } from '../features/comparison/check-comparison.ts'
import { Comparison } from '../features/comparison/Comparison.tsx'
import { readComparison, sameGaps, type ComparisonView } from '../features/comparison/comparison.ts'
import { DirectionPicker } from '../features/directions/DirectionPicker.tsx'
import { fetchDirections } from '../features/directions/fetch-directions.ts'
import { DEFAULT_WEEKLY_HOURS } from '../features/week-plan/week-plan.ts'
import { WeekPlan } from '../features/week-plan/WeekPlan.tsx'
import type { Completion, Gap, Run } from '../shared/types.ts'

/** 예전 기록의 끝낸 일은 전체 시간을 해낸 것으로 본다. 시간은 계산에서 일의 시간으로 줄어든다. */
function completionsOf(run: Run): Completion[] {
  return run.completions ?? (run.doneTasks ?? []).map((key) => ({ key, hours: Number.MAX_SAFE_INTEGER }))
}

// 근거가 틀렸을 때 AI에게 고쳐 달라고 보내는 최대 횟수. 예전 도구 방식의 재시도 횟수와 같다.
const MAX_FIX_REQUESTS = 2

export function RunFlow({
  run,
  onChange,
  onRestart,
}: {
  run: Run
  onChange: (run: Run) => void
  onRestart: () => void
}) {
  const agent = useFlueAgent({ url: `/agents/jobmap/${run.id}`, live: 'sse' })
  const streamed = readComparison(agent.messages, agent.settlements, agent.status)
  const [checkState, setCheckState] = useState<'idle' | 'checking' | 'failed'>('idle')
  const checkedAttempt = useRef<number | null>(null)

  // AI 응답이 끝나면 서버에서 근거를 검사한다. 틀린 줄이 있으면 같은 대화에 고쳐 달라고 보내고, 정한 횟수를 넘으면 실패로 본다.
  useEffect(() => {
    if (run.rows || streamed.phase !== 'working' || !streamed.answered) return
    if (checkedAttempt.current === streamed.retries) return
    checkedAttempt.current = streamed.retries
    setCheckState('checking')
    checkComparison({ posting: run.posting, resume: run.resume, rows: streamed.rows })
      .then(async (result) => {
        if (result.ok) {
          onChange({ ...run, rows: result.rows })
          return
        }
        if (streamed.retries >= MAX_FIX_REQUESTS) {
          setCheckState('failed')
          return
        }
        const client = createFlueClient({ url: new URL(`/agents/jobmap/${run.id}`, location.origin).href })
        await client.send({ message: { kind: 'user', body: fixRequest(result.issues) } })
        setCheckState('idle')
      })
      .catch(() => setCheckState('failed'))
  }, [run, streamed, onChange])

  const view: ComparisonView = run.rows
    ? { phase: 'done', rows: run.rows }
    : checkState === 'failed'
      ? { phase: 'failed', reason: 'evidence' }
      : streamed

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
      checking={checkState === 'checking'}
      onChange={onChange}
      onVerdict={(index, verdict) => onChange({ ...run, edits: { ...run.edits, [index]: verdict } })}
      onNext={openDirections}
      onRestart={onRestart}
    />
  )
}
