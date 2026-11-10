import { pickKey } from '../../shared/pick-key.ts'
import type { Direction, DirectionOption, Gap } from '../../shared/types.ts'
import { FIRST_BATCH, recommendedPicks, summarizePicks } from './directions.ts'

export function DirectionPicker({
  directions,
  remaining,
  onLoadMore,
  moreFailure,
  picks,
  weeklyHours,
  onPicks,
  onConfirm,
  onBack,
}: {
  directions: Direction[]
  remaining: Gap[]
  onLoadMore: () => void
  moreFailure: { message: string; canRetry: boolean } | null
  picks: string[]
  weeklyHours: number
  onPicks: (picks: string[]) => void
  onConfirm: () => void
  onBack: () => void
}) {
  const { studyHours, projectHours, weeks } = summarizePicks(directions, picks, weeklyHours)
  const toggle = (key: string) => onPicks(picks.includes(key) ? picks.filter((pick) => pick !== key) : [...picks, key])
  const basket = (lane: DirectionOption['lane']) =>
    directions.flatMap(({ gapNumber, options }) =>
      options.flatMap((option, index) => {
        const key = pickKey(gapNumber, index)
        return option.lane === lane && picks.includes(key) ? [{ key, label: option.label }] : []
      }),
    )
  const basketColumn = (lane: DirectionOption['lane'], title: string, empty: string) => (
    <div className="basket-col">
      <span className="tag">{title}</span>
      {basket(lane).map(({ key, label }) => (
        <button key={key} className="basket-item" type="button" aria-label={`${label} 빼기`} onClick={() => toggle(key)}>
          {label} ✕
        </button>
      ))}
      {basket(lane).length === 0 ? <span className="small">{empty}</span> : null}
    </div>
  )

  return (
    <>
      <div className="head">
        <h1>부족한 부분, 어떻게 채워 볼까요?</h1>
        <span className="lead-line">하고 싶은 것만 고르세요. 공부와 프로젝트를 함께 골라도 좋아요.</span>
      </div>
      <section className="basket" aria-live="polite">
        {basketColumn('study', '지식에 남아요', '공부를 고르면 담겨요.')}
        {basketColumn('project', '이력서에 남아요', '프로젝트를 고르면 담겨요.')}
      </section>
      {directions.map(({ gapNumber, requirement, options }) => (
        <section className="dir-card" key={gapNumber}>
          <h2>{requirement}</h2>
          <div className="dir-options">
            {options.map((option, index) => {
              const key = pickKey(gapNumber, index)
              return (
                <button key={key} className="dir-option" type="button" aria-pressed={picks.includes(key)} onClick={() => toggle(key)}>
                  <span className="dir-title">
                    <span className="tick" aria-hidden="true">
                      {picks.includes(key) ? '✓' : ''}
                    </span>
                    <b>{option.label}</b>
                    {option.recommended ? <span className="pill rec">추천</span> : null}
                  </span>
                  <span className="small">{option.description}</span>
                  <span className="small">
                    약 {option.hours}시간 걸리는 {option.lane === 'study' ? '공부' : '프로젝트'}예요.
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
      {remaining.length > 0 ? (
        <section className="remaining" aria-labelledby="remaining-title">
          <h2 id="remaining-title">아직 방법을 보지 않은 요건이 {remaining.length}개 있어요</h2>
          <p className="small">불충족인 요건부터 먼저 {directions.length}개의 방법을 정리해 드렸어요. 나머지도 원하면 이어서 볼 수 있어요.</p>
          <ul>
            {remaining.map(({ requirement, verdict }) => (
              <li key={requirement}>
                <span className={`pill ${verdict === 'unmet' ? 'lack' : 'part'}`}>{verdict === 'unmet' ? '불충족' : '일부 충족'}</span>
                <span>{requirement}</span>
              </li>
            ))}
          </ul>
          {moreFailure ? (
            <p className="error" role="alert">
              {moreFailure.message}
            </p>
          ) : null}
          {moreFailure?.canRetry === false ? null : (
            <button className="btn-line" type="button" onClick={onLoadMore}>
              다음 {Math.min(FIRST_BATCH, remaining.length)}개 요건의 방법도 볼게요
            </button>
          )}
        </section>
      ) : null}
      <p className="lead-line">
        {picks.length > 0
          ? `이력서 ${projectHours}시간, 공부 ${studyHours}시간이에요. 일주일 ${weeklyHours}시간이면 약 ${weeks}주 걸려요.`
          : '고르지 않은 항목은 이번에 하지 않아요.'}
      </p>
      <div className="actions-row">
        {picks.length === 0 ? (
          <button className="btn-line" type="button" onClick={() => onPicks(recommendedPicks(directions))}>
            추천대로 고를게요
          </button>
        ) : null}
        <button className="btn" type="button" disabled={picks.length === 0} onClick={onConfirm}>
          이대로 할게요
        </button>
        <button className="btn-line" type="button" onClick={onBack}>
          비교 결과로 돌아갈게요
        </button>
      </div>
    </>
  )
}
