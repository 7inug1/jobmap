import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Direction } from '../../shared/types.ts'
import { activeDirections, appendDirections, FIRST_BATCH, nextBatch, picksWithout, rankGaps, recommendedPicks, remainingGaps, summarizePicks } from './directions.ts'

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

const gap = (requirement: string, verdict: 'partial' | 'unmet') => ({ requirement, verdict })

describe('rankGaps', () => {
  it('불충족을 먼저, 일부 충족을 그다음에 두고 같은 판단끼리는 공고 순서를 지킨다', () => {
    const ranked = rankGaps([gap('A', 'partial'), gap('B', 'unmet'), gap('C', 'partial'), gap('D', 'unmet')])
    assert.deepEqual(ranked.map(({ requirement }) => requirement), ['B', 'D', 'A', 'C'])
  })

  it('원래 목록을 바꾸지 않는다', () => {
    const gaps = [gap('A', 'partial'), gap('B', 'unmet')]
    rankGaps(gaps)
    assert.equal(gaps[0]!.requirement, 'A')
  })
})

describe('nextBatch', () => {
  const ranked = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((name) => gap(name, 'unmet'))

  it('처음에는 5개를 고른다', () => {
    assert.equal(FIRST_BATCH, 5)
    assert.deepEqual(nextBatch(ranked, 0).map(({ requirement }) => requirement), ['A', 'B', 'C', 'D', 'E'])
  })

  it('이미 방법을 본 요건 뒤에서 다음 5개를 고른다', () => {
    assert.deepEqual(nextBatch(ranked, 5).map(({ requirement }) => requirement), ['F', 'G'])
  })

  it('다 봤으면 비어 있다', () => {
    assert.deepEqual(nextBatch(ranked, 7), [])
  })
})

describe('appendDirections', () => {
  const made = (gapNumber: number, requirement: string): Direction => ({
    gapNumber,
    requirement,
    verdict: 'unmet',
    options: [{ label: requirement, description: '', lane: 'study', hours: 1, recommended: true }],
  })

  it('새로 받은 요건 번호를 이어서 매겨, 고른 항목의 키가 바뀌지 않게 한다', () => {
    const merged = appendDirections([made(1, 'A'), made(2, 'B')], [made(1, 'C'), made(2, 'D')])
    assert.deepEqual(merged.map(({ gapNumber, requirement }) => `${gapNumber}:${requirement}`), ['1:A', '2:B', '3:C', '4:D'])
  })

  it('기존 목록이 비어 있으면 그대로 돌려준다', () => {
    assert.deepEqual(appendDirections([], [made(1, 'A')]).map(({ gapNumber }) => gapNumber), [1])
  })
})

describe('해당 없음으로 뺀 요건', () => {
  const made = (gapNumber: number, requirement: string): Direction => ({
    gapNumber,
    requirement,
    verdict: 'unmet',
    options: [{ label: requirement, description: '', lane: 'study', hours: 1, recommended: true }],
  })
  const all = ['A', 'B', 'C', 'D'].map((requirement) => gap(requirement, 'unmet'))

  it('아직 방법을 보지 않았고 빼지도 않은 요건만 남긴다', () => {
    assert.deepEqual(remainingGaps(all, [made(1, 'A')], ['C']).map(({ requirement }) => requirement), ['B', 'D'])
  })

  it('뺀 요건이 없으면 방법을 보지 않은 요건이 모두 남는다', () => {
    assert.deepEqual(remainingGaps(all, [made(1, 'A'), made(2, 'B')], []).map(({ requirement }) => requirement), ['C', 'D'])
  })

  it('뺀 요건의 방법은 화면에서 숨긴다', () => {
    const directions = [made(1, 'A'), made(2, 'B')]
    assert.deepEqual(activeDirections(directions, ['B']).map(({ requirement }) => requirement), ['A'])
  })

  it('요건을 빼면 그 요건에서 고른 방법만 고른 목록에서 뺀다', () => {
    const directions = [made(1, 'A'), made(2, 'B')]
    assert.deepEqual(picksWithout(directions, ['1:0', '2:0', '2:1'], 'B'), ['1:0'])
  })

  it('방법을 받지 않은 요건을 빼도 고른 목록은 그대로다', () => {
    assert.deepEqual(picksWithout([made(1, 'A')], ['1:0'], 'Z'), ['1:0'])
  })
})

