import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { itemsToText } from './resume-lines.ts'

const item = (str: string, x: number, y: number, width = str.length * 10) => ({
  str,
  width,
  height: 10,
  transform: [10, 0, 0, 10, x, y],
})

describe('itemsToText', () => {
  it('위에서 아래로 줄을 나누고 줄 안에서는 왼쪽부터 읽는다', () => {
    assert.equal(itemsToText([item('아래 줄', 0, 100), item('뒤', 50, 200), item('앞', 0, 200)]), '앞 뒤\n아래 줄')
  })

  it('높이가 조금 달라도 같은 줄로 본다', () => {
    assert.equal(itemsToText([item('React', 0, 200), item('개발', 80, 201.5)]), 'React 개발')
  })

  it('간격 없이 붙은 조각은 띄우지 않는다', () => {
    assert.equal(itemsToText([item('프론트', 0, 200, 30), item('엔드', 30, 200, 20)]), '프론트엔드')
  })

  it('글자가 없는 조각은 버린다', () => {
    assert.equal(itemsToText([item('   ', 0, 300), item('', 0, 250), item('내용', 0, 200)]), '내용')
  })

  it('글자가 하나도 없으면 빈 문자열이다', () => {
    assert.equal(itemsToText([]), '')
  })
})
