import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Run } from '../shared/types.ts'
import { homeStage, tabsFor } from './navigation.ts'

const base: Run = { id: 'a', posting: '공고', resume: '이력서', edits: {} }
const direction = { gapNumber: 1, requirement: 'A', verdict: 'unmet' as const, options: [] }
const withDirections = (picks: string[]): Run => ({ ...base, directions: { gaps: [], directions: [direction], picks } })

describe('homeStage', () => {
  it('고른 방향이 있으면 이번 주 할 일이 홈이다', () => {
    assert.equal(homeStage(withDirections(['1:0'])), 'plan')
  })

  it('고른 방향이 없으면 비교 결과가 홈이다', () => {
    assert.equal(homeStage(base), undefined)
    assert.equal(homeStage(withDirections([])), undefined)
  })
})

describe('tabsFor', () => {
  it('비교만 했으면 공고 같이 보기만 있다', () => {
    assert.deepEqual(tabsFor(base).map(({ label }) => label), ['공고 같이 보기'])
  })

  it('방향을 받았으면 방향 고르기가 생긴다', () => {
    assert.deepEqual(tabsFor(withDirections([])).map(({ label }) => label), ['공고 같이 보기', '방향 고르기'])
  })

  it('방향을 골랐으면 이번 주 할 일이 맨 앞에 생긴다', () => {
    assert.deepEqual(tabsFor(withDirections(['1:0'])).map(({ stage }) => stage), ['plan', undefined, 'directions'])
  })
})
