import type { Direction } from '../../shared/types.ts'
import { buildWeekPlan, type WeekTask } from './week-plan.ts'

const WEEKLY_HOUR_CHOICES = [1, 2, 3, 5, 8, 10, 15, 20]

export function WeekPlan({
  directions,
  picks,
  doneKeys,
  weeklyHours,
  onDone,
  onWeeklyHours,
  onBack,
  onRestart,
}: {
  directions: Direction[]
  picks: string[]
  doneKeys: string[]
  weeklyHours: number
  onDone: (doneKeys: string[]) => void
  onWeeklyHours: (hours: number) => void
  onBack: () => void
  onRestart: () => void
}) {
  const { thisWeek, later, done, hoursThisWeek, weeksLeft } = buildWeekPlan(directions, picks, doneKeys, weeklyHours)
  const toggle = (key: string) => onDone(doneKeys.includes(key) ? doneKeys.filter((item) => item !== key) : [...doneKeys, key])
  const finished = thisWeek.length === 0

  const row = (task: WeekTask, checkable: boolean) => (
    <li className={`task${doneKeys.includes(task.key) ? ' done' : ''}`} key={task.key}>
      {checkable ? (
        <input
          type="checkbox"
          aria-label={`${task.label} 완료`}
          checked={doneKeys.includes(task.key)}
          onChange={() => toggle(task.key)}
        />
      ) : (
        <span aria-hidden="true" />
      )}
      <div className="task-body">
        <b>{task.label}</b>
        <span className="small">{task.description}</span>
        <span className="small">
          {task.lane === 'study' ? '공부' : '프로젝트'}, 약 {task.hours}시간. 채우는 요건: {task.requirement}
        </span>
      </div>
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
      {finished ? null : <ul className="task-list">{thisWeek.map((task) => row(task, true))}</ul>}
      {later.length > 0 ? (
        <section className="task-section">
          <h2>다음에 할 일</h2>
          <ul className="task-list">{later.map((task) => row(task, false))}</ul>
        </section>
      ) : null}
      {done.length > 0 ? (
        <section className="task-section">
          <h2>끝낸 일</h2>
          <ul className="task-list">{done.map((task) => row(task, true))}</ul>
        </section>
      ) : null}
      <div className="actions-row">
        <button className="btn-line" type="button" onClick={onBack}>
          방향 다시 고르기
        </button>
        <button className="btn-line" type="button" onClick={onRestart}>
          다른 공고로 비교하기
        </button>
      </div>
    </>
  )
}
