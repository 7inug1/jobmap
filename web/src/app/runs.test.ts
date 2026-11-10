import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Row, Run } from '../shared/types.ts'
import { guardStep, MAX_RUNS, postingTitle, pruneRuns, removeRun, runPath, summarizeRun, upsertRun } from './runs.ts'

const rows: Row[] = [
  { requirement: 'A', verdict: 'met', postingQuote: '가', resumeQuote: '나' },
  { requirement: 'B', verdict: 'unmet', postingQuote: '다', resumeQuote: null },
  { requirement: 'C', verdict: 'partial', postingQuote: '라', resumeQuote: '마' },
]
const base = (id: string, extra: Partial<Run> = {}): Run => ({ id, posting: '공고', resume: '이력서', edits: {}, ...extra })
const direction = { gapNumber: 1, requirement: 'B', verdict: 'unmet' as const, options: [] }
const withDirections = (id: string, picks: string[]) => base(id, { rows, directions: { gaps: [], directions: [direction], picks } })

describe('runPath', () => {
  it('단계마다 주소가 다르다', () => {
    assert.equal(runPath('a'), '/runs/a')
    assert.equal(runPath('a', 'directions'), '/runs/a/directions')
    assert.equal(runPath('a', 'plan'), '/runs/a/plan')
    assert.equal(runPath('a', 'resume'), '/runs/a/resume')
  })
})

describe('postingTitle', () => {
  it('첫 제목(#)이 있으면 그것을 쓴다', () => {
    assert.equal(postingTitle('Back to jobs\n# Front End Engineer\n## About'), 'Front End Engineer')
  })

  it('제목이 없으면 첫 줄을 쓴다', () => {
    assert.equal(postingTitle('\nSoftware Engineer, Frontend - 로컬 잡스\n- 당근'), 'Software Engineer, Frontend - 로컬 잡스')
  })

  it('목록 기호는 떼고 60자를 넘으면 줄인다', () => {
    assert.equal(postingTitle('- ' + '가'.repeat(80)), `${'가'.repeat(60)}…`)
  })

  it('내용이 없으면 이름 없는 공고라고 한다', () => {
    assert.equal(postingTitle('  \n '), '이름 없는 공고')
  })
})

describe('upsertRun', () => {
  it('새 기록은 맨 앞에 둔다', () => {
    assert.deepEqual(upsertRun([base('a')], base('b')).map(({ id }) => id), ['b', 'a'])
  })

  it('있는 기록은 자리를 지키고 내용만 바꾼다', () => {
    const runs = [base('b'), base('a')]
    const next = upsertRun(runs, base('a', { weeklyHours: 5 }))
    assert.deepEqual(next.map(({ id }) => id), ['b', 'a'])
    assert.equal(next[1]!.weeklyHours, 5)
  })

  it('가장 오래된 기록부터 넘치는 만큼 버린다', () => {
    const runs = Array.from({ length: MAX_RUNS }, (_, index) => base(`r${index}`))
    const next = upsertRun(runs, base('new'))
    assert.equal(next.length, MAX_RUNS)
    assert.equal(next[0]!.id, 'new')
    assert.equal(next.some(({ id }) => id === `r${MAX_RUNS - 1}`), false)
  })
})

describe('removeRun', () => {
  it('그 기록만 지운다', () => {
    assert.deepEqual(removeRun([base('a'), base('b')], 'a').map(({ id }) => id), ['b'])
  })
})

describe('pruneRuns', () => {
  const DAY = 24 * 60 * 60 * 1000
  it('비교를 끝내지 못한 하루 지난 기록은 버린다', () => {
    const runs = [base('old', { createdAt: 0 }), base('fresh', { createdAt: 2 * DAY }), base('done', { createdAt: 0, rows })]
    assert.deepEqual(pruneRuns(runs, 2 * DAY).map(({ id }) => id), ['fresh', 'done'])
  })

  it('만든 시각을 모르는 기록은 버리지 않는다', () => {
    assert.equal(pruneRuns([base('x')], 99 * DAY).length, 1)
  })
})

describe('summarizeRun', () => {
  it('충족한 요건 수와 제목을 센다', () => {
    const summary = summarizeRun(base('a', { rows, posting: '# 프론트엔드 개발자\n본문' }))
    assert.deepEqual({ title: summary.title, total: summary.total, met: summary.met }, { title: '프론트엔드 개발자', total: 3, met: 1 })
  })

  it('사용자가 고친 판단을 반영한다', () => {
    assert.equal(summarizeRun(base('a', { rows, edits: { 1: 'met' } })).met, 2)
  })

  it('어디까지 진행했는지 알려 준다', () => {
    assert.equal(summarizeRun(base('a', { rows })).step, 'compare')
    assert.equal(summarizeRun(withDirections('a', [])).step, 'directions')
    assert.equal(summarizeRun(withDirections('a', ['1:0'])).step, 'plan')
  })
})

describe('guardStep', () => {
  it('비교를 끝내지 못했으면 방향 화면은 비교 화면으로 돌려보낸다', () => {
    assert.equal(guardStep(base('a'), 'directions'), '/runs/a')
  })

  it('고른 방향이 없으면 이번 주 할 일은 방향 고르기로 돌려보낸다', () => {
    assert.equal(guardStep(withDirections('a', []), 'plan'), '/runs/a/directions')
  })

  it('이력서 문장은 방법을 고르고 확인한 뒤에만 열린다', () => {
    assert.equal(guardStep(base('a'), 'resume'), '/runs/a')
    assert.equal(guardStep(withDirections('a', ['1:1']), 'resume'), '/runs/a/directions')
    const withSentences = { ...withDirections('a', ['1:1']), sentences: { items: [], confirmed: false } }
    assert.equal(guardStep(withSentences, 'resume'), null)
  })

  it('갈 수 있는 화면은 그대로 둔다', () => {
    assert.equal(guardStep(withDirections('a', ['1:0']), 'plan'), null)
    assert.equal(guardStep(withDirections('a', []), 'directions'), null)
    assert.equal(guardStep(base('a'), undefined), null)
  })
})
