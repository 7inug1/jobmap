import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifyLines } from './posting-lines.ts'

const kinds = (lines: string[]) => classifyLines(lines).map(({ kind, text }) => `${kind}:${text}`)

describe('classifyLines', () => {
  it('목록 기호로 시작하면 목록 항목이고 기호는 뗀다', () => {
    assert.deepEqual(kinds(['- React 3년', '• 테스트 작성', '1. 코드 리뷰']), ['item:React 3년', 'item:테스트 작성', 'item:코드 리뷰'])
  })

  it('목록 바로 위의 짧은 줄은 제목이다', () => {
    assert.deepEqual(kinds(['자격요건', '- React 3년']), ['heading:자격요건', 'item:React 3년'])
  })

  it('쌍점으로 끝나는 짧은 줄은 제목이다', () => {
    assert.deepEqual(kinds(['Annual Salary:', '$190,000 - $230,000 USD']), ['heading:Annual Salary:', 'text:$190,000 - $230,000 USD'])
  })

  it('잘 알려진 공고 섹션 이름은 다음 줄이 문단이어도 제목이다', () => {
    assert.deepEqual(kinds(['Qualifications', 'You have built products.']), ['heading:Qualifications', 'text:You have built products.'])
    assert.deepEqual(kinds(['우대사항', '결제를 만들어 본 분이면 좋아요.']), ['heading:우대사항', 'text:결제를 만들어 본 분이면 좋아요.'])
  })

  it('문장으로 끝나는 줄과 숫자로 시작하는 줄은 제목이 아니다', () => {
    assert.deepEqual(kinds(['함께 일해요.', '- A']), ['text:함께 일해요.', 'item:A'])
    assert.deepEqual(kinds(['$190,000 USD', '- A']), ['text:$190,000 USD', 'item:A'])
  })

  it('긴 줄은 목록 위에 있어도 제목이 아니다', () => {
    const long = '우리 팀은 사용자가 매일 쓰는 제품을 만들고 그 결과를 숫자로 확인하는 일을 합니다 그래서'
    assert.equal(classifyLines([long, '- A'])[0]!.kind, 'text')
  })
})
