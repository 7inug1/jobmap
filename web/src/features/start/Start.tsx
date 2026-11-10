import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import { DAILY_LIMIT_DETAIL, isDailyLimit } from '../../shared/failure-reasons.ts'
import { ProgressSteps, type Step } from '../../shared/ProgressSteps.tsx'
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
  const [dragging, setDragging] = useState(false)

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
  const resumeDone = resume.trim() !== '' && !resumeTextError && !readingPdf
  const ready = resumeDone && hasPosting && status === 'idle'

  // 모달이 화면에서 사라진 뒤에 옮겨야 브라우저의 포커스 복원과 겹치지 않는다.
  useEffect(() => {
    if (notice || focusAfterNotice.current === undefined) return
    const target = focusAfterNotice.current ?? postingInput.current
    focusAfterNotice.current = undefined
    target?.focus()
  }, [notice])

  function attachPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void readPdfFile(file)
  }

  function dropPdf(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (file && !readingPdf) void readPdfFile(file)
  }

  async function readPdfFile(file: File) {
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

  const errorLine = (message: string | null) =>
    message ? (
      <p className="error" role="alert">
        {message}
      </p>
    ) : null

  if (status !== 'idle') {
    const steps: Step[] = [
      { label: `이력서에서 글자 ${resume.trim().length.toLocaleString('ko-KR')}자를 읽고 길이를 확인했어요.`, state: 'done' },
      pastePosting
        ? { label: `붙여 넣은 공고 본문 ${posting.trim().length.toLocaleString('ko-KR')}자를 확인했어요.`, state: 'done' }
        : status === 'reading-posting'
          ? { label: '공고 링크를 열고 지원 요건이 들어 있는지 확인하고 있어요.', state: 'on' }
          : { label: '공고 본문을 읽고 지원 요건이 들어 있는 것을 확인했어요.', state: 'done' },
      status === 'starting'
        ? { label: 'AI에게 비교를 맡기고 있어요.', state: 'on' }
        : { label: 'AI에게 비교를 맡길게요.', state: 'wait' },
    ]
    return (
      <>
        <div className="head">
          <h1>이력서와 공고를 비교하고 있어요</h1>
        </div>
        <ProgressSteps steps={steps} />
      </>
    )
  }

  return (
    <>
      <div className="start">
        <h1>일주일에 3시간만 써도 원하는 이직을 준비할 수 있어요</h1>
        <p className="lead">이력서 PDF와 가고 싶은 공고 링크, 이 두 가지만 넣어 주세요. 무엇부터 할지는 잡맵이 정해 드려요.</p>
      </div>
      <form className="intake" onSubmit={submit}>
        <section className={`step-card${resumeDone ? ' is-done' : ''}`} aria-labelledby="step-resume">
          <div className="step-head">
            <span className="step-no" aria-hidden="true">
              {resumeDone ? '✓' : '1'}
            </span>
            <h2 id="step-resume">내 이력서</h2>
          </div>
          {pasteResume ? (
            <textarea
              id="resume"
              aria-label="이력서 내용"
              rows={8}
              placeholder="이력서 내용을 붙여 넣어 주세요."
              value={resume}
              onChange={(event) => setResume(event.target.value)}
            />
          ) : (
            <label
              className={`drop${dragging ? ' is-over' : ''}`}
              aria-busy={readingPdf}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={dropPdf}
            >
              <input id="resume-file" type="file" accept="application/pdf,.pdf" disabled={readingPdf} onChange={attachPdf} />
              <span className="drop-icon" aria-hidden="true">
                {readingPdf ? (
                  <span className="spinner" />
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5" />
                    {resumeDone ? <path d="m9 14 2 2 4-4" /> : <path d="M12 17v-6m-3 3 3-3 3 3" />}
                  </svg>
                )}
              </span>
              <b>
                {readingPdf
                  ? 'PDF를 읽고 있어요.'
                  : pdfName
                    ? pdfName
                    : resume.trim() !== ''
                      ? '이전에 넣은 이력서를 쓸게요.'
                      : 'PDF를 첨부할게요.'}
              </b>
              <span className="small">
                {pdfName || resume.trim() !== ''
                  ? '다른 PDF로 바꾸려면 여기를 눌러 주세요.'
                  : '여기를 누르거나 PDF 파일을 끌어다 놓아 주세요.'}
              </span>
            </label>
          )}
          {errorLine(resumeError)}
          {errorLine(resumeTextError)}
          <button className="link-button start-align" type="button" onClick={() => setPasteResume(!pasteResume)}>
            {pasteResume ? 'PDF로 첨부할게요' : '이력서를 직접 붙여 넣을게요'}
          </button>
        </section>

        <section className={`step-card${hasPosting ? ' is-done' : ''}`} aria-labelledby="step-posting">
          <div className="step-head">
            <span className="step-no" aria-hidden="true">
              {hasPosting ? '✓' : '2'}
            </span>
            <h2 id="step-posting">가고 싶은 공고</h2>
          </div>
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
            <>
              <input
                id="posting-url"
                ref={urlInput}
                type="url"
                inputMode="url"
                aria-label="공고 링크"
                placeholder="공고 링크를 붙여 넣어 주세요."
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
              {errorLine(urlError)}
            </>
          )}
          {errorLine(postingTextError)}
          <div className="step-links">
            <button className="link-button" type="button" onClick={() => setPastePosting(!pastePosting)}>
              {pastePosting ? '공고 링크를 넣을게요' : '링크 없이 공고 본문을 붙여 넣을게요'}
            </button>
            <details className="sources-fold">
              <summary>링크로 읽을 수 있는 사이트를 볼게요</summary>
              <dl className="sources">
                <dt>링크로 읽어요</dt>
                <dd>{SUPPORTED.map(({ name }) => name).join(', ')}</dd>
                <dt>붙여 넣어 주세요</dt>
                <dd>{UNSUPPORTED.map(({ name }) => name).join(', ')}</dd>
              </dl>
            </details>
          </div>
        </section>

        {errorLine(startError)}
        <div className="submit-row">
          <button className="btn btn-wide" type="submit" disabled={!ready}>
            내 이력과 비교해 볼게요
          </button>
          <span className="small">
            {ready ? '비교가 끝나면 부족한 부분을 채울 방법을 보여 드려요.' : '두 가지를 모두 넣으면 비교를 시작할 수 있어요.'}
          </span>
        </div>
      </form>
      {notice ? (
        <PostingFailedModal notice={notice} onPaste={choosePaste} onOtherLink={chooseOtherLink} onClose={() => setNotice(null)} />
      ) : null}
    </>
  )
}
