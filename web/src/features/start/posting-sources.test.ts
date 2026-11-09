import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classifyPostingUrl } from './posting-sources.ts'

describe('classifyPostingUrl', () => {
  it('측정에서 읽힌 플랫폼은 지원으로 본다', () => {
    assert.deepEqual(classifyPostingUrl('https://www.wanted.co.kr/wd/1'), { kind: 'supported', name: '원티드' })
    assert.deepEqual(classifyPostingUrl('https://jobs.lever.co/a/b'), { kind: 'supported', name: 'Lever' })
  })

  it('회사별 하위 주소도 알아본다', () => {
    assert.deepEqual(classifyPostingUrl('https://nvidia.wd5.myworkdayjobs.com/a/job/b'), { kind: 'supported', name: 'Workday' })
  })

  it('읽지 못하는 플랫폼은 붙여넣기로 안내한다', () => {
    assert.deepEqual(classifyPostingUrl('https://www.jobkorea.co.kr/Recruit/GI_Read/1'), { kind: 'unsupported', name: '잡코리아' })
  })

  it('사람인 안의 점핏은 사람인과 구분한다', () => {
    assert.deepEqual(classifyPostingUrl('https://jumpit.saramin.co.kr/position/1'), { kind: 'supported', name: '점핏' })
    assert.deepEqual(classifyPostingUrl('https://www.saramin.co.kr/zf_user/jobs/1'), { kind: 'unsupported', name: '사람인' })
  })

  it('주소에 이름만 비슷하게 들어간 사이트는 지원으로 보지 않는다', () => {
    assert.deepEqual(classifyPostingUrl('https://wanted.co.kr.evil.example/wd/1'), { kind: 'unknown' })
    assert.deepEqual(classifyPostingUrl('https://notwanted.co.kr/wd/1'), { kind: 'unknown' })
  })

  it('처음 보는 사이트와 주소가 아닌 글을 구분한다', () => {
    assert.deepEqual(classifyPostingUrl('https://example.com/job'), { kind: 'unknown' })
    assert.deepEqual(classifyPostingUrl('아무 글자'), { kind: 'invalid' })
    assert.deepEqual(classifyPostingUrl(''), { kind: 'invalid' })
  })
})
