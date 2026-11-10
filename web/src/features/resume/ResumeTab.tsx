import { useState } from 'react'
import { Link } from 'react-router'
import type { Run, SentenceItem } from '../../shared/types.ts'
import { ResumePaper } from './ResumePaper.tsx'
import { SentenceText } from './SentenceText.tsx'
import { addedAtTarget, blanksOf, placeSentences, readyToFill, resumePages } from './sentences.ts'
import { ZoomStage } from './ZoomStage.tsx'

/** 이력서 문장 화면. 할 일을 체크하고, 다 끝나면 실제 결과를 넣어 문장을 완성한다. */
export function ResumeTab({ run, onChange, planHref }: { run: Run; onChange: (run: Run) => void; planHref: string }) {
  const state = run.sentences!
  const items = state.items
  const [replay, setReplay] = useState(false)
  const doneCount = items.filter((item) => item.done).length

  function update(key: string, patch: Partial<SentenceItem>) {
    onChange({ ...run, sentences: { ...state, items: items.map((item) => (item.key === key ? { ...item, ...patch } : item)) } })
  }

  const pages = resumePages(run.resume)
  const placed = placeSentences(pages, items)

  return (
    <>
      <div className="head">
        <h1>
          이력서 문장 <mark>{doneCount} / {items.length}개</mark> 완성
        </h1>
        <span className="lead-line">할 일을 끝내고 실제 결과를 넣으면 문장이 완성돼요.</span>
      </div>
      {items.filter(readyToFill).map((item) => (
        <FillCard key={item.key} item={item} onFill={(answers) => update(item.key, { answers, done: true })} />
      ))}
      {replay ? (
        <>
          <ZoomStage
            pages={pages}
            target={placed.target}
            added={Math.max(1, addedAtTarget(placed))}
            done={doneCount}
            note={placed.target ? `${placed.target.page + 1}쪽에 문장 ${items.length}개가 들어가요` : '이력서에 문장이 들어가요'}
          />
          <div className="actions-row">
            <button className="link-button" type="button" onClick={() => setReplay(false)}>
              확대 장면을 닫을게요
            </button>
          </div>
        </>
      ) : (
        <div className="actions-row">
          <button className="btn-line" type="button" onClick={() => setReplay(true)}>
            이력서에서 위치를 다시 볼게요
          </button>
        </div>
      )}
      <ResumePaper resume={run.resume} items={items} />
      <section className="todo-sec" aria-labelledby="todo-title">
        <h2 id="todo-title">이 문장을 쓰려면 할 일</h2>
        <div className="sent-list">
          {items.map((item) => (
            <article className={`sent-card${item.done ? ' filled' : ''}`} key={item.key}>
              <div className="sent-top">
                <b>{item.label}</b>
                <span className="small">약 {item.hours}시간</span>
              </div>
              <ul className="steps">
                {item.steps.map((step) => {
                  const ticked = item.ticked.includes(step)
                  return (
                    <li key={step}>
                      {item.done ? (
                        <span className="plain">
                          <span className="bullet" aria-hidden="true">
                            ✓
                          </span>
                          <span>{step}</span>
                        </span>
                      ) : (
                        <label>
                          <input
                            type="checkbox"
                            checked={ticked}
                            onChange={() => update(item.key, { ticked: ticked ? item.ticked.filter((other) => other !== step) : [...item.ticked, step] })}
                          />
                          <span className={ticked ? 'is-done' : undefined}>{step}</span>
                        </label>
                      )}
                    </li>
                  )
                })}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <div className="actions-row">
        <Link className="btn-line" to={planHref}>
          이번 주 할 일을 볼게요
        </Link>
      </div>
    </>
  )
}

function FillCard({ item, onFill }: { item: SentenceItem; onFill: (answers: Record<string, string>) => void }) {
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
