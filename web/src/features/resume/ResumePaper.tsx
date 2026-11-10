import { useEffect, useRef, useState } from 'react'
import type { SentenceItem } from '../../shared/types.ts'
import { classifyLines } from '../../shared/text-lines.ts'
import { SentenceText } from './SentenceText.tsx'
import { placeSentences, resumePages } from './sentences.ts'

function Added({ item, active }: { item: SentenceItem; active: boolean }) {
  return (
    <div className={`added${item.done ? ' filled' : ''}${active ? ' active' : ''}`} data-active={active}>
      <span className="added-label">{item.done ? '추가 완료' : active ? '지금 확인하는 문장이에요' : '여기에 추가돼요'}</span>
      <span>
        <SentenceText sentence={item.sentence} answers={item.answers} />
      </span>
    </div>
  )
}

function activePageOf(placed: ReturnType<typeof placeSentences>, key: string): number | undefined {
  const page = placed.pages.findIndex((entries) => entries.some((entry) => entry.kind === 'added' && entry.item.key === key))
  if (page !== -1) return page
  return placed.unplaced.some((item) => item.key === key) ? placed.pages.length - 1 : undefined
}

/** 지원할 때 내 이력서. 문장이 들어갈 자리를 표시하고, 완성한 문장은 초록색으로 바꿔 보여 준다. */
export function ResumePaper({ resume, items, activeKey, compact = false }: { resume: string; items: SentenceItem[]; activeKey?: string; compact?: boolean }) {
  const pages = resumePages(resume)
  const placed = placeSentences(pages, items)
  const [large, setLarge] = useState(false)
  // 지금 확인하는 문장이 있는 쪽을 먼저 보여 준다. 사용자가 쪽을 직접 고르면 그 문장을 보는 동안은 그 쪽을 유지한다.
  const activePage = activeKey === undefined ? undefined : activePageOf(placed, activeKey)
  const [chosen, setChosen] = useState<{ forKey: string | undefined; page: number } | null>(null)
  const current = Math.min(chosen && chosen.forKey === activeKey ? chosen.page : (activePage ?? placed.target?.page ?? 0), pages.length - 1)
  const paper = useRef<HTMLElement>(null)

  useEffect(() => {
    const container = paper.current
    const target = container?.querySelector<HTMLElement>('[data-active="true"]')
    if (container && target) container.scrollTo({ top: Math.max(0, target.offsetTop - container.clientHeight / 3), behavior: 'smooth' })
  }, [activeKey, current])

  const entries = placed.pages[current]!
  const kinds = classifyLines(entries.flatMap((entry) => (entry.kind === 'line' ? [entry.text] : [])))
  // 줄 항목이 몇 번째 줄인지 미리 센다. 문장이 중간에 끼어 있어도 줄 모양(제목, 목록)을 맞추기 위해서다.
  const lineIndexes: number[] = []
  let counted = 0
  for (const entry of entries) lineIndexes.push(entry.kind === 'line' ? counted++ : -1)

  return (
    <section className="resume">
      <div className="resume-head">
        <b>지원할 때 내 이력서</b>
        <button className="link-button" type="button" onClick={() => setLarge(!large)}>
          {large ? '작게 볼게요' : '크게 볼게요'}
        </button>
      </div>
      <div className={`resume-view${large ? ' large' : ''}`}>
        {pages.length > 1 ? (
          <div className="page-thumbs">
            {pages.map((_, index) => {
              const hasAdded = placed.pages[index]!.some((entry) => entry.kind === 'added') || (index === pages.length - 1 && placed.unplaced.length > 0)
              return (
                <button key={index} className="page-thumb" type="button" aria-pressed={index === current} aria-label={`${index + 1}쪽 보기`} onClick={() => setChosen({ forKey: activeKey, page: index })}>
                  <span className="thumb-paper">
                    {[1, 2, 3, 4, 5].map((bar) => (
                      <i key={bar} className={hasAdded && bar > 1 && bar < 4 ? 'add' : ''} />
                    ))}
                  </span>
                  {index + 1}쪽
                </button>
              )
            })}
          </div>
        ) : null}
        <article className={`paper${compact ? ' compact' : ''}`} ref={paper}>
          {entries.map((entry, index) => {
            if (entry.kind === 'added') return <Added key={index} item={entry.item} active={entry.item.key === activeKey} />
            const { kind, text, section } = kinds[lineIndexes[index]!]!
            if (kind === 'heading') return section ? <h5 key={index}>{text}</h5> : <b className="paper-sub" key={index}>{text}</b>
            if (kind === 'item') return <p className="paper-item" key={index}>{text}</p>
            return <p key={index}>{text}</p>
          })}
          {current === pages.length - 1 && placed.unplaced.length > 0 ? (
            <>
              <h5>새 항목</h5>
              {placed.unplaced.map((item) => (
                <Added key={item.key} item={item} active={item.key === activeKey} />
              ))}
            </>
          ) : null}
          {placed.pages.every((entries) => !entries.some((entry) => entry.kind === 'added')) && placed.unplaced.length === 0 ? (
            <p className="paper-tip">이 이력서에는 바뀌는 곳이 없어요.</p>
          ) : null}
          <span className="paper-no">
            {current + 1} / {pages.length}
          </span>
        </article>
      </div>
    </section>
  )
}
