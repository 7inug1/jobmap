import type { Verdict } from '../../shared/types.ts'
import type { EditedRow } from './comparison.ts'
import { VERDICTS } from './verdicts.ts'

export function Annotation({
  row,
  showRequirement,
  onVerdict,
}: {
  row: EditedRow
  showRequirement: boolean
  onVerdict: (verdict: Verdict) => void
}) {
  const edited = row.verdict !== row.aiVerdict
  const original = VERDICTS.find(({ value }) => value === row.aiVerdict)?.label
  const quote = row.resumeQuote ?? '이력서에서 근거를 찾지 못했어요.'

  return (
    <div className={`anno a-${VERDICTS.find(({ value }) => value === row.verdict)?.className}`}>
      <div className="anno-top">
        {showRequirement ? <b>{row.requirement}</b> : <span className="anno-quote">{quote}</span>}
        <div className="verdicts" role="group" aria-label={`${row.requirement} 판단`}>
          {VERDICTS.map(({ value, label, className }) => (
            <button
              key={value}
              type="button"
              className={`verdict v-${className}`}
              aria-pressed={row.verdict === value}
              onClick={() => onVerdict(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {showRequirement ? <span>{quote}</span> : null}
      {edited ? <span className="small">처음에는 {original}(으)로 봤어요.</span> : null}
    </div>
  )
}
