import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Direction } from '../../shared/types.ts'
import { buildWeekPlan } from './week-plan.ts'

describe('buildWeekPlan', () => {
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
  const labels = (items: { label: string }[]) => items.map(({ label }) => label)
  const all = ['1:0', '1:1', '2:0']

  it('일주일 시간 안에서 고른 순서대로 이번 주 할 일을 정한다', () => {
    const result = buildWeekPlan(plan, ['1:0', '2:0'], [], 3)
    assert.deepEqual(labels(result.thisWeek), ['둘', '하나'])
    assert.deepEqual(result.later, [])
  })

  it('시간을 넘는 일이 나오면 거기서 다음 주로 넘긴다', () => {
    const result = buildWeekPlan(plan, all, [], 3)
    assert.deepEqual(labels(result.thisWeek), ['둘'])
    assert.deepEqual(labels(result.later), ['넷', '하나'])
  })

  it('한 일이 일주일 시간보다 커도 이번 주에 하나는 정한다', () => {
    assert.deepEqual(labels(buildWeekPlan(plan, ['1:1'], [], 3).thisWeek), ['넷'])
  })

  it('끝낸 일은 빼고 다음 일을 올린다', () => {
    const result = buildWeekPlan(plan, all, ['1:0'], 3)
    assert.deepEqual(labels(result.done), ['둘'])
    assert.deepEqual(labels(result.thisWeek), ['넷'])
    assert.deepEqual(labels(result.later), ['하나'])
  })

  it('남은 시간과 주를 계산한다', () => {
    assert.deepEqual(
      (({ hoursLeft, weeksLeft, hoursThisWeek }) => ({ hoursLeft, weeksLeft, hoursThisWeek }))(buildWeekPlan(plan, all, ['1:0'], 3)),
      { hoursLeft: 5, weeksLeft: 2, hoursThisWeek: 4 },
    )
  })

  it('다 끝내면 남은 일이 없다', () => {
    const result = buildWeekPlan(plan, all, all, 3)
    assert.deepEqual(result.thisWeek, [])
    assert.equal(result.weeksLeft, 0)
  })

  it('고르지 않은 일은 끝낸 목록에 있어도 넣지 않는다', () => {
    assert.deepEqual(buildWeekPlan(plan, ['2:0'], ['1:0'], 3).done, [])
  })
})
