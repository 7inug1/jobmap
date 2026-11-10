import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Row } from '../../shared/types.ts'
import { annotatePosting, applyEdits, directionsWillReset, gapsFromRows, readComparison, repeatsLine, sameGaps } from './comparison.ts'

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
    assert.deepEqual(readComparison([{ parts: [rejected, text] }], completed, 'idle'), { phase: 'failed', reason: 'evidence' })
  })

  it('도구를 부르지 않고 끝나면 실패다', () => {
    assert.deepEqual(readComparison([{ parts: [text] }], completed, 'idle'), { phase: 'failed', reason: 'evidence' })
  })

  it('연결 오류면 실패다', () => {
    assert.deepEqual(readComparison([], [], 'error'), { phase: 'failed', reason: 'connection' })
  })

  it('요청이 실패로 끝나면 연결 오류로 본다', () => {
    assert.deepEqual(readComparison([], [{ outcome: 'failed', error: 'boom' }], 'idle'), { phase: 'failed', reason: 'connection' })
  })

  it('한도 오류는 도구 실패보다 먼저 알려 준다', () => {
    const quota = [{ outcome: 'failed', error: { message: '4006: you have used up your daily free allocation' } }]
    assert.deepEqual(readComparison([{ parts: [rejected] }], quota, 'idle'), { phase: 'failed', reason: 'quota' })
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

describe('gapsFromRows', () => {
  it('사용자가 바꾼 판단 기준으로 부족한 요건만 번호와 함께 고른다', () => {
    const rows = [row, { ...row, requirement: 'B', verdict: 'partial' as const }, { ...row, requirement: 'C', verdict: 'unmet' as const }]
    assert.deepEqual(gapsFromRows(rows), [
      { requirement: 'B', verdict: 'partial' },
      { requirement: 'C', verdict: 'unmet' },
    ])
  })
})

describe('sameGaps', () => {
  const gaps = [{ requirement: 'A', verdict: 'unmet' as const }]

  it('요건과 판단이 같으면 같다', () => {
    assert.equal(sameGaps(gaps, [{ requirement: 'A', verdict: 'unmet' }]), true)
  })

  it('판단이 다르면 다르다', () => {
    assert.equal(sameGaps(gaps, [{ requirement: 'A', verdict: 'partial' }]), false)
  })
})

describe('directionsWillReset', () => {
  const gaps = [{ requirement: 'A', verdict: 'unmet' as const }]
  const changed = [{ requirement: 'A', verdict: 'partial' as const }]
  const saved = { gaps, directions: [], picks: ['1:0'] }

  it('아직 방향을 받지 않았으면 초기화할 것이 없다', () => {
    assert.equal(directionsWillReset(undefined, changed), false)
  })

  it('고른 것이 있고 판단이 바뀌면 초기화된다', () => {
    assert.equal(directionsWillReset(saved, changed), true)
  })

  it('판단이 그대로면 초기화되지 않는다', () => {
    assert.equal(directionsWillReset(saved, gaps), false)
  })

  it('고른 것이 없으면 알릴 필요가 없다', () => {
    assert.equal(directionsWillReset({ ...saved, picks: [] }, changed), false)
  })
})

describe('repeatsLine', () => {
  it('요건 이름이 공고 줄에 그대로 있으면 반복으로 본다', () => {
    assert.equal(repeatsLine('- React로 3년 이상  만들어본 분', 'React로 3년 이상 만들어본 분'), true)
  })

  it('줄여 쓴 요건 이름은 그대로 보여 준다', () => {
    assert.equal(repeatsLine('- React로 3년 이상 만들어본 분', 'React 3년'), false)
  })
})

