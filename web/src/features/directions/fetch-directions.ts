import type { Direction, Gap } from '../../shared/types.ts'

export async function fetchDirections(gaps: Gap[], resume: string): Promise<Direction[]> {
  const response = await fetch('/api/directions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gaps, resume }),
  })
  const result = (await response.json()) as { ok: true; directions: Direction[] } | { ok: false; reason: string }
  if (!result.ok) throw new Error(result.reason)
  return result.directions
}
