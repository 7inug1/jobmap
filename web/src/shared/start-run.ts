import { createFlueClient } from '@flue/sdk'
import type { Inputs, Run } from './types.ts'

export async function startRun(inputs: Inputs): Promise<Run> {
  const id = crypto.randomUUID()
  const client = createFlueClient({ url: new URL(`/agents/jobmap/${id}`, location.origin).href })
  await client.send({ message: { kind: 'user', body: '공고와 이력서를 비교해 주세요' }, initialData: inputs })
  return { ...inputs, id, edits: {}, createdAt: Date.now() }
}
