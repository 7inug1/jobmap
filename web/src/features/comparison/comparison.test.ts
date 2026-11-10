import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Row } from '../../shared/types.ts'
import { annotatePosting, applyEdits, directionsWillReset, gapsFromRows, readComparison, repeatsLine, requirementLabel, sameGaps, visibleDrafts } from './comparison.ts'

const row: Row = {
  requirement: 'React 3년',
  verdict: 'met',
  postingQuote: 'React로 3년 이상 만들어본 분',
  resumeQuote: 'React로 4년 만들었습니다.',
}

const saved = { type: 'dynamic-tool', toolName: 'save_comparison', state: 'output-available', output: { rows: [row] } }
const completed = [{ outcome: 'completed' }]

const user = (body = '비교해 주세요') => ({ role: 'user', parts: [{ type: 'text', text: body }] })
const answer = (text: string, state = 'streaming') => ({ role: 'assistant', parts: [{ type: 'text', text, state }] })
const line = JSON.stringify(row)

describe('readComparison', () => {
  it('예전 기록처럼 저장 도구가 성공했으면 표를 보여 준다', () => {
    assert.deepEqual(readComparison([user(), { role: 'assistant', parts: [saved] }], completed, 'idle'), { phase: 'done', rows: [row] })
  })

  it('아직 응답이 없으면 쓰는 중이다', () => {
    assert.deepEqual(readComparison([user()], [], 'submitted'), { phase: 'working', rows: [], retries: 0, answered: false })
  })

  it('쓰는 중에는 끝난 줄만 판단으로 보여 준다', () => {
    const view = readComparison([user(), answer(`${line}\n{"requirement"`)], [], 'streaming')
    assert.deepEqual(view, { phase: 'working', rows: [row], retries: 0, answered: false })
  })

  it('응답이 끝나면 검사할 차례다', () => {
    const view = readComparison([user(), answer(line, 'done')], completed, 'idle')
    assert.deepEqual(view, { phase: 'working', rows: [row], retries: 0, answered: true })
  })

  it('고쳐 달라고 다시 보낸 뒤에는 마지막 응답만 읽고 횟수를 센다', () => {
    const messages = [user(), answer(line, 'done'), user('고쳐 주세요'), answer('')]
    assert.deepEqual(readComparison(messages, completed, 'streaming'), { phase: 'working', rows: [], retries: 1, answered: false })
  })

  it('연결 오류면 실패다', () => {
    assert.deepEqual(readComparison([], [], 'error'), { phase: 'failed', reason: 'connection' })
  })

  it('요청이 실패로 끝나면 연결 오류로 본다', () => {
    assert.deepEqual(readComparison([user()], [{ outcome: 'failed', error: 'boom' }], 'idle'), { phase: 'failed', reason: 'connection' })
  })

  it('한도 오류는 따로 알려 준다', () => {
    const quota = [{ outcome: 'failed', error: { message: '4006: you have used up your daily free allocation' } }]
    assert.deepEqual(readComparison([user()], quota, 'idle'), { phase: 'failed', reason: 'quota' })
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

describe('requirementLabel', () => {
  it('사람이 읽는 이름은 그대로 쓴다', () => {
    assert.equal(requirementLabel({ requirement: 'React 3년 이상', postingQuote: '긴 공고 문장' }), 'React 3년 이상')
  })

  it('대문자로 시작하는 기술 이름은 그대로 쓴다', () => {
    assert.equal(requirementLabel({ requirement: 'TypeScript', postingQuote: '긴 공고 문장' }), 'TypeScript')
  })

  it('변수 이름처럼 쓴 이름은 공고 문장으로 바꾼다', () => {
    for (const requirement of ['executionBalance', 'react_ssr', 'fullStackExperience']) {
      assert.equal(requirementLabel({ requirement, postingQuote: '실행과 균형을 함께 챙기는 분' }), '실행과 균형을 함께 챙기는 분')
    }
  })

  it('바꿔 쓴 공고 문장이 길면 줄여서 보여 준다', () => {
    const label = requirementLabel({ requirement: 'executionBalance', postingQuote: '가'.repeat(80) })
    assert.equal(label, `${'가'.repeat(40)}…`)
  })
})

describe('requirementLabel 깨진 글자', () => {
  it('깨진 글자는 말줄임표로 가려 보여 준다', () => {
    assert.equal(requirementLabel({ requirement: '모바일 \uFFFD\uFFFD 내 \uFFFD\uFFFD뷰 개발 경험', postingQuote: '공고' }), '모바일 … 내 …뷰 개발 경험')
  })

  it('이름이 깨진 글자만이면 공고 문장으로 바꾼다', () => {
    assert.equal(requirementLabel({ requirement: '\uFFFD\uFFFD', postingQuote: '실행과 균형을 챙기는 분' }), '실행과 균형을 챙기는 분')
  })
})

describe('visibleDrafts', () => {
  const rows = Array.from({ length: 7 }, (_, index) => ({ ...row, requirement: `요건 ${index + 1}` }))

  it('최근 4개만 보여 주고 접은 개수를 알려 준다', () => {
    const { shown, hidden } = visibleDrafts(rows)
    assert.deepEqual(shown.map(({ requirement }) => requirement), ['요건 4', '요건 5', '요건 6', '요건 7'])
    assert.equal(hidden, 3)
  })

  it('4개 이하면 모두 보여 준다', () => {
    assert.deepEqual(visibleDrafts(rows.slice(0, 3)), { shown: rows.slice(0, 3), hidden: 0 })
  })
})

