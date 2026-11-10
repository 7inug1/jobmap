import { sentenceParts } from './sentences.ts'

/** 문장을 보여 준다. 아직 비운 빈칸은 점선 칸으로, 채운 값은 그대로 보여 준다. */
export function SentenceText({ sentence, answers }: { sentence: string; answers: Record<string, string> }) {
  return (
    <>
      {sentenceParts(sentence, answers).map((part, index) =>
        part.kind === 'blank' ? (
          <span className="blank" key={index}>
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  )
}
