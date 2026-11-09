import type { Run } from '../shared/types.ts'

const RUN_KEY = 'jobmap-run'

export function loadRun(): Run | null {
  try {
    const saved = localStorage.getItem(RUN_KEY)
    return saved ? (JSON.parse(saved) as Run) : null
  } catch {
    return null
  }
}

export function saveRun(run: Run | null) {
  try {
    if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run))
    else localStorage.removeItem(RUN_KEY)
  } catch {
    // 저장이 막힌 브라우저에서도 지금 화면은 계속 쓸 수 있다.
  }
}
