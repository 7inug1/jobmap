import { useState } from 'react'
import { directionsFailure } from '../../shared/failure-reasons.ts'
import type { DirectionsRun, Gap, Verdict } from '../../shared/types.ts'
import { Annotation } from './Annotation.tsx'
import { annotatePosting, directionsWillReset, gapsFromRows, repeatsLine, type EditedRow } from './comparison.ts'
import { VERDICTS } from './verdicts.ts'

export function Result({
  posting,
  rows,
  onVerdict,
  onNext,
  savedDirections,
  onRestart,
}: {
  posting: string
  rows: EditedRow[]
  onVerdict: (index: number, verdict: Verdict) => void
  onNext: (gaps: Gap[]) => Promise<void>
  savedDirections: DirectionsRun | undefined
  onRestart: () => void
}) {
  const [opening, setOpening] = useState(false)
  const [failures, setFailures] = useState(0)
  const [failure, setFailure] = useState<ReturnType<typeof directionsFailure> | null>(null)
  const gaps = gapsFromRows(rows)

  async function next() {
    setOpening(true)
    setFailure(null)
    try {
      await onNext(gaps)
    } catch (error) {
      setFailures(failures + 1)
      setFailure(directionsFailure(error, failures + 1))
      setOpening(false)
    }
  }

  const { lines, unplaced } = annotatePosting(posting, rows)
  const met = rows.filter((row) => row.verdict === 'met').length
  const annotation = (index: number, line?: string) => (
    <Annotation
      key={index}
      row={rows[index]}
      showRequirement={line === undefined || !repeatsLine(line, rows[index].requirement)}
      onVerdict={(verdict) => onVerdict(index, verdict)}
    />
  )

  return (
    <>
      <div className="head">
        <h1>
          요건 {rows.length}개 중 {met}개를 충족해요
        </h1>
        <span className="lead-line">공고를 읽으면서 판단이 다르면 직접 바꿔 주세요.</span>
      </div>
      <div className="sum">
        {VERDICTS.map(({ value, label, className }) => (
          <span key={value} className={`pill ${className}`}>
            {label} {rows.filter((row) => row.verdict === value).length}
          </span>
        ))}
      </div>
      <article className="posting-doc">
        {lines.map((line, index) => (
          <div className="posting-item" key={index}>
            <p>{line.text.replace(/^- /, '')}</p>
            {line.rowIndexes.map((index) => annotation(index, line.text))}
          </div>
        ))}
        {unplaced.length > 0 ? (
          <div className="posting-item">
            <h3>그 외 요건</h3>
            {unplaced.map((index) => annotation(index))}
          </div>
        ) : null}
      </article>
      {failure ? (
        <p className="error" role="alert">
          {failure.message}
        </p>
      ) : null}
      {directionsWillReset(savedDirections, gaps) ? (
        <p className="small">판단을 바꿔서, 다음으로를 누르면 고른 방향이 사라지고 채울 방법을 새로 제안받아요.</p>
      ) : null}
      {gaps.length === 0 ? <p className="lead-line">부족한 요건이 없어요. 바로 지원해 봐도 좋아요.</p> : null}
      <div className="actions-row sticky-action">
        {gaps.length > 0 ? (
          <button className="btn" type="button" disabled={opening || failure?.canRetry === false} onClick={next}>
            {opening ? '채울 방법을 정리하는 중' : '다음으로'}
          </button>
        ) : null}
        <button className="btn-line" type="button" onClick={onRestart}>
          다른 공고로 비교하기
        </button>
      </div>
    </>
  )
}
