import { useState, type ChangeEvent, type FormEvent } from 'react'
import { startRun } from '../../shared/start-run.ts'
import type { Inputs, Run } from '../../shared/types.ts'
import { classifyPostingUrl, SUPPORTED, UNSUPPORTED } from './posting-sources.ts'
import { readResumePdf } from './resume-pdf.ts'

const MIN_RESUME_LENGTH = 50

const POSTING_ERRORS: Record<string, string> = {
  invalid_url: 'https로 시작하는 공고 주소를 넣어 주세요.',
  fetch_failed: '이 주소를 열지 못했어요. 주소를 확인하거나 본문을 붙여 넣어 주세요.',
  not_html: '웹 페이지 주소만 읽을 수 있어요. 본문을 붙여 넣어 주세요.',
  no_text: '이 페이지에서 공고 글을 찾지 못했어요. 본문을 붙여 넣어 주세요.',
}

export function Start({ initial, onStarted }: { initial: Inputs; onStarted: (run: Run) => void }) {
  const [resume, setResume] = useState(initial.resume)
  const [pdfName, setPdfName] = useState<string | null>(null)
  const [readingPdf, setReadingPdf] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const [pasteResume, setPasteResume] = useState(false)

  const [url, setUrl] = useState('')
  const [posting, setPosting] = useState(initial.posting)
  const [postingError, setPostingError] = useState<string | null>(null)
  const [pastePosting, setPastePosting] = useState(initial.posting !== '')

  const [status, setStatus] = useState<'idle' | 'reading-posting' | 'starting'>('idle')
  const [failed, setFailed] = useState(false)

  const source = classifyPostingUrl(url.trim())
  const urlIsReadable = source.kind === 'supported' || source.kind === 'unknown'
  const showPosting = pastePosting || source.kind === 'unsupported'
  const hasPosting = showPosting ? posting.trim() !== '' : urlIsReadable
  const ready = resume.trim() !== '' && hasPosting && !readingPdf && status === 'idle'

  async function attachPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setReadingPdf(true)
    setResumeError(null)
    setPdfName(null)
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
    } catch {
      setResumeError('PDF를 읽지 못했어요. 내용을 붙여 넣어 주세요.')
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
      setPostingError(POSTING_ERRORS[result.reason])
    } catch {
      setPostingError(POSTING_ERRORS.fetch_failed)
    }
    setPastePosting(true)
    return null
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready) return
    setFailed(false)
    setPostingError(null)

    let postingText = posting
    if (!showPosting) {
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
    } catch {
      setFailed(true)
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
              {readingPdf ? '읽는 중' : resume.trim() !== '' && !pasteResume ? '다른 PDF 첨부' : 'PDF 첨부'}
            </label>
            {pdfName ? <span className="small">{pdfName}</span> : null}
            {!pdfName && resume.trim() !== '' && !pasteResume ? <span className="small">이전에 넣은 이력서를 쓸게요.</span> : null}
            {!pasteResume ? (
              <button className="link-button" type="button" onClick={() => setPasteResume(true)}>
                직접 붙여 넣기
              </button>
            ) : null}
          </div>
          {resumeError ? (
            <p className="error" role="alert">
              {resumeError}
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
            type="url"
            inputMode="url"
            placeholder="https://careers.daangn.com/jobs/role/..."
            value={url}
            onChange={(event) => {
              setUrl(event.target.value)
              setPostingError(null)
            }}
          />
          {source.kind === 'supported' ? <span className="small">{source.name} 공고는 링크로 읽을 수 있어요.</span> : null}
          {source.kind === 'unknown' ? (
            <span className="small">아직 확인하지 않은 사이트예요. 읽지 못하면 본문을 붙여 넣어 달라고 안내할게요.</span>
          ) : null}
          {source.kind === 'unsupported' ? (
            <p className="error" role="status">
              {source.name} 공고는 링크로 읽지 못해요. 공고 본문을 아래에 붙여 넣어 주세요.
            </p>
          ) : null}
          {postingError ? (
            <p className="error" role="alert">
              {postingError}
            </p>
          ) : null}
          <dl className="sources">
            <dt>링크로 읽어요</dt>
            <dd>{SUPPORTED.map(({ name }) => name).join(', ')}</dd>
            <dt>붙여 넣어 주세요</dt>
            <dd>{UNSUPPORTED.map(({ name }) => name).join(', ')}</dd>
          </dl>
          {showPosting ? (
            <textarea
              id="posting"
              aria-label="공고 본문"
              rows={8}
              placeholder="공고 본문을 붙여 넣어 주세요."
              value={posting}
              onChange={(event) => setPosting(event.target.value)}
            />
          ) : (
            <button className="link-button start-align" type="button" onClick={() => setPastePosting(true)}>
              링크 없이 본문 붙여 넣기
            </button>
          )}
        </div>
        {failed ? (
          <p className="error" role="alert">
            비교를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.
          </p>
        ) : null}
        <div>
          <button className="btn" type="submit" disabled={!ready}>
            {status === 'reading-posting' ? '공고 읽는 중' : status === 'starting' ? '시작하는 중' : '내 이력과 비교해 보기'}
          </button>
        </div>
      </form>
    </>
  )
}
