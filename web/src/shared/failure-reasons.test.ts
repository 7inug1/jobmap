import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canRetry, directionsFailure, FAILURE_COPY, isQuotaError } from './failure-reasons.ts'

const quotaMessage = "4006: you have used up your daily free allocation of 10,000 neurons"

describe('isQuotaError', () => {
  it('Workers AI 한도 오류를 알아본다', () => {
    assert.equal(isQuotaError(quotaMessage), true)
    assert.equal(isQuotaError({ message: quotaMessage }), true)
    assert.equal(isQuotaError(new Error(quotaMessage)), true)
  })

  it('다른 오류는 한도 오류가 아니다', () => {
    assert.equal(isQuotaError('network lost'), false)
    assert.equal(isQuotaError(undefined), false)
  })
})

describe('canRetry', () => {
  it('두 번까지 다시 시도할 수 있다', () => {
    assert.equal(canRetry('evidence', 1), true)
    assert.equal(canRetry('connection', 2), false)
  })

  it('한도를 다 썼으면 다시 시도하지 않는다', () => {
    assert.equal(canRetry('quota', 0), false)
  })
})

describe('FAILURE_COPY', () => {
  it('한도 소진은 시각을 약속하지 않고 내일 다시 하도록 안내한다', () => {
    assert.match(FAILURE_COPY.quota.detail, /내일/)
    assert.doesNotMatch(FAILURE_COPY.quota.detail, /오전 9시/)
  })
})

describe('directionsFailure', () => {
  it('한도 소진은 다시 누를 수 없다', () => {
    const failure = directionsFailure(new Error('quota'), 1)
    assert.equal(failure.canRetry, false)
    assert.match(failure.message, /내일/)
  })

  it('두 번째 실패까지는 다시 누를 수 있다', () => {
    assert.equal(directionsFailure(new Error('model_failed'), 2).canRetry, true)
  })

  it('세 번째 실패부터는 더 호출하지 않는다', () => {
    const failure = directionsFailure(new Error('model_failed'), 3)
    assert.equal(failure.canRetry, false)
    assert.match(failure.message, /잠시 뒤/)
  })
})
