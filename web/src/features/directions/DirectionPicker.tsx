import { pickKey } from '../../shared/pick-key.ts'
import type { Direction, DirectionOption, Gap } from '../../shared/types.ts'
import { FIRST_BATCH, recommendedPicks } from './directions.ts'

export function DirectionPicker({
  directions,
  remaining,
  skippedNames,
  onSkip,
  onRestore,
  onLoadMore,
  moreFailure,
  picks,
  onPicks,
  onConfirm,
  confirmFailure,
  onBack,
}: {
  directions: Direction[]
  remaining: Gap[]
  skippedNames: string[]
  onSkip: (requirement: string) => void
  onRestore: (requirement: string) => void
  onLoadMore: () => void
  moreFailure: { message: string; canRetry: boolean } | null
  picks: string[]
  onPicks: (picks: string[]) => void
  onConfirm: () => void
  confirmFailure: { message: string; canRetry: boolean } | null
  onBack: () => void
}) {
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
                    {option.lane === 'study' ? '지식으로 남는 공부예요.' : '이력서에 남는 프로젝트예요.'}
                  </span>
                </button>
              )
            })}
          </div>
          <button className="link-button start-align" type="button" onClick={() => onSkip(requirement)}>
            나에게 해당하지 않는 요건이에요
          </button>
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
                <button className="link-button" type="button" onClick={() => onSkip(requirement)}>
                  나에게 해당하지 않아요
                </button>
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
      {skippedNames.length > 0 ? (
        <section className="remaining" aria-labelledby="skipped-title">
          <h2 id="skipped-title">나에게 해당하지 않아 뺀 요건이 {skippedNames.length}개 있어요</h2>
          <ul>
            {skippedNames.map((name) => (
              <li key={name}>
                <span>{name}</span>
                <button className="link-button" type="button" onClick={() => onRestore(name)}>
                  다시 넣을게요
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="lead-line">
        {picks.length > 0
          ? `방법 ${picks.length}개를 골랐어요.`
          : '고르지 않은 항목은 이번에 하지 않아요.'}
      </p>
      {confirmFailure ? (
        <p className="error" role="alert">
          {confirmFailure.message}
        </p>
      ) : null}
      <div className="actions-row">
        {picks.length === 0 ? (
          <button className="btn-line" type="button" onClick={() => onPicks(recommendedPicks(directions))}>
            추천대로 고를게요
          </button>
        ) : null}
        <button className="btn" type="button" disabled={picks.length === 0 || confirmFailure?.canRetry === false} onClick={onConfirm}>
          이대로 할게요
        </button>
        <button className="btn-line" type="button" onClick={onBack}>
          비교 결과로 돌아갈게요
        </button>
      </div>
    </>
  )
}
