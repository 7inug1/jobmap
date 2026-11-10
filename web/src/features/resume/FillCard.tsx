import { useState } from 'react'
import type { SentenceItem } from '../../shared/types.ts'
import { SentenceText } from './SentenceText.tsx'
import { blanksOf } from './sentences.ts'

/** 할 일을 모두 끝낸 문장에 실제 결과를 넣어 완성한다. */
export function FillCard({ item, onFill }: { item: SentenceItem; onFill: (answers: Record<string, string>) => void }) {
  const blanks = blanksOf(item.sentence)
  const [values, setValues] = useState<Record<string, string>>({})
  const [missing, setMissing] = useState<string | null>(null)

  function submit() {
    const empty = blanks.find((name) => !values[name]?.trim())
    if (empty) {
      setMissing(empty)
      return
    }
    onFill(Object.fromEntries(blanks.map((name) => [name, values[name]!.trim()])))
  }

  return (
    <article className="fill-card">
      <b>할 일을 끝냈어요. 결과를 넣으면 이력서 문장이 완성돼요.</b>
      <div className="goal">
        <span>
          <SentenceText sentence={item.sentence} answers={values} />
        </span>
      </div>
      {blanks.map((name) => (
        <input
          key={name}
          type="text"
          value={values[name] ?? ''}
          placeholder={name}
          aria-label={name}
          maxLength={120}
          aria-invalid={missing === name}
          onChange={(event) => {
            setValues({ ...values, [name]: event.target.value })
            setMissing(null)
          }}
        />
      ))}
      {missing ? (
        <p className="error" role="alert">
          {missing} 칸을 채워 주세요.
        </p>
      ) : null}
      <button className="btn" type="button" onClick={submit}>
        이력서에 넣을게요
      </button>
    </article>
  )
}
