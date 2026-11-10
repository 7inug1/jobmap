import { useState } from 'react'
import type { SentenceItem } from '../../shared/types.ts'
import { classifyLines } from '../../shared/text-lines.ts'
import { SentenceText } from './SentenceText.tsx'
import { placeSentences, resumePages } from './sentences.ts'

function Added({ item }: { item: SentenceItem }) {
  return (
    <div className={`added${item.done ? ' filled' : ''}`}>
      <span className="added-label">{item.done ? '추가 완료' : '여기에 추가돼요'}</span>
      <span>
        <SentenceText sentence={item.sentence} answers={item.answers} />
      </span>
    </div>
  )
}

/** 지원할 때 내 이력서. 문장이 들어갈 자리를 표시하고, 완성한 문장은 초록색으로 바꿔 보여 준다. */
export function ResumePaper({ resume, items }: { resume: string; items: SentenceItem[] }) {
  const pages = resumePages(resume)
  const placed = placeSentences(pages, items)
  const [page, setPage] = useState(placed.target?.page ?? 0)
  const [large, setLarge] = useState(false)
  const current = Math.min(page, pages.length - 1)

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
                <button key={index} className="page-thumb" type="button" aria-pressed={index === current} aria-label={`${index + 1}쪽 보기`} onClick={() => setPage(index)}>
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
        <article className="paper">
          {entries.map((entry, index) => {
            if (entry.kind === 'added') return <Added key={index} item={entry.item} />
            const { kind, text, section } = kinds[lineIndexes[index]!]!
            if (kind === 'heading') return section ? <h5 key={index}>{text}</h5> : <b className="paper-sub" key={index}>{text}</b>
            if (kind === 'item') return <p className="paper-item" key={index}>{text}</p>
            return <p key={index}>{text}</p>
          })}
          {current === pages.length - 1 && placed.unplaced.length > 0 ? (
            <>
              <h5>새 항목</h5>
              {placed.unplaced.map((item) => (
                <Added key={item.key} item={item} />
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
