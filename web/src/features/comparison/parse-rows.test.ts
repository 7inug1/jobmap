import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseRows } from './parse-rows.ts'

const line = (requirement: string, verdict = 'met', resumeQuote: string | null = '근거') =>
  JSON.stringify({ requirement, verdict, postingQuote: `${requirement} 원문`, resumeQuote })

describe('parseRows', () => {
  it('한 줄에 하나씩 쓴 판단을 읽는다', () => {
    const rows = parseRows(`${line('A')}\n${line('B', 'unmet', null)}\n`, { streaming: false })
    assert.deepEqual(rows.map(({ requirement, verdict }) => `${requirement}:${verdict}`), ['A:met', 'B:unmet'])
  })

  it('쓰는 중에는 마지막 줄을 아직 읽지 않는다', () => {
    const text = `${line('A')}\n${line('B').slice(0, 20)}`
    assert.deepEqual(parseRows(text, { streaming: true }).map(({ requirement }) => requirement), ['A'])
  })

  it('다 쓴 뒤에는 줄바꿈이 없어도 마지막 줄을 읽는다', () => {
    assert.equal(parseRows(`${line('A')}\n${line('B')}`, { streaming: false }).length, 2)
  })

  it('코드 블록 표시와 설명 문장, 깨진 줄은 건너뛴다', () => {
    const text = ['```json', line('A'), '비교 결과입니다.', '{"requirement":', line('B'), '```'].join('\n')
    assert.deepEqual(parseRows(text, { streaming: false }).map(({ requirement }) => requirement), ['A', 'B'])
  })

  it('형식이 틀린 판단은 건너뛴다', () => {
    const wrong = JSON.stringify({ requirement: 'C', verdict: 'maybe', postingQuote: 'x', resumeQuote: null })
    assert.deepEqual(parseRows(`${line('A')}\n${wrong}`, { streaming: false }).length, 1)
  })
})
