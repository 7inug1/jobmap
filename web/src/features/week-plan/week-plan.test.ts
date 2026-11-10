import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Direction } from '../../shared/types.ts'
import { buildWeekPlan, undoLastCompletion } from './week-plan.ts'

const plan: Direction[] = [
  {
    gapNumber: 1,
    requirement: 'A',
    verdict: 'unmet',
    options: [
      { label: '둘', description: '', lane: 'study', hours: 2, recommended: true },
      { label: '넷', description: '', lane: 'project', hours: 4, recommended: false },
    ],
  },
  {
    gapNumber: 2,
    requirement: 'B',
    verdict: 'partial',
    options: [{ label: '하나', description: '', lane: 'study', hours: 1, recommended: true }],
  },
]
const all = ['1:0', '1:1', '2:0']
const brief = (items: { label: string; weekHours?: number; leftHours: number }[]) =>
  items.map(({ label, weekHours, leftHours }) => (weekHours === undefined ? `${label} ${leftHours}` : `${label} ${weekHours}/${leftHours}`))

describe('buildWeekPlan', () => {
  it('일주일 시간 안에서 고른 순서대로 이번 주 할 일을 정한다', () => {
    const result = buildWeekPlan(plan, ['1:0', '2:0'], [], 3)
    assert.deepEqual(brief(result.thisWeek), ['둘 2/2', '하나 1/1'])
    assert.deepEqual(result.later, [])
  })

  it('일주일보다 큰 일은 이번 주 분량만 정하고 나머지는 다음으로 넘긴다', () => {
    const result = buildWeekPlan(plan, ['1:1'], [], 3)
    assert.deepEqual(brief(result.thisWeek), ['넷 3/4'])
    assert.deepEqual(brief(result.later), ['넷 1'])
    assert.equal(result.hoursThisWeek, 3)
  })

  it('남은 시간을 다음 일로 채운다', () => {
    const result = buildWeekPlan(plan, all, [], 3)
    assert.deepEqual(brief(result.thisWeek), ['둘 2/2', '넷 1/4'])
    assert.deepEqual(brief(result.later), ['넷 3', '하나 1'])
  })

  it('해낸 시간만큼 남은 시간을 줄인다', () => {
    const result = buildWeekPlan(plan, ['1:1'], [{ key: '1:1', hours: 3 }], 3)
    assert.deepEqual(brief(result.thisWeek), ['넷 1/1'])
    assert.equal(result.thisWeek[0]!.doneHours, 3)
  })

  it('다 해낸 일은 끝낸 일로 옮긴다', () => {
    const result = buildWeekPlan(plan, all, [{ key: '1:0', hours: 2 }], 3)
    assert.deepEqual(result.done.map(({ label }) => label), ['둘'])
    assert.deepEqual(brief(result.thisWeek), ['넷 3/4'])
  })

  it('남은 시간과 주를 계산한다', () => {
    const result = buildWeekPlan(plan, all, [{ key: '1:0', hours: 2 }], 3)
    assert.deepEqual({ hoursLeft: result.hoursLeft, weeksLeft: result.weeksLeft }, { hoursLeft: 5, weeksLeft: 2 })
  })

  it('다 끝내면 남은 일이 없다', () => {
    const done = [{ key: '1:0', hours: 2 }, { key: '1:1', hours: 4 }, { key: '2:0', hours: 1 }]
    const result = buildWeekPlan(plan, all, done, 3)
    assert.deepEqual(result.thisWeek, [])
    assert.equal(result.weeksLeft, 0)
  })

  it('기록이 일의 시간보다 많아도 남은 시간은 0보다 작아지지 않는다', () => {
    const result = buildWeekPlan(plan, ['1:0'], [{ key: '1:0', hours: Number.MAX_SAFE_INTEGER }], 3)
    assert.equal(result.hoursLeft, 0)
    assert.equal(result.done.length, 1)
  })

  it('고르지 않은 일의 기록은 무시한다', () => {
    assert.deepEqual(buildWeekPlan(plan, ['2:0'], [{ key: '1:0', hours: 2 }], 3).done, [])
  })
})

describe('undoLastCompletion', () => {
  it('그 일의 마지막 기록만 지운다', () => {
    const records = [{ key: 'a', hours: 3 }, { key: 'b', hours: 1 }, { key: 'a', hours: 2 }]
    assert.deepEqual(undoLastCompletion(records, 'a'), [{ key: 'a', hours: 3 }, { key: 'b', hours: 1 }])
  })

  it('기록이 없으면 그대로 둔다', () => {
    assert.deepEqual(undoLastCompletion([{ key: 'b', hours: 1 }], 'a'), [{ key: 'b', hours: 1 }])
  })
})
