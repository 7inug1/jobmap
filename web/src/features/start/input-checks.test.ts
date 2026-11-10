import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkPdfSize, checkPostingText, checkPostingUrl, checkResumeText, describePostingFailure, pdfErrorMessage } from './input-checks.ts'

describe('checkPostingUrl', () => {
  it('비어 있으면 아직 안내하지 않는다', () => {
    assert.equal(checkPostingUrl(''), null)
  })

  it('주소 형식이 아니면 안내한다', () => {
    assert.match(checkPostingUrl('원티드 공고')!, /주소/)
  })

  it('http 주소는 서버에 보내기 전에 안내한다', () => {
    assert.match(checkPostingUrl('http://example.com/jobs/1')!, /https/)
  })

  it('https 주소는 통과한다', () => {
    assert.equal(checkPostingUrl('https://example.com/jobs/1'), null)
  })
})

describe('글 길이 검사', () => {
  it('비어 있으면 아직 안내하지 않는다', () => {
    assert.equal(checkPostingText('   '), null)
    assert.equal(checkResumeText(''), null)
  })

  it('공고는 200자보다 짧으면 AI를 부르기 전에 안내한다', () => {
    assert.match(checkPostingText('가'.repeat(199))!, /짧/)
    assert.equal(checkPostingText('가'.repeat(200)), null)
  })

  it('이력서는 50자보다 짧으면 안내한다', () => {
    assert.match(checkResumeText('가'.repeat(49))!, /짧/)
    assert.equal(checkResumeText('가'.repeat(50)), null)
  })

  it('앞뒤 공백은 길이에 넣지 않는다', () => {
    assert.match(checkResumeText(`${' '.repeat(100)}가`)!, /짧/)
  })

  it('3만 자를 넘으면 지금 글자 수와 함께 안내한다', () => {
    assert.match(checkPostingText('가'.repeat(30_001))!, /30,001자/)
    assert.match(checkResumeText('가'.repeat(30_001))!, /30,000자/)
    assert.equal(checkPostingText('가'.repeat(30_000)), null)
  })
})

describe('PDF 검사', () => {
  it('10MB까지 받는다', () => {
    assert.equal(checkPdfSize(10 * 1024 * 1024), null)
    assert.match(checkPdfSize(10 * 1024 * 1024 + 1)!, /10MB/)
  })

  it('암호 걸린 PDF는 전용 문구로 안내한다', () => {
    assert.match(pdfErrorMessage(Object.assign(new Error('x'), { name: 'PasswordException' })), /암호/)
  })

  it('그 밖의 오류는 일반 문구로 안내한다', () => {
    assert.doesNotMatch(pdfErrorMessage(new Error('x')), /암호/)
  })
})

describe('describePostingFailure', () => {
  it('못 읽는 플랫폼은 이름을 넣어 안내한다', () => {
    assert.match(describePostingFailure({ kind: 'unsupported', name: '잡코리아' }).title, /잡코리아/)
  })

  it('지원 플랫폼이 실패하면 이름과 원인을 알려 준다', () => {
    const notice = describePostingFailure({ kind: 'supported', name: '원티드' }, 'fetch_failed')
    assert.match(notice.title, /원티드/)
    assert.match(notice.body, /열지 못/)
  })

  it('처음 보는 사이트는 공고 글을 못 찾았다고 알려 준다', () => {
    const notice = describePostingFailure({ kind: 'unknown' }, 'no_text')
    assert.match(notice.body, /찾지 못/)
  })

  it('모르는 원인도 빈 문구를 내지 않는다', () => {
    assert.notEqual(describePostingFailure({ kind: 'unknown' }, 'new_reason').body, '')
  })
})
