import { useEffect, useRef } from 'react'
import type { PostingNotice } from './input-checks.ts'
import { SUPPORTED } from './posting-sources.ts'

export function PostingFailedModal({
  notice,
  onPaste,
  onOtherLink,
  onClose,
}: {
  notice: PostingNotice
  onPaste: () => void
  onOtherLink: () => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="posting-failed-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <h2 id="posting-failed-title">{notice.title}</h2>
      <p>{notice.body}</p>
      <p className="small">링크로 읽을 수 있는 사이트: {SUPPORTED.map(({ name }) => name).join(', ')}</p>
      <div className="actions-row">
        <button className="btn" type="button" onClick={onPaste}>
          공고 본문을 붙여 넣을게요
        </button>
        <button className="btn-line" type="button" onClick={onOtherLink}>
          다른 링크를 넣을게요
        </button>
      </div>
    </dialog>
  )
}
