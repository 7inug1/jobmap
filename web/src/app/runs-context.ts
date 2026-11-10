import { createContext, useContext } from 'react'
import type { Run } from '../shared/types.ts'

export type RunsValue = { runs: Run[]; save: (run: Run) => void; remove: (id: string) => void }

export const RunsContext = createContext<RunsValue | null>(null)

export function useRuns(): RunsValue {
  const value = useContext(RunsContext)
  if (!value) throw new Error('RunsProvider 안에서만 쓸 수 있어요.')
  return value
}
