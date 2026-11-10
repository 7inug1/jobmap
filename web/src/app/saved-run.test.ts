import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSavedRun, parseSavedRuns } from './saved-run.ts'

const run = { id: 'a', posting: '공고', resume: '이력서', edits: { 0: 'met' } }
const direction = {
  gapNumber: 1,
  requirement: 'A',
  verdict: 'unmet',
  options: [{ label: '공부', description: '', lane: 'study', hours: 2, recommended: true }],
}
const gap = { requirement: 'A', verdict: 'unmet' }
const parse = (value: unknown) => parseSavedRun(JSON.stringify(value))

describe('parseSavedRun', () => {
  it('없으면 null이다', () => {
    assert.equal(parseSavedRun(null), null)
  })

  it('JSON이 깨졌으면 null이다', () => {
    assert.equal(parseSavedRun('{'), null)
  })

  it('정상 기록을 복원한다', () => {
    assert.deepEqual(parse(run), run)
  })

  it('방향과 할 일까지 저장된 기록을 복원한다', () => {
    const full = { ...run, stage: 'plan', directions: { gaps: [gap], directions: [direction], picks: ['1:0'] }, weeklyHours: 3, doneTasks: ['1:0'], retries: 1 }
    assert.deepEqual(parse(full), full)
  })

  it('필수 값이 없으면 null이다', () => {
    assert.equal(parse({ id: 'a', posting: '공고', edits: {} }), null)
    assert.equal(parse([]), null)
  })

  it('없는 판단이나 단계가 있으면 null이다', () => {
    assert.equal(parse({ ...run, edits: { 0: 'maybe' } }), null)
    assert.equal(parse({ ...run, stage: 'done' }), null)
  })

  it('방향 형식이 틀리면 null이다', () => {
    assert.equal(parse({ ...run, directions: { gaps: [gap], directions: [{ ...direction, options: 'x' }], picks: [] } }), null)
    assert.equal(parse({ ...run, directions: { gaps: [gap], directions: [direction] } }), null)
  })

  it('해낸 시간 기록을 복원한다', () => {
    const withRecords = { ...run, completions: [{ key: '1:0', hours: 3 }] }
    assert.deepEqual(parse(withRecords), withRecords)
  })

  it('검사를 마친 판단을 복원한다', () => {
    const rows = [{ requirement: 'A', verdict: 'met', postingQuote: '공고', resumeQuote: null }]
    assert.deepEqual(parse({ ...run, rows }), { ...run, rows })
  })

  it('이력서 문장을 복원한다', () => {
    const items = [{ key: '1:1', requirement: 'A', label: '방법', hours: 2, sentence: '문장 {결과}', steps: ['할 일'], after: null, ticked: [], answers: {}, done: false }]
    assert.deepEqual(parse({ ...run, sentences: { items, confirmed: true } }), { ...run, sentences: { items, confirmed: true } })
  })

  it('이력서 문장 형식이 틀리면 null이다', () => {
    assert.equal(parse({ ...run, sentences: { items: [{ key: 1 }], confirmed: true } }), null)
    assert.equal(parse({ ...run, sentences: { items: [], confirmed: 'yes' } }), null)
  })

  it('해당 없음으로 뺀 요건을 복원한다', () => {
    assert.deepEqual(parse({ ...run, skippedGaps: ['A'] }), { ...run, skippedGaps: ['A'] })
    assert.equal(parse({ ...run, skippedGaps: [1] }), null)
  })

  it('판단 형식이 틀리면 null이다', () => {
    assert.equal(parse({ ...run, rows: [{ requirement: 'A', verdict: 'maybe', postingQuote: '공고', resumeQuote: null }] }), null)
  })

  it('해낸 시간 기록 형식이 틀리면 null이다', () => {
    assert.equal(parse({ ...run, completions: [{ key: '1:0' }] }), null)
  })

  it('시간이나 끝낸 일 형식이 틀리면 null이다', () => {
    assert.equal(parse({ ...run, weeklyHours: 'three' }), null)
    assert.equal(parse({ ...run, doneTasks: [1] }), null)
  })
})

describe('parseSavedRuns', () => {
  it('없거나 깨졌으면 빈 목록이다', () => {
    assert.deepEqual(parseSavedRuns(null), [])
    assert.deepEqual(parseSavedRuns('{'), [])
    assert.deepEqual(parseSavedRuns('{"id":"a"}'), [])
  })

  it('정상 기록만 남기고 틀린 항목은 버린다', () => {
    assert.deepEqual(parseSavedRuns(JSON.stringify([run, { id: 1 }, { ...run, id: 'b' }])).map(({ id }) => id), ['a', 'b'])
  })

  it('만든 시각을 복원한다', () => {
    assert.equal(parseSavedRuns(JSON.stringify([{ ...run, createdAt: 123 }]))[0]!.createdAt, 123)
    assert.deepEqual(parseSavedRuns(JSON.stringify([{ ...run, createdAt: 'x' }])), [])
  })
})

