import type { GeneratedSentence, PickInfo } from './sentences.ts'

type Response = { ok: true; sentences: { pick: number; sentence: string; steps: string[]; after: string | null }[] } | { ok: false; reason: string }

/** 고른 프로젝트 방법마다 이력서 문장, 할 일, 들어갈 자리를 받는다. 키는 방법을 고른 키다. */
export async function fetchSentences(picks: readonly PickInfo[], resume: string): Promise<Map<string, GeneratedSentence>> {
  const response = await fetch('/api/resume-sentences', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ resume, picks: picks.map(({ requirement, label, description, hours }) => ({ requirement, label, description, hours })) }),
  })
  const result = (await response.json()) as Response
  if (!result.ok) throw new Error(result.reason)
  return new Map(result.sentences.flatMap(({ pick, sentence, steps, after }) => (picks[pick - 1] ? [[picks[pick - 1]!.key, { sentence, steps, after }] as const] : [])))
}
