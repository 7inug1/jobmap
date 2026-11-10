import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSavedRun } from './saved-run.ts'

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

  it('시간이나 끝낸 일 형식이 틀리면 null이다', () => {
    assert.equal(parse({ ...run, weeklyHours: 'three' }), null)
    assert.equal(parse({ ...run, doneTasks: [1] }), null)
  })
})
