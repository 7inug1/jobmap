import { Link } from 'react-router'
import type { Completion, Direction } from '../../shared/types.ts'
import { buildWeekPlan, undoLastCompletion, type PlanItem, type WeekTask } from './week-plan.ts'

const WEEKLY_HOUR_CHOICES = [1, 2, 3, 5, 8, 10, 15, 20]

const laneName = (task: WeekTask) => (task.lane === 'study' ? '공부' : '프로젝트')

export function WeekPlan({
  directions,
  picks,
  completions,
  weeklyHours,
  remainingCount,
  resumeHref,
  onCompletions,
  onWeeklyHours,
  onBack,
  onRestart,
}: {
  directions: Direction[]
  picks: string[]
  completions: Completion[]
  weeklyHours: number
  remainingCount: number
  resumeHref: string | undefined
  onCompletions: (completions: Completion[]) => void
  onWeeklyHours: (hours: number) => void
  onBack: () => void
  onRestart: () => void
}) {
  const { thisWeek, later, done, hoursThisWeek, weeksLeft } = buildWeekPlan(directions, picks, completions, weeklyHours)
  const finished = thisWeek.length === 0

  const body = (task: WeekTask, detail: string) => (
    <div className="task-body">
      <b>{task.label}</b>
      <span className="small">{task.description}</span>
      <span className="small">{detail}</span>
      <span className="small">이 일은 다음 요건을 채워요. {task.requirement}</span>
    </div>
  )

  const weekRow = (item: PlanItem) => {
    const progress = item.hours > item.weekHours! ? ` 전체 ${item.hours}시간 중 ${item.doneHours}시간을 했어요.` : ''
    return (
      <li className="task" key={item.key}>
        <input
          type="checkbox"
          aria-label={`${item.label} 이번 주 분량 완료`}
          checked={false}
          onChange={() => onCompletions([...completions, { key: item.key, hours: item.weekHours! }])}
        />
        {body(item, `이번 주에 ${item.weekHours}시간 할 ${laneName(item)}예요.${progress}`)}
      </li>
    )
  }

  const laterRow = (item: PlanItem) => (
    <li className="task" key={item.key}>
      <span aria-hidden="true" />
      {body(item, `남은 시간은 ${item.leftHours}시간이에요.`)}
    </li>
  )

  const doneRow = (task: WeekTask) => (
    <li className="task done" key={task.key}>
      <input
        type="checkbox"
        aria-label={`${task.label} 완료 취소`}
        checked
        onChange={() => onCompletions(undoLastCompletion(completions, task.key))}
      />
      {body(task, `약 ${task.hours}시간짜리 ${laneName(task)}였어요.`)}
    </li>
  )

  return (
    <>
      <div className="head">
        <h1>{finished ? '고른 일을 모두 끝냈어요' : '이번 주에는 이것만 하면 돼요'}</h1>
        <span className="lead-line">
          {finished ? '수고했어요. 이제 지원해 봐도 좋아요.' : `약 ${hoursThisWeek}시간이에요. 이 속도면 ${weeksLeft}주 뒤에 고른 일을 다 끝내요.`}
        </span>
      </div>
      <label className="hours-field">
        일주일에 쓸 수 있는 시간
        <select value={weeklyHours} onChange={(event) => onWeeklyHours(Number(event.target.value))}>
          {WEEKLY_HOUR_CHOICES.map((hours) => (
            <option key={hours} value={hours}>
              {hours}시간
            </option>
          ))}
        </select>
      </label>
      {finished ? null : <ul className="task-list">{thisWeek.map(weekRow)}</ul>}
      {later.length > 0 ? (
        <section className="task-section">
          <h2>다음에 할 일</h2>
          <ul className="task-list">{later.map(laterRow)}</ul>
        </section>
      ) : null}
      {done.length > 0 ? (
        <section className="task-section">
          <h2>끝낸 일</h2>
          <ul className="task-list">{done.map(doneRow)}</ul>
        </section>
      ) : null}
      {remainingCount > 0 ? (
        <p className="small">아직 방법을 보지 않은 요건이 {remainingCount}개 있어요. 방향을 다시 고르는 화면에서 이어서 볼 수 있어요.</p>
      ) : null}
      <div className="actions-row">
        {resumeHref ? (
          <Link className="btn-line" to={resumeHref}>
            이력서 문장을 볼게요
          </Link>
        ) : null}
        <button className="btn-line" type="button" onClick={onBack}>
          방향을 다시 고를게요
        </button>
        <button className="btn-line" type="button" onClick={onRestart}>
          다른 공고로 비교할게요
        </button>
      </div>
    </>
  )
}
