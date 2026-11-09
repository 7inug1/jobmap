import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { annotatePosting, applyEdits, readComparison, type Row } from './comparison.ts'

const row: Row = {
  requirement: 'React 3년',
  verdict: 'met',
  postingQuote: 'React로 3년 이상 만들어본 분',
  resumeQuote: 'React로 4년 만들었습니다.',
}

const saved = { type: 'dynamic-tool', toolName: 'save_comparison', state: 'output-available', output: { rows: [row] } }
const rejected = { type: 'dynamic-tool', toolName: 'save_comparison', state: 'output-error' }
const text = { type: 'text', text: '저장되었습니다.' }
const progress = (step: string) => ({ type: 'data-progress', data: { step } })
const completed = [{ outcome: 'completed' }]

describe('readComparison', () => {
  it('도구가 성공하면 답변이 끝나기 전이라도 표를 보여 준다', () => {
    assert.deepEqual(readComparison([{ parts: [saved] }], [], 'streaming'), { phase: 'done', rows: [row] })
  })

  it('실패 뒤 재시도가 성공하면 성공으로 본다', () => {
    assert.deepEqual(readComparison([{ parts: [rejected, saved] }], completed, 'idle'), { phase: 'done', rows: [row] })
  })

  it('모델이 저장됐다고 말해도 도구가 실패했으면 실패다', () => {
    assert.deepEqual(readComparison([{ parts: [rejected, text] }], completed, 'idle'), { phase: 'failed' })
  })

  it('도구를 부르지 않고 끝나면 실패다', () => {
    assert.deepEqual(readComparison([{ parts: [text] }], completed, 'idle'), { phase: 'failed' })
  })

  it('연결 오류면 실패다', () => {
    assert.deepEqual(readComparison([], [], 'error'), { phase: 'failed' })
  })

  it('끝나기 전에는 마지막 진행 단계를 보여 준다', () => {
    assert.deepEqual(readComparison([{ parts: [progress('공고 읽기'), rejected, progress('근거 문장 확인하기')] }], [], 'streaming'), {
      phase: 'working',
      step: '근거 문장 확인하기',
    })
  })

  it('아직 아무 응답이 없어도 실패로 보지 않는다', () => {
    assert.deepEqual(readComparison([], [], 'idle'), { phase: 'working', step: null })
  })
})

describe('applyEdits', () => {
  it('사용자가 바꾼 행만 판단을 바꾸고 처음 판단을 남긴다', () => {
    const rows = [row, { ...row, verdict: 'unmet' as const }]
    assert.deepEqual(applyEdits(rows, { 1: 'partial' }), [
      { ...rows[0], aiVerdict: 'met' },
      { ...rows[1], verdict: 'partial', aiVerdict: 'unmet' },
    ])
  })
})

describe('annotatePosting', () => {
  const posting = '이런 분과 함께하고 싶어요\n- React로 3년 이상  만들어본 분\n\n참고해 주세요'

  it('근거 문장이 있는 줄 아래에 행을 붙이고 빈 줄은 뺀다', () => {
    assert.deepEqual(annotatePosting(posting, [row]), {
      lines: [
        { text: '이런 분과 함께하고 싶어요', rowIndexes: [] },
        { text: '- React로 3년 이상  만들어본 분', rowIndexes: [0] },
        { text: '참고해 주세요', rowIndexes: [] },
      ],
      unplaced: [],
    })
  })

  it('어느 줄에도 없는 행은 따로 돌려준다', () => {
    const multiLine = { ...row, postingQuote: '이런 분과 함께하고 싶어요 - React로' }
    assert.deepEqual(annotatePosting(posting, [multiLine]).unplaced, [0])
  })
})
