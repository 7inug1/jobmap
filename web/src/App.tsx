import { useFlueAgent } from '@flue/react'
import { createFlueClient } from '@flue/sdk'
import { useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { classifyPostingUrl, SUPPORTED, UNSUPPORTED } from './posting-sources.ts'
import { readResumePdf } from './resume-pdf.ts'
import { annotatePosting, applyEdits, readComparison, type EditedRow, type Verdict } from './comparison.ts'

const RUN_KEY = 'jobmap-run'

type Inputs = { posting: string; resume: string }
type Run = Inputs & { id: string; edits: Record<number, Verdict> }

const VERDICTS: { value: Verdict; label: string; className: string }[] = [
  { value: 'met', label: '충족', className: 'ok' },
  { value: 'partial', label: '일부 충족', className: 'part' },
  { value: 'unmet', label: '불충족', className: 'lack' },
]

const MIN_RESUME_LENGTH = 50

const POSTING_ERRORS: Record<string, string> = {
  invalid_url: 'https로 시작하는 공고 주소를 넣어 주세요.',
  fetch_failed: '이 주소를 열지 못했어요. 주소를 확인하거나 본문을 붙여 넣어 주세요.',
  not_html: '웹 페이지 주소만 읽을 수 있어요. 본문을 붙여 넣어 주세요.',
  no_text: '이 페이지에서 공고 글을 찾지 못했어요. 본문을 붙여 넣어 주세요.',
}

function loadRun(): Run | null {
  try {
    const saved = localStorage.getItem(RUN_KEY)
    return saved ? (JSON.parse(saved) as Run) : null
  } catch {
    return null
  }
}

function saveRun(run: Run | null) {
  try {
    if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run))
    else localStorage.removeItem(RUN_KEY)
  } catch {
    // 저장이 막힌 브라우저에서도 지금 화면은 계속 쓸 수 있다.
  }
}

async function startRun(inputs: Inputs): Promise<Run> {
  const id = crypto.randomUUID()
  const client = createFlueClient({ url: new URL(`/agents/jobmap/${id}`, location.origin).href })
  await client.send({ message: { kind: 'user', body: '공고와 이력서를 비교해 주세요' }, initialData: inputs })
  return { ...inputs, id, edits: {} }
}

export default function App() {
  const [run, setRun] = useState(loadRun)
  const [draft, setDraft] = useState<Inputs>({ posting: '', resume: '' })

  function update(next: Run | null) {
    saveRun(next)
    setRun(next)
  }

  function restart(inputs: Inputs) {
    setDraft(inputs)
    update(null)
  }

  return (
    <main className="page">
      {run ? (
        <Comparison key={run.id} run={run} onChange={update} onRestart={() => restart(run)} />
      ) : (
        <Start initial={draft} onStarted={update} />
      )}
    </main>
  )
}

function Start({ initial, onStarted }: { initial: Inputs; onStarted: (run: Run) => void }) {
  const [posting, setPosting] = useState(initial.posting)
  const [resume, setResume] = useState(initial.resume)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const [url, setUrl] = useState('')
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [readingPdf, setReadingPdf] = useState(false)
  const [pdfName, setPdfName] = useState<string | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const source = classifyPostingUrl(url.trim())
  const canLoadUrl = (source.kind === 'supported' || source.kind === 'unknown') && !loadingUrl
  const ready = posting.trim() !== '' && resume.trim() !== '' && !sending

  async function attachPdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setReadingPdf(true)
    setPdfError(null)
    setPdfName(null)
    try {
      const text = await readResumePdf(file)
      if (text.trim().length < MIN_RESUME_LENGTH) {
        setPdfError('PDF에서 글자를 찾지 못했어요. 스캔한 파일이면 내용을 붙여 넣어 주세요.')
        return
      }
      setResume(text)
      setPdfName(file.name)
    } catch {
      setPdfError('PDF를 읽지 못했어요. 내용을 붙여 넣어 주세요.')
    } finally {
      setReadingPdf(false)
    }
  }

  async function loadPosting() {
    if (!canLoadUrl) return
    setLoadingUrl(true)
    setUrlError(null)
    try {
      const response = await fetch(`/api/posting?url=${encodeURIComponent(url.trim())}`)
      const result = (await response.json()) as { ok: true; text: string } | { ok: false; reason: string }
      if (result.ok) setPosting(result.text)
      else setUrlError(POSTING_ERRORS[result.reason])
    } catch {
      setUrlError(POSTING_ERRORS.fetch_failed)
    } finally {
      setLoadingUrl(false)
    }
  }

  function loadOnEnter(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    void loadPosting()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready) return
    setSending(true)
    setFailed(false)
    try {
      onStarted(await startRun({ posting, resume }))
    } catch {
      setFailed(true)
      setSending(false)
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
          <label htmlFor="resume">내 이력서</label>
          <div className="file-row">
            <label className="btn-line file-button">
              <input id="resume-file" type="file" accept="application/pdf,.pdf" disabled={readingPdf} onChange={attachPdf} />
              {readingPdf ? '읽는 중' : 'PDF 첨부'}
            </label>
            {pdfName ? <span className="small">{pdfName}에서 글자를 가져왔어요. 틀린 곳은 고쳐 주세요.</span> : null}
          </div>
          {pdfError ? (
            <p className="error" role="alert">
              {pdfError}
            </p>
          ) : null}
          <textarea
            id="resume"
            rows={8}
            placeholder="PDF를 첨부하면 내용이 여기에 들어와요. 직접 붙여 넣어도 돼요."
            value={resume}
            onChange={(event) => setResume(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="posting-url">가고 싶은 공고</label>
          <div className="url-row">
            <input
              id="posting-url"
              type="url"
              inputMode="url"
              placeholder="https://careers.daangn.com/jobs/role/..."
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={loadOnEnter}
            />
            <button className="btn-line" type="button" disabled={!canLoadUrl} onClick={loadPosting}>
              {loadingUrl ? '불러오는 중' : '불러오기'}
            </button>
          </div>
          {source.kind === 'supported' ? <span className="small">{source.name} 공고는 링크로 읽을 수 있어요.</span> : null}
          {source.kind === 'unknown' ? (
            <span className="small">아직 확인하지 않은 사이트예요. 불러와 보고, 안 되면 본문을 붙여 넣어 주세요.</span>
          ) : null}
          {source.kind === 'unsupported' ? (
            <p className="error" role="status">
              {source.name} 공고는 링크로 읽지 못해요. 공고 본문을 아래에 붙여 넣어 주세요.
            </p>
          ) : null}
          <dl className="sources">
            <dt>링크로 읽어요</dt>
            <dd>{SUPPORTED.map(({ name }) => name).join(', ')}</dd>
            <dt>붙여 넣어 주세요</dt>
            <dd>{UNSUPPORTED.map(({ name }) => name).join(', ')}</dd>
          </dl>
          {urlError ? (
            <p className="error" role="alert">
              {urlError}
            </p>
          ) : null}
          <textarea
            id="posting"
            aria-label="공고 본문"
            rows={8}
            placeholder="링크를 불러오면 본문이 여기에 들어와요. 직접 붙여 넣어도 돼요."
            value={posting}
            onChange={(event) => setPosting(event.target.value)}
          />
          <span className="small">불러온 글에서 공고와 상관없는 부분은 지워도 돼요.</span>
        </div>
        {failed ? (
          <p className="error" role="alert">
            비교를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.
          </p>
        ) : null}
        <div>
          <button className="btn" type="submit" disabled={!ready}>
            {sending ? '시작하는 중' : '내 이력과 비교해 보기'}
          </button>
        </div>
      </form>
    </>
  )
}

function Comparison({
  run,
  onChange,
  onRestart,
}: {
  run: Run
  onChange: (run: Run) => void
  onRestart: () => void
}) {
  const agent = useFlueAgent({ url: `/agents/jobmap/${run.id}` })
  const view = readComparison(agent.messages, agent.settlements, agent.status)

  if (view.phase === 'working') return <Working step={view.step} />
  if (view.phase === 'failed') return <Failed run={run} onChange={onChange} onRestart={onRestart} />

  const rows = applyEdits(view.rows, run.edits)
  return (
    <Result
      posting={run.posting}
      rows={rows}
      onVerdict={(index, verdict) => onChange({ ...run, edits: { ...run.edits, [index]: verdict } })}
      onRestart={onRestart}
    />
  )
}

function Working({ step }: { step: string | null }) {
  return (
    <>
      <div className="head">
        <h1>이력서와 공고를 비교하고 있어요</h1>
      </div>
      <div className="work-steps" role="status">
        <div className={`work-step ${step ? 'done' : 'on'}`}>
          <span className="icon">{step ? '✓' : <span className="dot" />}</span>
          <b>요건별로 이력서 살펴보기</b>
        </div>
        <div className={`work-step ${step ? 'on' : ''}`}>
          <span className="icon">{step ? <span className="dot" /> : null}</span>
          <b>근거 문장이 원문에 있는지 확인하기</b>
        </div>
      </div>
    </>
  )
}

function Failed({
  run,
  onChange,
  onRestart,
}: {
  run: Run
  onChange: (run: Run) => void
  onRestart: () => void
}) {
  const [sending, setSending] = useState(false)

  async function retry() {
    setSending(true)
    try {
      onChange(await startRun(run))
    } catch {
      setSending(false)
    }
  }

  return (
    <>
      <div className="head">
        <h1>비교를 끝내지 못했어요</h1>
        <span className="lead-line">근거 문장을 원문에서 확인하지 못했거나 연결이 끊겼어요.</span>
      </div>
      <div className="actions-row">
        <button className="btn" type="button" disabled={sending} onClick={retry}>
          {sending ? '시작하는 중' : '다시 시도하기'}
        </button>
        <button className="btn-line" type="button" onClick={onRestart}>
          입력 고치기
        </button>
      </div>
    </>
  )
}

function Result({
  posting,
  rows,
  onVerdict,
  onRestart,
}: {
  posting: string
  rows: EditedRow[]
  onVerdict: (index: number, verdict: Verdict) => void
  onRestart: () => void
}) {
  const { lines, unplaced } = annotatePosting(posting, rows)
  const met = rows.filter((row) => row.verdict === 'met').length
  const annotation = (index: number) => (
    <Annotation key={index} row={rows[index]} onVerdict={(verdict) => onVerdict(index, verdict)} />
  )

  return (
    <>
      <div className="head">
        <h1>
          요건 {rows.length}개 중 {met}개를 충족해요
        </h1>
        <span className="lead-line">공고를 읽으면서 판단이 다르면 직접 바꿔 주세요.</span>
      </div>
      <div className="sum">
        {VERDICTS.map(({ value, label, className }) => (
          <span key={value} className={`pill ${className}`}>
            {label} {rows.filter((row) => row.verdict === value).length}
          </span>
        ))}
      </div>
      <article className="posting-doc">
        {lines.map((line, index) => (
          <div className="posting-item" key={index}>
            <p>{line.text.replace(/^- /, '')}</p>
            {line.rowIndexes.map(annotation)}
          </div>
        ))}
        {unplaced.length > 0 ? (
          <div className="posting-item">
            <h3>그 외 요건</h3>
            {unplaced.map(annotation)}
          </div>
        ) : null}
      </article>
      <div className="actions-row">
        <button className="btn-line" type="button" onClick={onRestart}>
          다른 공고로 비교하기
        </button>
      </div>
    </>
  )
}

function Annotation({ row, onVerdict }: { row: EditedRow; onVerdict: (verdict: Verdict) => void }) {
  const edited = row.verdict !== row.aiVerdict
  const original = VERDICTS.find(({ value }) => value === row.aiVerdict)?.label

  return (
    <div className="anno">
      <div className="anno-top">
        <b>{row.requirement}</b>
        <div className="verdicts" role="group" aria-label={`${row.requirement} 판단`}>
          {VERDICTS.map(({ value, label, className }) => (
            <button
              key={value}
              type="button"
              className={`verdict v-${className}`}
              aria-pressed={row.verdict === value}
              onClick={() => onVerdict(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <span>{row.resumeQuote ?? '이력서에서 근거를 찾지 못했어요.'}</span>
      {edited ? <span className="small">처음에는 {original}(으)로 봤어요.</span> : null}
    </div>
  )
}
