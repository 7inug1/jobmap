import { useEffect, useState } from 'react'
import { ProgressSteps } from '../../shared/ProgressSteps.tsx'

/** 이력서 문장을 받는 동안의 진행 화면. 서버가 한 번에 돌려줘서 중간 단계는 받는 신호가 없다. */
export function SentencesLoading({ count }: { count: number }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <>
      <div className="head">
        <h1>이력서에 넣을 문장을 쓰고 있어요</h1>
        <span className="lead-line">시작한 지 {seconds}초 지났어요.</span>
      </div>
      <ProgressSteps
        steps={[
          { label: `고른 프로젝트 ${count}개를 정리했어요.`, state: 'done' },
          { label: 'AI가 문장과 할 일, 이력서에 들어갈 자리를 정하고 있어요.', state: 'on' },
          { label: '들어갈 자리가 이력서에 실제로 있는지 확인할게요.', state: 'wait' },
        ]}
      />
    </>
  )
}
