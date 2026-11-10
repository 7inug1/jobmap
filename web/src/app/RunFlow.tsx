import { useFlueAgent } from '@flue/react'
import { createFlueClient } from '@flue/sdk'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { checkComparison, fixRequest } from '../features/comparison/check-comparison.ts'
import { Comparison } from '../features/comparison/Comparison.tsx'
import { readComparison, sameGaps, type ComparisonView } from '../features/comparison/comparison.ts'
import { DirectionPicker } from '../features/directions/DirectionPicker.tsx'
import { DirectionsLoading } from '../features/directions/DirectionsLoading.tsx'
import { activeDirections, appendDirections, nextBatch, picksWithout, rankGaps, remainingGaps } from '../features/directions/directions.ts'
import { fetchDirections } from '../features/directions/fetch-directions.ts'
import { buildPlanTasks, DEFAULT_WEEKLY_HOURS } from '../features/plan/plan.ts'
import { PlanScreen } from '../features/plan/PlanScreen.tsx'
import { fetchSentences } from '../features/resume/fetch-sentences.ts'
import { ResumeTab } from '../features/resume/ResumeTab.tsx'
import { SentenceFlow } from '../features/resume/SentenceFlow.tsx'
import { SentencesLoading } from '../features/resume/SentencesLoading.tsx'
import { itemKeys, missingPicks, projectPicks, reconcileItems } from '../features/resume/sentences.ts'
import { directionsFailure, sentencesFailure } from '../shared/failure-reasons.ts'
import type { Gap, Run } from '../shared/types.ts'
import { runPath, type Step } from './runs.ts'
import { useRuns } from './runs-context.ts'

// 근거가 틀렸을 때 AI에게 고쳐 달라고 보내는 최대 횟수. 예전 도구 방식의 재시도 횟수와 같다.
const MAX_FIX_REQUESTS = 2

export function RunFlow({ run, step }: { run: Run; step: Step }) {
  const { save: onChange, remove } = useRuns()
  const navigate = useNavigate()
  // 입력을 고치거나 다른 공고로 비교하러 처음 화면으로 갈 때, 앞에서 넣은 내용을 이어서 쓰게 한다.
  const toStart = (keepPosting: boolean) => navigate('/', { state: { draft: { posting: keepPosting ? run.posting : '', resume: run.resume } } })
  const onRestart = () => toStart(true)
  const onAnother = () => toStart(false)
  // 다시 시도하면 새 대화가 시작되므로 실패한 기록은 지우고 새 기록으로 옮겨 간다.
  const onRetried = (next: Run) => {
    onChange(next)
    remove(run.id)
    navigate(runPath(next.id), { replace: true })
  }
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

  // 방법은 한 번에 일부 요건만 받는다. 받은 요건 수(directions.length) 뒤의 요건이 아직 방법을 보지 않은 요건이다.
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreFailure, setMoreFailure] = useState<ReturnType<typeof directionsFailure> | null>(null)
  const [moreFailures, setMoreFailures] = useState(0)

  async function openDirections(gaps: Gap[]) {
    const ranked = rankGaps(gaps)
    if (run.directions && sameGaps(run.directions.gaps, ranked)) {
      navigate(runPath(run.id, 'directions'))
      return
    }
    const directions = await fetchDirections(nextBatch(ranked, 0), run.resume)
    onChange({ ...run, directions: { gaps: ranked, directions, picks: [] } })
    navigate(runPath(run.id, 'directions'))
  }

  const skipped = run.skippedGaps ?? []
  const remaining = run.directions ? remainingGaps(run.directions.gaps, run.directions.directions, skipped) : []

  function skipGap(requirement: string) {
    if (!run.directions) return
    const saved = run.directions
    onChange({
      ...run,
      skippedGaps: [...skipped, requirement],
      directions: { ...saved, picks: picksWithout(saved.directions, saved.picks, requirement) },
    })
  }

  function restoreGap(requirement: string) {
    onChange({ ...run, skippedGaps: skipped.filter((name) => name !== requirement) })
  }

  // 방법을 확정하면 고른 프로젝트마다 이력서에 넣을 문장을 만든다. 공부만 골랐으면 이력서를 바꾸지 않으므로 바로 이번 주 할 일로 간다.
  const [confirmingCount, setConfirmingCount] = useState(0)
  const [confirmFailure, setConfirmFailure] = useState<ReturnType<typeof sentencesFailure> | null>(null)
  const [confirmFailures, setConfirmFailures] = useState(0)

  async function confirmDirections() {
    if (!run.directions) return
    const saved = run.directions
    const picks = projectPicks(activeDirections(saved.directions, skipped), saved.picks)
    const existing = run.sentences?.items ?? []
    if (picks.length === 0) {
      if (run.sentences) onChange({ ...run, sentences: undefined })
      navigate(runPath(run.id, 'plan'))
      return
    }
    const missing = missingPicks(existing, picks)
    if (missing.length === 0) {
      const confirmed = run.sentences?.confirmed ?? false
      onChange({ ...run, sentences: { items: reconcileItems(existing, picks, []), confirmed } })
      navigate(runPath(run.id, confirmed ? 'plan' : 'resume'))
      return
    }
    setConfirmingCount(missing.length)
    setConfirmFailure(null)
    try {
      const generated = await fetchSentences(missing, run.resume)
      onChange({ ...run, sentences: { items: reconcileItems(existing, picks, generated), confirmed: false } })
      navigate(runPath(run.id, 'resume'))
    } catch (error) {
      setConfirmFailures(confirmFailures + 1)
      setConfirmFailure(sentencesFailure(error, confirmFailures + 1))
    } finally {
      setConfirmingCount(0)
    }
  }

  function removeSentence(key: string) {
    if (!run.sentences || !run.directions) return
    const removed = run.sentences.items.find((item) => item.key === key)
    const removedKeys = removed ? itemKeys(removed) : [key]
    onChange({
      ...run,
      sentences: { ...run.sentences, items: run.sentences.items.filter((item) => item.key !== key) },
      directions: { ...run.directions, picks: run.directions.picks.filter((pick) => !removedKeys.includes(pick)) },
    })
  }

  async function loadMoreDirections() {
    if (!run.directions) return
    const saved = run.directions
    setLoadingMore(true)
    setMoreFailure(null)
    try {
      const more = await fetchDirections(nextBatch(remaining, 0), run.resume)
      onChange({ ...run, directions: { ...saved, directions: appendDirections(saved.directions, more) } })
    } catch (error) {
      setMoreFailures(moreFailures + 1)
      setMoreFailure(directionsFailure(error, moreFailures + 1))
    } finally {
      setLoadingMore(false)
    }
  }

  if (confirmingCount > 0) return <SentencesLoading count={confirmingCount} />

  if (step === 'resume' && run.directions && run.sentences) {
    return run.sentences.confirmed ? (
      <ResumeTab run={run} onChange={onChange} planHref={runPath(run.id, 'plan')} />
    ) : (
      <SentenceFlow
        run={run}
        onChange={onChange}
        onRemove={removeSentence}
        onBack={() => navigate(runPath(run.id, 'directions'))}
        onStart={() => {
          onChange({ ...run, sentences: { ...run.sentences!, confirmed: true } })
          navigate(runPath(run.id, 'plan'))
        }}
      />
    )
  }
  if (step === 'plan' && run.directions) {
    return (
      <PlanScreen
        run={run}
        tasks={buildPlanTasks({ ...run, directions: { ...run.directions, directions: activeDirections(run.directions.directions, skipped) } })}
        weeklyHours={run.weeklyHours ?? DEFAULT_WEEKLY_HOURS}
        skippedNames={skipped}
        remainingCount={remaining.length}
        resumeHref={run.sentences ? runPath(run.id, 'resume') : undefined}
        onChange={onChange}
        onBack={() => navigate(runPath(run.id, 'directions'))}
        onAnother={onAnother}
      />
    )
  }
  if (step === 'directions' && run.directions) {
    const saved = run.directions
    if (loadingMore) {
      return <DirectionsLoading batch={nextBatch(remaining, 0).length} total={remaining.length} />
    }
    return (
      <DirectionPicker
        directions={activeDirections(saved.directions, skipped)}
        remaining={remaining}
        skippedNames={skipped}
        onSkip={skipGap}
        onRestore={restoreGap}
        onLoadMore={loadMoreDirections}
        moreFailure={moreFailure}
        picks={saved.picks}
        onPicks={(picks) => onChange({ ...run, directions: { ...saved, picks } })}
        onConfirm={confirmDirections}
        confirmFailure={confirmFailure}
        onBack={() => navigate(runPath(run.id))}
      />
    )
  }

  return (
    <Comparison
      run={run}
      view={view}
      checking={checkState === 'checking'}
      onRetried={onRetried}
      onVerdict={(index, verdict) => onChange({ ...run, edits: { ...run.edits, [index]: verdict } })}
      onNext={openDirections}
      onRestart={onRestart}
      onAnother={onAnother}
    />
  )
}
