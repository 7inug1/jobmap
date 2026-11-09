import { useState } from 'react'
import { Start } from '../features/start/Start.tsx'
import type { Inputs, Run } from '../shared/types.ts'
import { RunFlow } from './RunFlow.tsx'
import { loadRun, saveRun } from './saved-run.ts'

export default function App() {
  const [run, setRun] = useState(loadRun)
  const [draft, setDraft] = useState<Inputs>({ posting: '', resume: '' })

  function update(next: Run | null) {
    saveRun(next)
    setRun(next)
  }

  function restart(inputs: Inputs) {
    setDraft(inputs)
    update(null)
  }

  return (
    <main className="page">
      {run ? (
        <RunFlow key={run.id} run={run} onChange={update} onRestart={() => restart(run)} />
      ) : (
        <Start initial={draft} onStarted={update} />
      )}
    </main>
  )
}
