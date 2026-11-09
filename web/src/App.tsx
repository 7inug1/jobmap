import { useFlueAgent } from '@flue/react'
import { createFlueClient } from '@flue/sdk'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { classifyPostingUrl, SUPPORTED, UNSUPPORTED } from './posting-sources.ts'
import { readResumePdf } from './resume-pdf.ts'
import {
  annotatePosting,
  applyEdits,
  buildWeekPlan,
  gapsFromRows,
  pickKey,
  readComparison,
  recommendedPicks,
  summarizePicks,
  type Direction,
  type DirectionOption,
  type EditedRow,
  type Gap,
  type Verdict,
  type WeekTask,
} from './comparison.ts'

const RUN_KEY = 'jobmap-run'

type Inputs = { posting: string; resume: string }
type DirectionsRun = { gaps: Gap[]; directions: Direction[]; picks: string[] }
type Run = Inputs & {
  id: string
  edits: Record<number, Verdict>
  stage?: 'directions' | 'plan'
  directions?: DirectionsRun
  weeklyHours?: number
  doneTasks?: string[]
}

// 서비스의 기본 약속. 이번 주 할 일 화면에서 바꿀 수 있다.
const DEFAULT_WEEKLY_HOURS = 3
const WEEKLY_HOUR_CHOICES = [1, 2, 3, 5, 8, 10, 15, 20]

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

async function fetchDirections(gaps: Gap[], resume: string): Promise<Direction[]> {
  const response = await fetch('/api/directions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gaps, resume }),
  })
  const result = (await response.json()) as { ok: true; directions: Direction[] } | { ok: false }
  if (!result.ok) throw new Error('directions_failed')
  return result.directions
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

  async function openDirections(gaps: Gap[]) {
    if (run.directions && JSON.stringify(run.directions.gaps) === JSON.stringify(gaps)) {
      onChange({ ...run, stage: 'directions' })
      return
    }
    const directions = await fetchDirections(gaps, run.resume)
    onChange({ ...run, stage: 'directions', directions: { gaps, directions, picks: [] } })
  }

  if (run.stage === 'plan' && run.directions) {
    return (
      <WeekPlan
        directions={run.directions.directions}
        picks={run.directions.picks}
        doneKeys={run.doneTasks ?? []}
        weeklyHours={run.weeklyHours ?? DEFAULT_WEEKLY_HOURS}
        onDone={(doneTasks) => onChange({ ...run, doneTasks })}
        onWeeklyHours={(weeklyHours) => onChange({ ...run, weeklyHours })}
        onBack={() => onChange({ ...run, stage: 'directions' })}
        onRestart={onRestart}
      />
    )
  }
  if (run.stage === 'directions' && run.directions) {
    const saved = run.directions
    return (
      <DirectionPicker
        directions={saved.directions}
        picks={saved.picks}
        weeklyHours={run.weeklyHours ?? DEFAULT_WEEKLY_HOURS}
        onPicks={(picks) => onChange({ ...run, directions: { ...saved, picks } })}
        onConfirm={() => onChange({ ...run, stage: 'plan' })}
        onBack={() => onChange({ ...run, stage: undefined })}
      />
    )
  }
  if (view.phase === 'working') return <Working step={view.step} />
  if (view.phase === 'failed') return <Failed run={run} onChange={onChange} onRestart={onRestart} />

  const rows = applyEdits(view.rows, run.edits)
  return (
    <Result
      posting={run.posting}
      rows={rows}
      onVerdict={(index, verdict) => onChange({ ...run, edits: { ...run.edits, [index]: verdict } })}
      onNext={openDirections}
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
  onNext,
  onRestart,
}: {
  posting: string
  rows: EditedRow[]
  onVerdict: (index: number, verdict: Verdict) => void
  onNext: (gaps: Gap[]) => Promise<void>
  onRestart: () => void
}) {
  const [opening, setOpening] = useState(false)
  const [openFailed, setOpenFailed] = useState(false)
  const gaps = gapsFromRows(rows)

  async function next() {
    setOpening(true)
    setOpenFailed(false)
    try {
      await onNext(gaps)
    } catch {
      setOpenFailed(true)
      setOpening(false)
    }
  }

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
      {openFailed ? (
        <p className="error" role="alert">
          채울 방법을 정리하지 못했어요. 다시 눌러 주세요.
        </p>
      ) : null}
      {gaps.length === 0 ? <p className="lead-line">부족한 요건이 없어요. 바로 지원해 봐도 좋아요.</p> : null}
      <div className="actions-row">
        {gaps.length > 0 ? (
          <button className="btn" type="button" disabled={opening} onClick={next}>
            {opening ? '채울 방법을 정리하는 중' : '다음으로'}
          </button>
        ) : null}
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

function DirectionPicker({
  directions,
  picks,
  weeklyHours,
  onPicks,
  onConfirm,
  onBack,
}: {
  directions: Direction[]
  picks: string[]
  weeklyHours: number
  onPicks: (picks: string[]) => void
  onConfirm: () => void
  onBack: () => void
}) {
  const { studyHours, projectHours, weeks } = summarizePicks(directions, picks, weeklyHours)
  const toggle = (key: string) => onPicks(picks.includes(key) ? picks.filter((pick) => pick !== key) : [...picks, key])
  const basket = (lane: DirectionOption['lane']) =>
    directions.flatMap(({ gapNumber, options }) =>
      options.flatMap((option, index) => {
        const key = pickKey(gapNumber, index)
        return option.lane === lane && picks.includes(key) ? [{ key, label: option.label }] : []
      }),
    )
  const basketColumn = (lane: DirectionOption['lane'], title: string, empty: string) => (
    <div className="basket-col">
      <span className="tag">{title}</span>
      {basket(lane).map(({ key, label }) => (
        <button key={key} className="basket-item" type="button" aria-label={`${label} 빼기`} onClick={() => toggle(key)}>
          {label} ✕
        </button>
      ))}
      {basket(lane).length === 0 ? <span className="small">{empty}</span> : null}
    </div>
  )

  return (
    <>
      <div className="head">
        <h1>부족한 부분, 어떻게 채워 볼까요?</h1>
        <span className="lead-line">하고 싶은 것만 고르세요. 공부와 프로젝트를 함께 골라도 좋아요.</span>
      </div>
      <section className="basket" aria-live="polite">
        {basketColumn('study', '지식에 남아요', '공부를 고르면 담겨요.')}
        {basketColumn('project', '이력서에 남아요', '프로젝트를 고르면 담겨요.')}
      </section>
      {directions.map(({ gapNumber, requirement, options }) => (
        <section className="dir-card" key={gapNumber}>
          <h2>{requirement}</h2>
          <div className="dir-options">
            {options.map((option, index) => {
              const key = pickKey(gapNumber, index)
              return (
                <button key={key} className="dir-option" type="button" aria-pressed={picks.includes(key)} onClick={() => toggle(key)}>
                  <span className="dir-title">
                    <span className="tick" aria-hidden="true">
                      {picks.includes(key) ? '✓' : ''}
                    </span>
                    <b>{option.label}</b>
                    {option.recommended ? <span className="pill rec">추천</span> : null}
                  </span>
                  <span className="small">{option.description}</span>
                  <span className="small">
                    {option.lane === 'study' ? '공부' : '프로젝트'}, 약 {option.hours}시간
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
      <p className="lead-line">
        {picks.length > 0
          ? `이력서 ${projectHours}시간, 공부 ${studyHours}시간이에요. 일주일 ${weeklyHours}시간이면 약 ${weeks}주 걸려요.`
          : '고르지 않은 항목은 이번에 하지 않아요.'}
      </p>
      <div className="actions-row">
        {picks.length === 0 ? (
          <button className="btn-line" type="button" onClick={() => onPicks(recommendedPicks(directions))}>
            추천대로 고르기
          </button>
        ) : null}
        <button className="btn" type="button" disabled={picks.length === 0} onClick={onConfirm}>
          이대로 할게요
        </button>
        <button className="btn-line" type="button" onClick={onBack}>
          비교 결과로 돌아가기
        </button>
      </div>
    </>
  )
}

function WeekPlan({
  directions,
  picks,
  doneKeys,
  weeklyHours,
  onDone,
  onWeeklyHours,
  onBack,
  onRestart,
}: {
  directions: Direction[]
  picks: string[]
  doneKeys: string[]
  weeklyHours: number
  onDone: (doneKeys: string[]) => void
  onWeeklyHours: (hours: number) => void
  onBack: () => void
  onRestart: () => void
}) {
  const { thisWeek, later, done, hoursThisWeek, weeksLeft } = buildWeekPlan(directions, picks, doneKeys, weeklyHours)
  const toggle = (key: string) => onDone(doneKeys.includes(key) ? doneKeys.filter((item) => item !== key) : [...doneKeys, key])
  const finished = thisWeek.length === 0

  const row = (task: WeekTask, checkable: boolean) => (
    <li className={`task${doneKeys.includes(task.key) ? ' done' : ''}`} key={task.key}>
      {checkable ? (
        <input
          type="checkbox"
          aria-label={`${task.label} 완료`}
          checked={doneKeys.includes(task.key)}
          onChange={() => toggle(task.key)}
        />
      ) : (
        <span aria-hidden="true" />
      )}
      <div className="task-body">
        <b>{task.label}</b>
        <span className="small">{task.description}</span>
        <span className="small">
          {task.lane === 'study' ? '공부' : '프로젝트'}, 약 {task.hours}시간. 채우는 요건: {task.requirement}
        </span>
      </div>
    </li>
  )

  return (
    <>
      <div className="head">
        <h1>{finished ? '고른 일을 모두 끝냈어요' : '이번 주에는 이것만 하면 돼요'}</h1>
        <span className="lead-line">
          {finished ? '수고했어요. 이제 지원해 봐도 좋아요.' : `약 ${hoursThisWeek}시간이에요. 이 속도면 ${weeksLeft}주 뒤에 고른 일을 다 끝내요.`}
        </span>
      </div>
      <label className="hours-field">
        일주일에 쓸 수 있는 시간
        <select value={weeklyHours} onChange={(event) => onWeeklyHours(Number(event.target.value))}>
          {WEEKLY_HOUR_CHOICES.map((hours) => (
            <option key={hours} value={hours}>
              {hours}시간
            </option>
          ))}
        </select>
      </label>
      {finished ? null : <ul className="task-list">{thisWeek.map((task) => row(task, true))}</ul>}
      {later.length > 0 ? (
        <section className="task-section">
          <h2>다음에 할 일</h2>
          <ul className="task-list">{later.map((task) => row(task, false))}</ul>
        </section>
      ) : null}
      {done.length > 0 ? (
        <section className="task-section">
          <h2>끝낸 일</h2>
          <ul className="task-list">{done.map((task) => row(task, true))}</ul>
        </section>
      ) : null}
      <div className="actions-row">
        <button className="btn-line" type="button" onClick={onBack}>
          방향 다시 고르기
        </button>
        <button className="btn-line" type="button" onClick={onRestart}>
          다른 공고로 비교하기
        </button>
      </div>
    </>
  )
}
