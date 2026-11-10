import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router'
import { Start } from '../features/start/Start.tsx'
import type { Inputs } from '../shared/types.ts'
import { History } from './History.tsx'
import { RunPage } from './RunPage.tsx'
import { runPath } from './runs.ts'
import { RunsProvider } from './RunsProvider.tsx'
import { useRuns } from './runs-context.ts'

function StartPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { save } = useRuns()
  // 다른 공고로 비교하거나 입력을 고칠 때 앞에서 넣은 내용을 이어서 쓴다.
  const draft = (location.state as { draft?: Inputs } | null)?.draft ?? { posting: '', resume: '' }

  return (
    <Start
      key={location.key}
      initial={draft}
      onStarted={(run) => {
        save(run)
        navigate(runPath(run.id))
      }}
    />
  )
}

function Layout() {
  return (
    <>
      <header className="top">
        <Link className="brand" to="/">
          잡맵
        </Link>
        <nav className="nav" aria-label="메뉴">
          <NavLink to="/history">내 기록</NavLink>
        </nav>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/runs/:id" element={<RunPage step={undefined} />} />
          <Route path="/runs/:id/directions" element={<RunPage step="directions" />} />
          <Route path="/runs/:id/resume" element={<RunPage step="resume" />} />
          <Route path="/runs/:id/plan" element={<RunPage step="plan" />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="foot">
        <span>© 2026 잡맵</span>
      </footer>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <RunsProvider>
        <Layout />
      </RunsProvider>
    </BrowserRouter>
  )
}
