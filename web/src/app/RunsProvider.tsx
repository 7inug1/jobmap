import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Run } from '../shared/types.ts'
import { RunsContext } from './runs-context.ts'
import { pruneRuns, removeRun, upsertRun } from './runs.ts'
import { loadRuns, parseSavedRuns, saveRuns } from './saved-run.ts'

/**
 * 이 브라우저에 쌓인 비교 기록. 탭을 여러 개 열어도 서로 덮어쓰지 않도록,
 * 저장할 때마다 저장소의 최신 목록에 합치고 다른 탭이 바꾼 내용은 storage 이벤트로 받는다.
 */
export function RunsProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<Run[]>(() => {
    const initial = pruneRuns(loadRuns(), Date.now())
    saveRuns(initial)
    return initial
  })
  const latest = useRef(runs)
  useEffect(() => {
    latest.current = runs
  }, [runs])

  const commit = useCallback((update: (current: Run[]) => Run[]) => {
    const stored = loadRuns()
    // 저장이 막힌 브라우저에서는 저장소가 비어 있으므로 화면에 있는 목록을 기준으로 한다.
    const next = update(stored.length > 0 ? stored : latest.current)
    saveRuns(next)
    setRuns(next)
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'jobmap-runs') setRuns(parseSavedRuns(event.newValue))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const save = useCallback((run: Run) => commit((current) => upsertRun(current, run)), [commit])
  const remove = useCallback((id: string) => commit((current) => removeRun(current, id)), [commit])

  return <RunsContext.Provider value={{ runs, save, remove }}>{children}</RunsContext.Provider>
}
