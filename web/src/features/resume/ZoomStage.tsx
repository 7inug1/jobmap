import { useEffect, useRef } from 'react'

type Target = { page: number; line: number } | null

const ZOOM_AFTER_MS = 1800
const ZOOM_TRANSITION_MS = 2400

const barWidth = (text: string) => Math.max(34, Math.min(96, 24 + text.length * 1.6))

/**
 * 이력서 전체에서 문장이 들어갈 곳을 찾아 확대해서 보여 준다.
 * 이력서 글을 줄 모양의 막대로 보여 주다가, 들어갈 자리 근처를 실제 글과 함께 확대한다.
 */
export function ZoomStage({ pages, target, added, done, note, onFinished }: {
  pages: string[][]
  target: Target
  /** 그 자리에 들어갈 문장 수. */
  added: number
  /** 완성한 문장 수. 완성한 만큼 초록 막대로 보인다. */
  done: number
  note: string
  onFinished?: () => void
}) {
  const stage = useRef<HTMLDivElement>(null)
  const sheets = useRef<HTMLDivElement>(null)
  const zoomTarget = useRef<HTMLDivElement>(null)
  const noteText = useRef<HTMLSpanElement>(null)
  // 부모가 다시 그려져도 연출은 처음 한 번만 실행한다. 이미 확대된 뒤에 다시 재면 배율이 되돌아간다.
  const latest = useRef({ note, onFinished })
  useEffect(() => {
    latest.current = { note, onFinished }
  })

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const zoom = () => {
      if (!stage.current || !sheets.current || !zoomTarget.current) return
      const stageBox = stage.current.getBoundingClientRect()
      const targetBox = zoomTarget.current.getBoundingClientRect()
      const scale = Math.min((stageBox.width * 0.86) / targetBox.width, (stageBox.height * 0.72) / targetBox.height)
      const dx = stageBox.left + stageBox.width / 2 - (targetBox.left + targetBox.width / 2)
      const dy = stageBox.top + stageBox.height * 0.45 - (targetBox.top + targetBox.height / 2)
      sheets.current.style.transformOrigin = `${targetBox.left + targetBox.width / 2 - stageBox.left}px ${targetBox.top + targetBox.height / 2 - stageBox.top}px`
      sheets.current.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
      if (noteText.current) noteText.current.textContent = latest.current.note
    }
    const timers = [setTimeout(zoom, reduce ? 0 : ZOOM_AFTER_MS)]
    timers.push(setTimeout(() => latest.current.onFinished?.(), reduce ? 600 : ZOOM_AFTER_MS + ZOOM_TRANSITION_MS + 400))
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <section className="zoom-wrap">
      <div className="zoom-stage" ref={stage} role="img" aria-label={`이력서 ${pages.length}쪽 중 문장이 들어갈 곳을 확대하는 장면`}>
        <div className="sheets" ref={sheets}>
          {pages.map((lines, page) => {
            // 줄이 많아도 한 쪽 안에 들어가도록 줄 높이를 줄 수에 맞춘다.
            const pitch = Math.min(8.5, 300 / (lines.length + added + 4))
            return (
              <div className="sheet" key={page} style={{ '--bar': `${pitch * 0.45}px`, '--gap': `${pitch * 0.55}px` } as React.CSSProperties}>
                <span className="page-no">{page + 1}쪽</span>
                {lines.map((text, line) =>
                  target && target.page === page && target.line === line ? (
                    <div className="target" key={line} ref={zoomTarget}>
                      {line > 0 ? <span className="ctx">{lines[line - 1]}</span> : null}
                      <span className="ctx">{text}</span>
                      {Array.from({ length: added }, (_, index) => (
                        <i key={index} className={`ln add${index < done ? ' filled' : ''}`} />
                      ))}
                    </div>
                  ) : (
                    <i className="ln" key={line} style={{ width: `${barWidth(text)}%` }} />
                  ),
                )}
              </div>
            )
          })}
        </div>
        <span className="zoom-note" ref={noteText}>
          이력서 전체에서 바뀌는 곳을 찾을게요
        </span>
      </div>
    </section>
  )
}
