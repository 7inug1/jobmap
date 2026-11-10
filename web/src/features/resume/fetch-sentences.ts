import type { GeneratedProject, PickInfo } from './sentences.ts'

type Response =
  | { ok: true; sentences: { picks: number[]; title: string; sentence: string; steps: string[]; after: string | null }[] }
  | { ok: false; reason: string }

/** 고른 프로젝트 방법을 이력서 프로젝트로 바꾼다. 방법 여러 개가 한 프로젝트로 묶여 올 수 있다. */
export async function fetchSentences(picks: readonly PickInfo[], resume: string): Promise<GeneratedProject[]> {
  const response = await fetch('/api/resume-sentences', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ resume, picks: picks.map(({ requirement, label, description, hours }) => ({ requirement, label, description, hours })) }),
  })
  const result = (await response.json()) as Response
  if (!result.ok) throw new Error(result.reason)
  return result.sentences.flatMap(({ picks: numbers, title, sentence, steps, after }) => {
    const keys = numbers.flatMap((number) => (picks[number - 1] ? [picks[number - 1]!.key] : []))
    return keys.length > 0 ? [{ keys, title, sentence, steps, after }] : []
  })
}
