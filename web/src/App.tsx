import { useFlueAgent } from '@flue/react'
import { useState } from 'react'

const STORAGE_KEY = 'jobmap-conversation-id'

function conversationId() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) return saved
  const created = crypto.randomUUID()
  localStorage.setItem(STORAGE_KEY, created)
  return created
}

type Row = {
  requirement: string
  verdict: string
  postingQuote: string
  resumeQuote: string | null
}

// 프레임워크 확인용 화면. 표 그리기, 진행 표시, 새로 고침 복원을 눈으로 본다.
export default function App() {
  const [id] = useState(conversationId)
  const agent = useFlueAgent({ url: `/agents/jobmap/${id}` })

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1>잡맵 연결 확인</h1>
      <p>
        status: {agent.status}, historyReady: {String(agent.historyReady)}
      </p>
      <button
        type="button"
        id="compare"
        onClick={() => agent.sendMessage('비교해 주세요')}
      >
        가짜 비교 실행
      </button>
      {agent.messages.map((message) => (
        <article key={message.id}>
          <strong>{message.role}</strong>
          {message.parts.map((part, index) => {
            if (part.type === 'text') return <p key={index}>{part.text}</p>
            if (part.type === 'data-progress') {
              return <p key={index}>진행: {JSON.stringify(part.data)}</p>
            }
            if (part.type === 'dynamic-tool' && part.state === 'output-available') {
              const rows = (part.output as { rows?: Row[] }).rows ?? []
              return (
                <table key={index}>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.requirement}>
                        <td>{row.requirement}</td>
                        <td>{row.verdict}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
            return null
          })}
        </article>
      ))}
    </main>
  )
}
