import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { DAILY_LIMIT_DETAIL, isDailyLimit } from '../../shared/failure-reasons.ts'
import { startRun } from '../../shared/start-run.ts'
import type { Inputs, Run } from '../../shared/types.ts'
import {
  checkPdfSize,
  checkPostingText,
  checkPostingUrl,
  checkResumeText,
  describePostingFailure,
  MIN_RESUME_LENGTH,
  pdfErrorMessage,
  type PostingNotice,
} from './input-checks.ts'
import { classifyPostingUrl, SUPPORTED, UNSUPPORTED } from './posting-sources.ts'
import { PostingFailedModal } from './PostingFailedModal.tsx'
import { readResumePdf } from './resume-pdf.ts'

export function Start({ initial, onStarted }: { initial: Inputs; onStarted: (run: Run) => void }) {
  const [resume, setResume] = useState(initial.resume)
  const [pdfName, setPdfName] = useState<string | null>(null)
  const [readingPdf, setReadingPdf] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [pasteResume, setPasteResume] = useState(false)

  const [url, setUrl] = useState('')
  const [posting, setPosting] = useState(initial.posting)
  const [notice, setNotice] = useState<PostingNotice | null>(null)
  const urlInput = useRef<HTMLInputElement>(null)
  const postingInput = useRef<HTMLTextAreaElement>(null)
  const focusAfterNotice = useRef<HTMLElement | null | undefined>(undefined)
  const [pastePosting, setPastePosting] = useState(initial.posting !== '')

  const [status, setStatus] = useState<'idle' | 'reading-posting' | 'starting'>('idle')
  const [startError, setStartError] = useState<string | null>(null)

  const source = classifyPostingUrl(url.trim())
  const urlError = checkPostingUrl(url.trim())
  const resumeTextError = checkResumeText(resume)
  const postingTextError = pastePosting ? checkPostingText(posting) : null
  const hasPosting = pastePosting ? posting.trim() !== '' && !postingTextError : url.trim() !== '' && !urlError
  const ready = resume.trim() !== '' && !resumeTextError && hasPosting && !readingPdf && status === 'idle'

  // 모달이 화면에서 사라진 뒤에 옮겨야 브라우저의 포커스 복원과 겹치지 않는다.
  useEffect(() => {
    if (notice || focusAfterNotice.current === undefined) return
    const target = focusAfterNotice.current ?? postingInput.current
    focusAfterNotice.current = undefined
    target?.focus()
  }, [notice])

  async function attachPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setResumeError(null)
    setPdfName(null)
    const sizeError = checkPdfSize(file.size)
    if (sizeError) {
      setResumeError(sizeError)
      setPasteResume(true)
      return
    }
    setReadingPdf(true)
    try {
      const text = await readResumePdf(file)
      if (text.trim().length < MIN_RESUME_LENGTH) {
        setResumeError('PDF에서 글자를 찾지 못했어요. 스캔한 파일이면 내용을 붙여 넣어 주세요.')
        setPasteResume(true)
        return
      }
      setResume(text)
      setPdfName(file.name)
      setPasteResume(false)
    } catch (error) {
      setResumeError(pdfErrorMessage(error))
      setPasteResume(true)
    } finally {
      setReadingPdf(false)
    }
  }

  async function readPostingLink(): Promise<string | null> {
    try {
      const response = await fetch(`/api/posting?url=${encodeURIComponent(url.trim())}`)
      const result = (await response.json()) as { ok: true; text: string } | { ok: false; reason: string }
      if (result.ok) return result.text
      setNotice(describePostingFailure(source, result.reason))
    } catch {
      setNotice(describePostingFailure(source, 'fetch_failed'))
    }
    return null
  }

  function choosePaste() {
    setNotice(null)
    setPastePosting(true)
    focusAfterNotice.current = null
  }

  function chooseOtherLink() {
    setNotice(null)
    setUrl('')
    focusAfterNotice.current = urlInput.current
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready) return
    setStartError(null)

    let postingText = posting
    if (!pastePosting) {
      if (source.kind === 'unsupported') {
        setNotice(describePostingFailure(source))
        return
      }
      setStatus('reading-posting')
      const text = await readPostingLink()
      if (text === null) {
        setStatus('idle')
        return
      }
      postingText = text
    }

    setStatus('starting')
    try {
      onStarted(await startRun({ posting: postingText, resume }))
    } catch (error) {
      setStartError(isDailyLimit(error) ? DAILY_LIMIT_DETAIL : '비교를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
      setStatus('idle')
    }
  }

  return (
    <>
      <div className="start">
        <h1>일주일에 3시간만 써도 원하는 이직을 준비할 수 있어요</h1>
        <p className="lead">이력서와 가고 싶은 공고를 비교해서, 지원 전에 꼭 할 일만 정해 드려요.</p>
      </div>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <span className="label">내 이력서</span>
          <div className="file-row">
            <label className="btn-line file-button">
              <input id="resume-file" type="file" accept="application/pdf,.pdf" disabled={readingPdf} onChange={attachPdf} />
              {readingPdf ? 'PDF를 읽고 있어요' : resume.trim() !== '' && !pasteResume ? '다른 PDF를 첨부할게요' : 'PDF를 첨부할게요'}
            </label>
            {pdfName ? <span className="small">{pdfName}</span> : null}
            {!pdfName && resume.trim() !== '' && !pasteResume ? <span className="small">이전에 넣은 이력서를 쓸게요.</span> : null}
            {!pasteResume ? (
              <button className="link-button" type="button" onClick={() => setPasteResume(true)}>
                이력서를 직접 붙여 넣을게요
              </button>
            ) : null}
          </div>
          {resumeError ? (
            <p className="error" role="alert">
              {resumeError}
            </p>
          ) : null}
          {resumeTextError ? (
            <p className="error" role="alert">
              {resumeTextError}
            </p>
          ) : null}
          {pasteResume ? (
            <textarea
              id="resume"
              aria-label="이력서 내용"
              rows={8}
              placeholder="이력서 내용을 붙여 넣어 주세요."
              value={resume}
              onChange={(event) => setResume(event.target.value)}
            />
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="posting-url">가고 싶은 공고</label>
          <input
            id="posting-url"
            ref={urlInput}
            type="url"
            inputMode="url"
            placeholder="https://careers.daangn.com/jobs/role/..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          {source.kind === 'supported' ? <span className="small">{source.name} 공고는 링크로 읽을 수 있어요.</span> : null}
          {source.kind === 'unknown' ? (
            <span className="small">아직 확인하지 않은 사이트예요. 읽지 못하면 본문을 붙여 넣어 달라고 안내할게요.</span>
          ) : null}
          {source.kind === 'unsupported' ? (
            <p className="error" role="status">
              {source.name} 공고는 링크로 읽지 못해요. 공고 본문을 붙여 넣어 주세요.
            </p>
          ) : null}
          {urlError ? (
            <p className="error" role="alert">
              {urlError}
            </p>
          ) : null}
          <dl className="sources">
            <dt>링크로 읽어요</dt>
            <dd>{SUPPORTED.map(({ name }) => name).join(', ')}</dd>
            <dt>붙여 넣어 주세요</dt>
            <dd>{UNSUPPORTED.map(({ name }) => name).join(', ')}</dd>
          </dl>
          {pastePosting ? (
            <textarea
              id="posting"
              ref={postingInput}
              aria-label="공고 본문"
              rows={8}
              placeholder="공고 본문을 붙여 넣어 주세요."
              value={posting}
              onChange={(event) => setPosting(event.target.value)}
            />
          ) : (
            <button className="link-button start-align" type="button" onClick={() => setPastePosting(true)}>
              링크 없이 공고 본문을 붙여 넣을게요
            </button>
          )}
          {postingTextError ? (
            <p className="error" role="alert">
              {postingTextError}
            </p>
          ) : null}
        </div>
        {startError ? (
          <p className="error" role="alert">
            {startError}
          </p>
        ) : null}
        <div>
          <button className="btn" type="submit" disabled={!ready}>
            {status === 'reading-posting' ? '공고를 읽고 있어요' : status === 'starting' ? '비교를 시작하고 있어요' : '내 이력과 비교해 볼게요'}
          </button>
        </div>
      </form>
      {notice ? (
        <PostingFailedModal notice={notice} onPaste={choosePaste} onOtherLink={chooseOtherLink} onClose={() => setNotice(null)} />
      ) : null}
    </>
  )
}
