import { useState } from 'react'
import type { Run, SentenceItem } from '../../shared/types.ts'
import { ResumePaper } from './ResumePaper.tsx'
import { SentenceText } from './SentenceText.tsx'
import { addedAtTarget, placeSentences, resumePages } from './sentences.ts'
import { ZoomStage } from './ZoomStage.tsx'

type Phase = 'zoom' | 'cards' | 'final'

/** 문장이 이력서의 어디에 들어가는지 보여 주고, 문장을 하나씩 확인하게 한 뒤 최종 계획을 보여 준다. */
export function SentenceFlow({
  run,
  onChange,
  onRemove,
  onBack,
  onStart,
}: {
  run: Run
  onChange: (run: Run) => void
  onRemove: (key: string) => void
  onBack: () => void
  onStart: () => void
}) {
  const state = run.sentences!
  const items = state.items
  const [phase, setPhase] = useState<Phase>('zoom')
  const [index, setIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)

  const pages = resumePages(run.resume)
  const placed = placeSentences(pages, items)

  function update(key: string, patch: Partial<SentenceItem>) {
    onChange({ ...run, sentences: { ...state, items: items.map((item) => (item.key === key ? { ...item, ...patch } : item)) } })
  }

  if (items.length === 0) {
    return (
      <>
        <div className="head">
          <h1>이번 계획은 이력서를 바꾸지 않아요</h1>
          <span className="lead-line">고른 방법에 이력서에 넣을 프로젝트가 없어요.</span>
        </div>
        <div className="actions-row">
          <button className="btn" type="button" onClick={onStart}>
            이 계획으로 시작할게요
          </button>
          <button className="btn-line" type="button" onClick={onBack}>
            방향을 다시 고를게요
          </button>
        </div>
      </>
    )
  }

  if (phase === 'zoom') {
    const target = placed.target
    return (
      <>
        <div className="head">
          <h1>
            이력서에 문장 <mark>{items.length}개</mark>를 더할게요
          </h1>
        </div>
        <ZoomStage
          key="zoom"
          pages={pages}
          target={target}
          added={Math.max(1, addedAtTarget(placed))}
          done={0}
          note={target ? `${target.page + 1}쪽에 문장 ${items.length}개가 들어가요` : `문장 ${items.length}개를 이력서에 더해요`}
          onFinished={() => setZoomed(true)}
        />
        <div className="actions-row">
          {zoomed ? (
            <button className="btn" type="button" onClick={() => setPhase('cards')}>
              문장을 하나씩 확인할게요
            </button>
          ) : null}
          <button className="link-button" type="button" onClick={() => setPhase('cards')}>
            확대 장면을 건너뛸게요
          </button>
        </div>
      </>
    )
  }

  if (phase === 'cards') {
    const item = items[Math.min(index, items.length - 1)]!
    return (
      <>
        <div className="head">
          <h1>문장을 하나씩 확인할게요</h1>
          <span className="lead-line">맞으면 넘어가고, 할 일이 다르면 지금 고쳐 주세요.</span>
        </div>
        {items.slice(0, index).map((done) => (
          <article className="q-card answered" key={done.key}>
            <div className="q-top">
              <span className="tag-resume">이력서에 남아요</span>
              <span className="check">✓ 확인했어요</span>
            </div>
            <h3 className="confirm-title">{done.label}</h3>
            <div className="goal">
              <span>
                <SentenceText sentence={done.sentence} answers={done.answers} />
              </span>
            </div>
            <ul className="rule-list">
              {done.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </article>
        ))}
        <ConfirmCard
          key={item.key}
          item={item}
          position={index + 1}
          total={items.length}
          onSteps={(steps) => update(item.key, { steps })}
          onSentence={(sentence) => update(item.key, { sentence, answers: {} })}
          onNext={() => (index + 1 < items.length ? setIndex(index + 1) : setPhase('final'))}
          onPrevious={index > 0 ? () => setIndex(index - 1) : onBack}
          previousLabel={index > 0 ? '이전 문장을 볼게요' : '방향을 다시 고를게요'}
          onRemove={() => {
            onRemove(item.key)
            setIndex(Math.min(index, Math.max(0, items.length - 2)))
          }}
          isLast={index + 1 >= items.length}
        />
      </>
    )
  }

  return (
    <>
      <div className="head">
        <h1>
          이력서에 이 문장 <mark>{items.length}개</mark>를 더할게요
        </h1>
        <span className="lead-line">빈칸은 할 일을 끝내고 실제 결과가 나오면 채워요.</span>
      </div>
      <div className="actions-row">
        <button
          className="btn-line"
          type="button"
          onClick={() => {
            setZoomed(false)
            setPhase('zoom')
          }}
        >
          이력서에서 위치를 다시 볼게요
        </button>
      </div>
      <ResumePaper resume={run.resume} items={items} />
      <section className="todo-sec" aria-labelledby="todo-title">
        <h2 id="todo-title">이 문장을 쓰려면 할 일</h2>
        <div className="sent-list">
          {items.map((item) => (
            <article className="sent-card" key={item.key}>
              <div className="sent-top">
                <b>{item.label}</b>
                <span className="small">약 {item.hours}시간</span>
              </div>
              <ul className="rule-list">
                {item.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <div className="actions-row sticky-action">
        <button
          className="btn-line"
          type="button"
          onClick={() => {
            setIndex(items.length - 1)
            setPhase('cards')
          }}
        >
          이전 문장을 볼게요
        </button>
        <button className="btn" type="button" onClick={onStart}>
          이 계획으로 시작할게요
        </button>
      </div>
    </>
  )
}

function ConfirmCard({
  item,
  position,
  total,
  isLast,
  previousLabel,
  onSteps,
  onSentence,
  onNext,
  onPrevious,
  onRemove,
}: {
  item: SentenceItem
  position: number
  total: number
  isLast: boolean
  previousLabel: string
  onSteps: (steps: string[]) => void
  onSentence: (sentence: string) => void
  onNext: () => void
  onPrevious: () => void
  onRemove: () => void
}) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [sentenceDraft, setSentenceDraft] = useState(item.sentence)

  function addStep() {
    const step = draft.trim()
    if (step === '' || item.steps.includes(step)) return
    onSteps([...item.steps, step])
    setDraft('')
  }

  return (
    <article className="q-card current">
      <div className="q-top">
        <span className="q-count">
          문장 {position} / {total}
        </span>
        <span className="tag-resume">이력서에 남아요</span>
      </div>
      <h2>{item.label}</h2>
      <div className="goal">
        <span className="small">끝나면 이력서에 들어갈 문장</span>
        {editing ? (
          <>
            <textarea
              value={sentenceDraft}
              rows={3}
              maxLength={220}
              aria-label="이력서에 들어갈 문장"
              onChange={(event) => setSentenceDraft(event.target.value)}
            />
            <span className="small">실제 결과를 나중에 넣을 자리는 {'{'}이렇게{'}'} 중괄호로 묶어 주세요.</span>
            <div className="actions-row">
              <button
                className="btn-line"
                type="button"
                onClick={() => {
                  const next = sentenceDraft.trim()
                  if (next === '') return
                  onSentence(next)
                  setEditing(false)
                }}
              >
                이 문장으로 저장할게요
              </button>
              <button className="link-button" type="button" onClick={() => { setSentenceDraft(item.sentence); setEditing(false) }}>
                그만둘게요
              </button>
            </div>
          </>
        ) : (
          <>
            <span>
              <SentenceText sentence={item.sentence} answers={item.answers} />
            </span>
            <button className="link-button start-align" type="button" onClick={() => { setSentenceDraft(item.sentence); setEditing(true) }}>
              문장을 고칠게요
            </button>
          </>
        )}
      </div>
      <div className="to-do">
        <h4>이 문장을 쓰려면, 약 {item.hours}시간</h4>
        <ul className="edit-steps">
          {item.steps.map((step) => (
            <li key={step}>
              <span>{step}</span>
              {item.steps.length > 1 ? (
                <button className="icon-mini" type="button" aria-label={`${step} 할 일을 뺄게요`} onClick={() => onSteps(item.steps.filter((other) => other !== step))}>
                  ✕
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="fb-input">
          <input
            type="text"
            value={draft}
            aria-label="할 일을 직접 추가할게요"
            placeholder="할 일을 직접 추가할게요"
            maxLength={100}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addStep()
              }
            }}
          />
          <button className="btn-line" type="button" onClick={addStep}>
            추가할게요
          </button>
        </div>
      </div>
      <div className="actions-row">
        <button className="btn" type="button" onClick={onNext}>
          {isLast ? '좋아요, 최종 계획을 볼게요' : '좋아요, 다음 문장을 볼게요'}
        </button>
        <button className="btn-line" type="button" onClick={onPrevious}>
          {previousLabel}
        </button>
        <button className="btn-line" type="button" onClick={onRemove}>
          이 문장을 뺄게요
        </button>
      </div>
    </article>
  )
}
