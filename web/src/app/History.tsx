import { useState } from 'react'
import { Link } from 'react-router'
import { runPath, summarizeRun, type Progress } from './runs.ts'
import { useRuns } from './runs-context.ts'

const PROGRESS_TEXT: Record<Progress, string> = {
  compare: '비교까지 했어요.',
  directions: '채울 방법을 고르는 중이에요.',
  plan: '이번 주 할 일까지 정했어요.',
}

const PROGRESS_STEP = { compare: undefined, directions: 'directions', plan: 'plan' } as const

function formatDate(time: number | undefined): string {
  if (time === undefined) return '날짜를 알 수 없어요'
  return new Date(time).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** /history. 비교를 끝낸 기록 목록. 이 브라우저에만 저장된다. */
export function History() {
  const { runs, remove } = useRuns()
  const [confirming, setConfirming] = useState<string | null>(null)
  const done = runs.filter((run) => run.rows !== undefined)

  return (
    <>
      <div className="head">
        <h1>내 비교 기록</h1>
        <span className="lead-line">비교를 끝낸 공고가 여기에 쌓여요. 눌러서 이어서 볼 수 있어요.</span>
      </div>
      {done.length === 0 ? (
        <div className="empty">
          <p>아직 비교한 기록이 없어요.</p>
          <Link className="btn" to="/">
            처음 화면에서 시작할게요
          </Link>
        </div>
      ) : (
        <ul className="history-list">
          {done.map((run) => {
            const { title, createdAt, total, met, step } = summarizeRun(run)
            return (
              <li className="history-item" key={run.id}>
                <Link className="history-main" to={runPath(run.id, PROGRESS_STEP[step])}>
                  <b>{title}</b>
                  <span className="small">
                    {formatDate(createdAt)} · 요건 {total}개 중 {met}개를 충족해요. {PROGRESS_TEXT[step]}
                  </span>
                </Link>
                {confirming === run.id ? (
                  <span className="history-confirm">
                    <button className="link-button" type="button" onClick={() => remove(run.id)}>
                      정말 지울게요
                    </button>
                    <button className="link-button" type="button" onClick={() => setConfirming(null)}>
                      그만둘게요
                    </button>
                  </span>
                ) : (
                  <button className="link-button" type="button" onClick={() => setConfirming(run.id)}>
                    이 기록을 지울게요
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="small">이력서와 공고 원문이 이 브라우저에 저장돼요. 공용 컴퓨터에서는 기록을 지우고 나가 주세요.</p>
    </>
  )
}
