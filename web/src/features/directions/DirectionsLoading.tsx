import { useEffect, useState } from 'react'
import { ProgressSteps } from '../../shared/ProgressSteps.tsx'

/** 채울 방법을 받는 동안의 진행 화면. 서버가 한 번에 돌려줘서 중간 단계는 받는 신호가 없다. */
export function DirectionsLoading({ batch, total }: { batch: number; total: number }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      <div className="head">
        <h1>부족한 부분을 채울 방법을 찾고 있어요</h1>
        <span className="lead-line">시작한 지 {seconds}초 지났어요.</span>
      </div>
      <ProgressSteps
        steps={[
          {
            label: total > batch ? `부족한 요건 ${total}개 중 먼저 볼 ${batch}개를 골랐어요.` : `채워야 할 요건 ${batch}개를 정리했어요.`,
            state: 'done',
          },
          { label: 'AI가 요건마다 공부와 프로젝트 방법을 2~3개씩 쓰고 있어요.', state: 'on' },
          { label: '방법의 형식이 맞는지 확인할게요.', state: 'wait' },
        ]}
      />
    </>
  )
}
