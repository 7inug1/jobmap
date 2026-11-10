import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Direction, SentenceItem } from '../../shared/types.ts'
import {
  addedAtTarget,
  blanksOf,
  completedSentence,
  missingPicks,
  placeSentences,
  projectPicks,
  readyToFill,
  reconcileItems,
  resumePages,
  sentenceParts,
} from './sentences.ts'

const item = (key: string, extra: Partial<SentenceItem> = {}): SentenceItem => ({
  key,
  requirement: '요건',
  label: `방법 ${key}`,
  hours: 2,
  sentence: '실험을 해서 {결과}를 얻음',
  steps: ['가설 쓰기', '실험 실행하기'],
  after: null,
  ticked: [],
  answers: {},
  done: false,
  ...extra,
})

describe('빈칸', () => {
  it('중괄호로 묶은 빈칸 이름을 순서대로, 중복 없이 찾는다', () => {
    assert.deepEqual(blanksOf('{무엇을} 실험해 {결과}를 얻고 {무엇을} 정리'), ['무엇을', '결과'])
  })

  it('빈칸이 없으면 빈 목록이다', () => {
    assert.deepEqual(blanksOf('그냥 문장'), [])
  })

  it('문장을 글, 빈칸, 채운 값으로 나눈다', () => {
    assert.deepEqual(sentenceParts('A를 해서 {결과}와 {결정}을 얻음', { 결과: '전환율 12% 증가' }), [
      { kind: 'text', text: 'A를 해서 ' },
      { kind: 'filled', text: '전환율 12% 증가' },
      { kind: 'text', text: '와 ' },
      { kind: 'blank', text: '결정' },
      { kind: 'text', text: '을 얻음' },
    ])
  })

  it('채운 값이 모두 있으면 완성된 문장을 만든다', () => {
    assert.equal(completedSentence('A를 해서 {결과}를 얻음', { 결과: '12% 증가' }), 'A를 해서 12% 증가를 얻음')
  })

  it('비워 둔 빈칸은 그대로 남긴다', () => {
    assert.equal(completedSentence('A를 해서 {결과}를 얻음', {}), 'A를 해서 {결과}를 얻음')
  })
})

describe('readyToFill', () => {
  it('할 일을 모두 체크했고 아직 완성하지 않았을 때만 결과를 넣을 수 있다', () => {
    assert.equal(readyToFill(item('a', { ticked: ['가설 쓰기', '실험 실행하기'] })), true)
    assert.equal(readyToFill(item('a', { ticked: ['가설 쓰기'] })), false)
    assert.equal(readyToFill(item('a', { ticked: ['가설 쓰기', '실험 실행하기'], done: true })), false)
  })

  it('고쳐서 없어진 할 일의 체크는 세지 않는다', () => {
    assert.equal(readyToFill(item('a', { steps: ['실험 실행하기'], ticked: ['실험 실행하기', '지운 할 일'] })), true)
  })
})

const direction = (gapNumber: number, requirement: string, lanes: ('study' | 'project')[]): Direction => ({
  gapNumber,
  requirement,
  verdict: 'unmet',
  options: lanes.map((lane, index) => ({ label: `${requirement} ${index}`, description: '설명', lane, hours: 3, recommended: index === 0 })),
})

describe('projectPicks', () => {
  const directions = [direction(1, 'A', ['study', 'project']), direction(2, 'B', ['project'])]

  it('고른 방법 중 프로젝트만 이력서 문장 대상이다', () => {
    assert.deepEqual(projectPicks(directions, ['1:0', '1:1', '2:0']).map(({ key }) => key), ['1:1', '2:0'])
  })

  it('요건과 방법 정보를 함께 돌려준다', () => {
    assert.deepEqual(projectPicks(directions, ['2:0'])[0], { key: '2:0', requirement: 'B', label: 'B 0', description: '설명', hours: 3 })
  })

  it('고른 것이 없으면 비어 있다', () => {
    assert.deepEqual(projectPicks(directions, []), [])
  })
})

describe('reconcileItems', () => {
  const picks = [
    { key: '1:1', requirement: 'A', label: 'A 1', description: '설명', hours: 3 },
    { key: '2:0', requirement: 'B', label: 'B 0', description: '설명', hours: 3 },
  ]
  const generated = { sentence: '새 문장 {결과}', steps: ['할 일'], after: null }

  it('이미 만든 문장은 그대로 두고 새로 고른 방법만 더한다', () => {
    const kept = item('1:1', { ticked: ['가설 쓰기'] })
    assert.deepEqual(missingPicks([kept], picks).map(({ key }) => key), ['2:0'])
    const items = reconcileItems([kept], picks, new Map([['2:0', generated]]))
    assert.deepEqual(items.map(({ key }) => key), ['1:1', '2:0'])
    assert.deepEqual(items[0]!.ticked, ['가설 쓰기'])
    assert.equal(items[1]!.sentence, '새 문장 {결과}')
  })

  it('더 이상 고르지 않은 방법의 문장은 뺀다', () => {
    const items = reconcileItems([item('1:1'), item('9:9')], picks.slice(0, 1), new Map())
    assert.deepEqual(items.map(({ key }) => key), ['1:1'])
  })

  it('방법을 고른 순서를 따른다', () => {
    const items = reconcileItems([item('2:0')], picks, new Map([['1:1', generated]]))
    assert.deepEqual(items.map(({ key }) => key), ['1:1', '2:0'])
  })
})

describe('resumePages', () => {
  it('쪽 구분(\\f)으로 나누고 빈 줄은 뺀다', () => {
    assert.deepEqual(resumePages('경력\n- A\n\f\n프로젝트\n\n- B'), [['경력', '- A'], ['프로젝트', '- B']])
  })

  it('쪽 구분이 없으면 한 쪽이다', () => {
    assert.deepEqual(resumePages('한 줄\n두 줄'), [['한 줄', '두 줄']])
  })

  it('글이 없으면 빈 한 쪽이다', () => {
    assert.deepEqual(resumePages('  '), [[]])
  })
})

describe('placeSentences', () => {
  const pages = [['경력', '- 디자인 시스템 설계'], ['프로젝트', 'Digestube', '- 검색 순서 개선', '- 저장소 설계', 'VIZUDEN']]
  const lineTexts = (entries: { kind: string; text?: string; item?: SentenceItem }[]) => entries.map((entry) => (entry.kind === 'line' ? entry.text : `+${entry.item!.key}`))

  it('들어갈 자리로 정한 줄 바로 아래에 문장을 넣는다', () => {
    const placed = placeSentences(pages, [item('1:1', { after: '검색 순서 개선' })])
    assert.deepEqual(lineTexts(placed.pages[1]!), ['프로젝트', 'Digestube', '- 검색 순서 개선', '+1:1', '- 저장소 설계', 'VIZUDEN'])
    assert.deepEqual(placed.target, { page: 1, line: 2 })
    assert.deepEqual(placed.unplaced, [])
  })

  it('같은 줄 아래에 여러 문장이 들어가면 고른 순서를 지킨다', () => {
    const placed = placeSentences(pages, [item('a', { after: '저장소 설계' }), item('b', { after: '저장소 설계' })])
    assert.deepEqual(lineTexts(placed.pages[1]!).slice(4, 6), ['+a', '+b'])
  })

  it('구두점이 달라도 같은 줄이면 그 아래에 넣는다', () => {
    const placed = placeSentences(pages, [item('x', { after: '디자인, 시스템 설계' })])
    assert.deepEqual(lineTexts(placed.pages[0]!), ['경력', '- 디자인 시스템 설계', '+x'])
  })

  it('자리를 모르거나 이력서에 없으면 맨 아래 새 항목으로 모은다', () => {
    const placed = placeSentences(pages, [item('n1'), item('n2', { after: '없는 줄입니다' })])
    assert.deepEqual(placed.unplaced.map(({ key }) => key), ['n1', 'n2'])
    assert.deepEqual(placed.target, { page: 1, line: 4 })
  })

  it('문장이 없으면 확대할 곳도 없다', () => {
    assert.equal(placeSentences(pages, []).target, null)
  })
})

describe('addedAtTarget', () => {
  const pages = [['프로젝트', '- 검색 순서 개선', '- 저장소 설계']]

  it('확대할 자리 바로 아래에 들어가는 문장 수를 센다', () => {
    const placed = placeSentences(pages, [item('a', { after: '검색 순서 개선' }), item('b', { after: '검색 순서 개선' }), item('c', { after: '저장소 설계' })])
    assert.equal(addedAtTarget(placed), 2)
  })

  it('자리를 모르는 문장만 있으면 새 항목의 문장 수를 센다', () => {
    assert.equal(addedAtTarget(placeSentences(pages, [item('n1'), item('n2')])), 2)
  })

  it('문장이 없으면 0이다', () => {
    assert.equal(addedAtTarget(placeSentences(pages, [])), 0)
  })
})

