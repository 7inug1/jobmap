import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Direction, Run, SentenceItem } from '../../shared/types.ts'
import { buildPlanTasks, dateLabel, formatDuration, monthCells, remainingWeeks, thisWeekTasks, toggleTask, type PlanTask } from './plan.ts'

const item = (key: string, steps: string[], extra: Partial<SentenceItem> = {}): SentenceItem => ({
  key,
  requirement: '요건',
  label: `프로젝트 ${key}`,
  hours: 6,
  sentence: '문장 {결과}',
  steps,
  after: null,
  ticked: [],
  answers: {},
  done: false,
  ...extra,
})

const option = (lane: 'study' | 'project', hours: number) => ({ label: `${lane} 방법`, description: '', lane, hours, recommended: true })
const direction = (gapNumber: number, ...options: ReturnType<typeof option>[]): Direction => ({ gapNumber, requirement: `요건 ${gapNumber}`, verdict: 'unmet', options })
const base: Run = { id: 'a', posting: '공고', resume: '이력서', edits: {} }

describe('buildPlanTasks', () => {
  const run: Run = {
    ...base,
    directions: { gaps: [], directions: [direction(1, option('study', 4), option('project', 8)), direction(2, option('study', 3))], picks: ['1:0', '1:1', '2:0'] },
    sentences: { confirmed: true, items: [item('1:1', ['가설 쓰기', '실험 하기'], { ticked: ['가설 쓰기'] })] },
  }

  it('문장의 할 일은 이력서 일, 공부는 지식 일로 만든다', () => {
    const tasks = buildPlanTasks(run)
    assert.deepEqual(tasks.map(({ lane, title }) => `${lane}:${title}`), ['resume:가설 쓰기', 'resume:실험 하기', 'know:study 방법', 'know:study 방법'])
  })

  it('문장의 시간을 할 일 수로 나눠 할 일마다 시간을 정한다', () => {
    assert.deepEqual(buildPlanTasks(run).slice(0, 2).map(({ hours }) => hours), [3, 3])
  })

  it('이력서 일의 체크는 문장의 체크를 따르고, 공부는 따로 기록한다', () => {
    const tasks = buildPlanTasks({ ...run, doneTasks: ['2:0'] })
    assert.deepEqual(tasks.map(({ done }) => done), [true, false, false, true])
  })

  it('해당 없음으로 뺀 요건의 공부는 만들지 않는다', () => {
    assert.equal(buildPlanTasks({ ...run, skippedGaps: ['요건 2'] }).length, 3)
  })

  it('문장이 없는 예전 기록의 프로젝트는 방법 하나를 일 하나로 센다', () => {
    const legacy: Run = { ...base, directions: { gaps: [], directions: [direction(1, option('project', 5))], picks: ['1:0'] } }
    assert.deepEqual(buildPlanTasks(legacy).map(({ lane, hours }) => `${lane}:${hours}`), ['resume:5'])
  })

  it('고른 방법이 없으면 일이 없다', () => {
    assert.deepEqual(buildPlanTasks(base), [])
  })
})

describe('toggleTask', () => {
  const run: Run = {
    ...base,
    directions: { gaps: [], directions: [direction(1, option('study', 4))], picks: ['1:0'] },
    sentences: { confirmed: true, items: [item('2:1', ['가설 쓰기'])] },
  }
  const tasks = buildPlanTasks(run)

  it('이력서 일을 체크하면 문장의 체크 목록에 들어가고 다시 누르면 빠진다', () => {
    const resume = tasks.find((task) => task.lane === 'resume')!
    const checked = toggleTask(run, resume)
    assert.deepEqual(checked.sentences!.items[0]!.ticked, ['가설 쓰기'])
    assert.deepEqual(toggleTask(checked, resume).sentences!.items[0]!.ticked, [])
  })

  it('공부를 체크하면 끝낸 공부 목록에 들어가고 다시 누르면 빠진다', () => {
    const study = tasks.find((task) => task.lane === 'know')!
    const checked = toggleTask(run, study)
    assert.deepEqual(checked.doneTasks, ['1:0'])
    assert.deepEqual(toggleTask(checked, study).doneTasks, [])
  })
})

describe('thisWeekTasks', () => {
  const task = (key: string, hours: number, done = false): PlanTask => ({ key, groupKey: 'g', groupTitle: 'g', lane: 'resume', title: key, hours, done })

  it('일주일 시간 안에서 끝나지 않은 일을 순서대로 담는다', () => {
    assert.deepEqual(thisWeekTasks([task('a', 1), task('b', 1.5), task('c', 1)], 3).map(({ key }) => key), ['a', 'b'])
  })

  it('끝낸 일은 건너뛴다', () => {
    assert.deepEqual(thisWeekTasks([task('a', 1, true), task('b', 2), task('c', 2)], 3).map(({ key }) => key), ['b'])
  })

  it('첫 일이 일주일보다 커도 하나는 담는다', () => {
    assert.deepEqual(thisWeekTasks([task('a', 9), task('b', 1)], 3).map(({ key }) => key), ['a'])
  })
})

describe('remainingWeeks와 formatDuration', () => {
  const task = (hours: number, done = false): PlanTask => ({ key: `${hours}${done}`, groupKey: 'g', groupTitle: 'g', lane: 'know', title: 't', hours, done })

  it('끝나지 않은 일의 시간을 일주일 시간으로 나눠 올림한다', () => {
    assert.equal(remainingWeeks([task(5), task(4), task(3, true)], 3), 3)
    assert.equal(remainingWeeks([task(3, true)], 3), 0)
  })

  it('몇 개월 몇 주로 말한다', () => {
    assert.equal(formatDuration(0), '모두 끝냈어요')
    assert.equal(formatDuration(3), '3주')
    assert.equal(formatDuration(4), '1개월')
    assert.equal(formatDuration(9), '2개월 1주')
  })
})

describe('달력', () => {
  it('달의 첫 요일만큼 빈칸을 두고 날짜를 채운다', () => {
    const cells = monthCells(2026, 10)
    // 2026년 11월 1일은 일요일이라 앞 빈칸이 없다.
    assert.equal(cells.length, 30)
    assert.deepEqual(cells.slice(0, 3), [1, 2, 3])
    // 2026년 10월 1일은 목요일이라 앞에 빈칸 4개가 있다.
    assert.deepEqual(monthCells(2026, 9).slice(0, 5), [null, null, null, null, 1])
    assert.equal(cells.at(-1), 30)
  })

  it('날짜를 월일과 요일로 읽기 쉽게 보여 준다', () => {
    assert.equal(dateLabel('2026-11-12'), '11월 12일 (목)')
  })
})
