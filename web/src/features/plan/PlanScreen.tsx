import { useState } from 'react'
import { Link } from 'react-router'
import type { Run, SentenceItem } from '../../shared/types.ts'
import { FillCard } from '../resume/FillCard.tsx'
import { readyToFill } from '../resume/sentences.ts'
import { dateLabel, formatDuration, isoDate, monthCells, remainingWeeks, thisWeekTasks, toggleTask, type PlanTask } from './plan.ts'

const WEEKLY_HOUR_CHOICES = [1, 2, 3, 5, 8, 10, 15, 20]

const laneTag = (task: PlanTask) => (task.lane === 'know' ? <span className="tag-know">지식</span> : <span className="tag-resume">이력서</span>)

/** 이번 주 할 일. 할 일마다 날짜를 적고, 달력으로 보고, 끝내면 체크한다. 걸리는 시간은 보여 주지 않고 전체 기간만 몇 개월 몇 주로 알려 준다. */
export function PlanScreen({
  run,
  tasks,
  weeklyHours,
  skippedNames,
  remainingCount,
  resumeHref,
  onChange,
  onBack,
  onAnother,
}: {
  run: Run
  tasks: PlanTask[]
  weeklyHours: number
  skippedNames: string[]
  remainingCount: number
  resumeHref: string | undefined
  onChange: (run: Run) => void
  onBack: () => void
  onAnother: () => void
}) {
  const schedule = run.schedule ?? {}
  // 오늘 날짜는 화면을 그릴 때마다 바뀌지 않도록 처음 한 번만 정한다.
  const [today] = useState(() => isoDate(new Date()))
  const weeks = remainingWeeks(tasks, weeklyHours)
  const week = thisWeekTasks(tasks, weeklyHours)
  const doneCount = tasks.filter(({ done }) => done).length
  const next = tasks.filter((task) => !task.done && !week.includes(task))
  const finished = tasks.length > 0 && weeks === 0

  const nextDate = Object.entries(schedule)
    .filter(([key, date]) => date >= today && tasks.some((task) => task.key === key))
    .map(([, date]) => date)
    .sort()[0]
  const [selected, setSelected] = useState(nextDate ?? today)
  const [month, setMonth] = useState(() => {
    const [year, m] = (nextDate ?? today).split('-').map(Number) as [number, number]
    return { year, month: m - 1 }
  })
  const [confirmingBack, setConfirmingBack] = useState(false)

  const setDate = (task: PlanTask, date: string) => {
    const rest = Object.fromEntries(Object.entries(schedule).filter(([key]) => key !== task.key))
    onChange({ ...run, schedule: date === '' ? rest : { ...rest, [task.key]: date } })
  }

  const readyItems: SentenceItem[] = (run.sentences?.items ?? []).filter(readyToFill)
  const fill = (item: SentenceItem, answers: Record<string, string>) =>
    onChange({ ...run, sentences: { ...run.sentences!, items: run.sentences!.items.map((other) => (other.key === item.key ? { ...other, answers, done: true } : other)) } })

  const row = (task: PlanTask) => (
    <li className={`plan-row${task.done ? ' done' : ''}`} key={task.key}>
      <label className="plan-main">
        <input type="checkbox" checked={task.done} onChange={() => onChange(toggleTask(run, task))} aria-label={`${task.title} 끝냈어요`} />
        <span className="plan-title">
          {laneTag(task)}
          <span className="plan-text">{task.title}</span>
          <span className="small">{task.groupTitle}</span>
        </span>
      </label>
      <label className="plan-date">
        <span className="small">언제쯤 할까요</span>
        <input type="date" min={today} value={schedule[task.key] ?? ''} onChange={(event) => setDate(task, event.target.value)} />
      </label>
    </li>
  )

  const cells = monthCells(month.year, month.month)
  const iso = (day: number) => `${month.year}-${String(month.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const onDay = (date: string) => tasks.filter((task) => schedule[task.key] === date)
  const moveMonth = (by: number) => {
    const moved = new Date(month.year, month.month + by, 1)
    setMonth({ year: moved.getFullYear(), month: moved.getMonth() })
  }

  if (tasks.length === 0) {
    return (
      <>
        <div className="head">
          <h1>아직 고른 방법이 없어요</h1>
          <span className="lead-line">방법을 고르면 이번 주에 할 일을 정해 드려요.</span>
        </div>
        <div className="actions-row">
          <button className="btn" type="button" onClick={onBack}>
            방향을 고르러 갈게요
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="head">
        <h1>{finished ? '고른 일을 모두 끝냈어요' : '이번 주에는 이것만 하면 돼요'}</h1>
        <span className="lead-line">
          {finished ? '수고했어요. 이제 지원해 봐도 좋아요.' : '날짜를 적어 두면 시작하기 쉬워져요. 안 지켜도 괜찮고, 언제든 바꿀 수 있어요.'}
        </span>
      </div>

      <section className="plan-summary" aria-label="계획 요약">
        <label>
          <span className="small">일주일에 쓸 수 있는 시간</span>
          <select value={weeklyHours} onChange={(event) => onChange({ ...run, weeklyHours: Number(event.target.value) })}>
            {WEEKLY_HOUR_CHOICES.map((hours) => (
              <option key={hours} value={hours}>
                {hours}시간
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="small">전부 끝내기까지 최소</span>
          <b>{formatDuration(weeks)}</b>
        </div>
        <div>
          <span className="small">끝낸 일</span>
          <b>
            {doneCount} / {tasks.length}개
          </b>
        </div>
      </section>

      {readyItems.map((item) => (
        <FillCard key={item.key} item={item} onFill={(answers) => fill(item, answers)} />
      ))}

      {finished ? null : (
        <section className="task-section" aria-labelledby="week-title">
          <h2 id="week-title">이번 주 할 일 {week.length}개</h2>
          <ul className="task-list">{week.map(row)}</ul>
        </section>
      )}

      <section className="calendar" aria-label="달력">
        <div className="cal-head">
          <button className="icon-mini" type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}>
            ‹
          </button>
          <b>
            {month.year}년 {month.month + 1}월
          </b>
          <button className="icon-mini" type="button" aria-label="다음 달" onClick={() => moveMonth(1)}>
            ›
          </button>
        </div>
        <div className="cal-grid cal-week">
          {['일', '월', '화', '수', '목', '금', '토'].map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((day, index) => {
            if (day === null) return <div className="cal-cell blank" key={`blank-${index}`} />
            const date = iso(day)
            const list = onDay(date)
            return (
              <button
                key={date}
                type="button"
                className={`cal-cell${date === today ? ' today' : ''}${date === selected ? ' picked' : ''}`}
                aria-pressed={date === selected}
                aria-label={`${dateLabel(date)}, 할 일 ${list.length}개`}
                onClick={() => setSelected(date)}
              >
                <span className="cal-num">{day}</span>
                {list.slice(0, 2).map((task) => (
                  <span className={`cal-item ${task.lane}${task.done ? ' done' : ''}`} key={task.key}>
                    {task.title}
                  </span>
                ))}
                {list.length > 2 ? <span className="small">+{list.length - 2}개</span> : null}
              </button>
            )
          })}
        </div>
        <div className="day-list">
          <h3>{dateLabel(selected)} 할 일</h3>
          {onDay(selected).length > 0 ? <ul className="task-list">{onDay(selected).map(row)}</ul> : <p className="small">이 날에 적어 둔 일이 없어요.</p>}
        </div>
      </section>

      {next.length > 0 ? (
        <details className="fold" open>
          <summary>다음에 할 일 {next.length}개</summary>
          <ul className="task-list">{next.map(row)}</ul>
        </details>
      ) : null}
      {doneCount > 0 ? (
        <details className="fold">
          <summary>끝낸 일 {doneCount}개</summary>
          <ul className="task-list">{tasks.filter(({ done }) => done).map(row)}</ul>
        </details>
      ) : null}
      {skippedNames.length > 0 || remainingCount > 0 ? (
        <details className="fold">
          <summary>지금은 안 해도 돼요</summary>
          <div className="fold-body">
            {remainingCount > 0 ? <p className="small">아직 방법을 보지 않은 요건이 {remainingCount}개 있어요. 방향을 다시 고르는 화면에서 이어서 볼 수 있어요.</p> : null}
            {skippedNames.map((name) => (
              <p className="small" key={name}>
                나에게 해당하지 않아 뺀 요건: {name}
              </p>
            ))}
          </div>
        </details>
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
        <button className="btn-line" type="button" onClick={() => (confirmingBack ? onAnother() : setConfirmingBack(true))}>
          {confirmingBack ? '정말 다른 공고로 비교할게요' : '다른 공고로 비교할게요'}
        </button>
      </div>
    </>
  )
}
