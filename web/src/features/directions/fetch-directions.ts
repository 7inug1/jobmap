import type { Direction, Gap } from '../../shared/types.ts'

export async function fetchDirections(gaps: Gap[], resume: string): Promise<Direction[]> {
  const response = await fetch('/api/directions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gaps, resume }),
  })
  const result = (await response.json()) as { ok: true; directions: Direction[] } | { ok: false }
  if (!result.ok) throw new Error('directions_failed')
  return result.directions
}
