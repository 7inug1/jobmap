import { useState } from 'react'
import { Start } from '../features/start/Start.tsx'
import type { Inputs, Run } from '../shared/types.ts'
import { homeStage, tabsFor } from './navigation.ts'
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
    <>
      <header className="top">
        <button className="brand" type="button" onClick={() => run && update({ ...run, stage: homeStage(run) })}>
          잡맵
        </button>
        {run ? (
          <nav className="nav" aria-label="화면">
            {tabsFor(run).map(({ label, stage }) => (
              <button
                key={label}
                type="button"
                aria-current={run.stage === stage ? 'page' : undefined}
                onClick={() => update({ ...run, stage })}
              >
                {label}
              </button>
            ))}
          </nav>
        ) : null}
      </header>
      <main className="page">
        {run ? (
          <RunFlow key={run.id} run={run} onChange={update} onRestart={() => restart(run)} />
        ) : (
          <Start initial={draft} onStarted={update} />
        )}
      </main>
      <footer className="foot">
        <span>© 2026 잡맵</span>
        {run ? (
          <button className="link-button" type="button" onClick={() => restart(run)}>
            이 준비를 지우고 처음부터 다시 할게요
          </button>
        ) : null}
      </footer>
    </>
  )
}
