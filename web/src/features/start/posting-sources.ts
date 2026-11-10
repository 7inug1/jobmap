export type PostingSource = { kind: 'supported' | 'unsupported'; name: string } | { kind: 'unknown' } | { kind: 'invalid' }

type Platform = { host: string; name: string }

// docs/posting-sources.md의 배포 환경 측정 결과. 다시 재면 함께 고친다.
export const SUPPORTED: readonly Platform[] = [
  { host: 'careers.daangn.com', name: '당근' },
  { host: 'wanted.co.kr', name: '원티드' },
  { host: 'jumpit.saramin.co.kr', name: '점핏' },
  { host: 'greenhouse.io', name: 'Greenhouse' },
  { host: 'lever.co', name: 'Lever' },
  { host: 'ashbyhq.com', name: 'Ashby' },
  { host: 'myworkdayjobs.com', name: 'Workday' },
]

export const UNSUPPORTED: readonly Platform[] = [
  { host: 'jobkorea.co.kr', name: '잡코리아' },
  { host: 'saramin.co.kr', name: '사람인' },
  { host: 'incruit.com', name: '인크루트' },
  { host: 'rocketpunch.com', name: '로켓펀치' },
  { host: 'toss.im', name: '토스' },
  { host: 'careers.kakao.com', name: '카카오' },
  { host: 'coupang.jobs', name: '쿠팡' },
  { host: 'linkedin.com', name: 'LinkedIn' },
]

function matches(hostname: string, platform: Platform): boolean {
  return hostname === platform.host || hostname.endsWith(`.${platform.host}`)
}

/** 공고 주소가 링크로 읽히는 플랫폼인지 나눈다. 점핏처럼 사람인 하위 주소가 있어 지원 목록을 먼저 본다. */
export function classifyPostingUrl(raw: string): PostingSource {
  let hostname: string
  try {
    hostname = new URL(raw).hostname.toLowerCase()
  } catch {
    return { kind: 'invalid' }
  }

  const supported = SUPPORTED.find((platform) => matches(hostname, platform))
  if (supported) return { kind: 'supported', name: supported.name }

  const unsupported = UNSUPPORTED.find((platform) => matches(hostname, platform))
  if (unsupported) return { kind: 'unsupported', name: unsupported.name }

  return { kind: 'unknown' }
}
