import type { Verdict } from '../../shared/types.ts'
import type { EditedRow } from './comparison.ts'
import { VERDICTS } from './verdicts.ts'

export function Annotation({ row, onVerdict }: { row: EditedRow; onVerdict: (verdict: Verdict) => void }) {
  const edited = row.verdict !== row.aiVerdict
  const original = VERDICTS.find(({ value }) => value === row.aiVerdict)?.label

  return (
    <div className="anno">
      <div className="anno-top">
        <b>{row.requirement}</b>
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
      <span>{row.resumeQuote ?? '이력서에서 근거를 찾지 못했어요.'}</span>
      {edited ? <span className="small">처음에는 {original}(으)로 봤어요.</span> : null}
    </div>
  )
}
