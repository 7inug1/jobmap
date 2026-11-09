import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Direction } from '../../shared/types.ts'
import { recommendedPicks, summarizePicks } from './directions.ts'

const directions: Direction[] = [
  {
    gapNumber: 1,
    requirement: 'A',
    verdict: 'unmet',
    options: [
      { label: '공부', description: '', lane: 'study', hours: 2, recommended: false },
      { label: '프로젝트', description: '', lane: 'project', hours: 4, recommended: true },
    ],
  },
  {
    gapNumber: 2,
    requirement: 'B',
    verdict: 'partial',
    options: [{ label: '공부 2', description: '', lane: 'study', hours: 3, recommended: true }],
  },
]

describe('picks', () => {
  it('추천 방법을 고른다', () => {
    assert.deepEqual(recommendedPicks(directions), ['1:1', '2:0'])
  })

  it('고른 방법의 시간을 합치고 주를 올림으로 계산한다', () => {
    assert.deepEqual(summarizePicks(directions, ['1:0', '1:1', '2:0'], 3), { studyHours: 5, projectHours: 4, weeks: 3 })
  })

  it('고른 것이 없으면 0주다', () => {
    assert.deepEqual(summarizePicks(directions, [], 3), { studyHours: 0, projectHours: 0, weeks: 0 })
  })

  it('없어진 방법은 계산에서 뺀다', () => {
    assert.deepEqual(summarizePicks(directions, ['9:0'], 3), { studyHours: 0, projectHours: 0, weeks: 0 })
  })
})
