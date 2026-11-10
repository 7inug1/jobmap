import type { Direction, SentenceItem } from '../../shared/types.ts'

const BLANK_PATTERN = /\{([^{}]+)\}/g

export type SentencePart = { kind: 'text' | 'blank' | 'filled'; text: string }

/** 문장 안의 {빈칸} 이름. 같은 이름은 한 번만 센다. */
export function blanksOf(sentence: string): string[] {
  return [...new Set([...sentence.matchAll(BLANK_PATTERN)].map((match) => match[1]!))]
}

/** 문장을 글, 아직 비운 빈칸, 채운 값으로 나눈다. */
export function sentenceParts(sentence: string, answers: Readonly<Record<string, string>>): SentencePart[] {
  const parts: SentencePart[] = []
  let last = 0
  for (const match of sentence.matchAll(BLANK_PATTERN)) {
    if (match.index > last) parts.push({ kind: 'text', text: sentence.slice(last, match.index) })
    const answer = answers[match[1]!]
    parts.push(answer ? { kind: 'filled', text: answer } : { kind: 'blank', text: match[1]! })
    last = match.index + match[0].length
  }
  if (last < sentence.length) parts.push({ kind: 'text', text: sentence.slice(last) })
  return parts
}

export function completedSentence(sentence: string, answers: Readonly<Record<string, string>>): string {
  return sentence.replace(BLANK_PATTERN, (whole, name: string) => answers[name] || whole)
}

/** 할 일을 모두 해냈고 아직 완성하지 않은 문장만 결과를 넣을 수 있다. 고쳐서 없어진 할 일의 체크는 세지 않는다. */
export function readyToFill(item: SentenceItem): boolean {
  return !item.done && item.steps.length > 0 && item.steps.every((step) => item.ticked.includes(step))
}

export type PickInfo = { key: string; requirement: string; label: string; description: string; hours: number }

/** 고른 방법 중 프로젝트만 이력서에 문장이 들어간다. 공부는 지식으로 남는다. */
export function projectPicks(directions: readonly Direction[], picks: readonly string[]): PickInfo[] {
  return directions.flatMap(({ gapNumber, requirement, options }) =>
    options.flatMap((option, index) => {
      const key = `${gapNumber}:${index}`
      return option.lane === 'project' && picks.includes(key)
        ? [{ key, requirement, label: option.label, description: option.description, hours: option.hours }]
        : []
    }),
  )
}

/** 아직 문장을 만들지 않은 방법. */
export function missingPicks(items: readonly SentenceItem[], picks: readonly PickInfo[]): PickInfo[] {
  return picks.filter(({ key }) => !items.some((item) => item.key === key))
}

export type GeneratedSentence = { sentence: string; steps: string[]; after: string | null }

/** 고른 방법 순서대로 문장을 맞춘다. 이미 있는 문장은 그대로 두고, 고르지 않게 된 방법의 문장은 뺀다. */
export function reconcileItems(items: readonly SentenceItem[], picks: readonly PickInfo[], generated: ReadonlyMap<string, GeneratedSentence>): SentenceItem[] {
  return picks.flatMap((pick) => {
    const kept = items.find((item) => item.key === pick.key)
    if (kept) return [kept]
    const made = generated.get(pick.key)
    if (!made) return []
    return [{ key: pick.key, requirement: pick.requirement, label: pick.label, hours: pick.hours, ...made, ticked: [], answers: {}, done: false }]
  })
}

export const PAGE_BREAK = '\f'

/** 이력서 글을 쪽과 줄로 나눈다. PDF에서 읽은 글은 쪽 사이에 구분(\f)이 있다. */
export function resumePages(resume: string): string[][] {
  return resume.split(PAGE_BREAK).map((page) => page.split('\n').map((line) => line.trim()).filter((line) => line !== ''))
}

export type ResumeEntry = { kind: 'line'; text: string } | { kind: 'added'; item: SentenceItem }

function loose(text: string): string {
  return Array.from(text.normalize('NFC'))
    .filter((char) => /[\p{L}\p{N}]/u.test(char))
    .join('')
    .toLowerCase()
}

function findLine(pages: readonly (readonly string[])[], wanted: string): { page: number; line: number } | null {
  for (let page = 0; page < pages.length; page += 1) {
    const line = pages[page]!.findIndex((text) => loose(text).includes(wanted))
    if (line !== -1) return { page, line }
  }
  return null
}

/**
 * 문장을 이력서의 들어갈 자리(기존 문장) 바로 아래에 넣는다. 구두점이 달라도 같은 줄로 본다.
 * 자리를 모르거나 이력서에 없는 문장은 맨 아래 새 항목(unplaced)으로 모은다.
 * target은 확대해서 보여 줄 곳이다. 첫 번째로 들어가는 자리이고, 없으면 새 항목이 놓일 맨 아래다.
 */
export function placeSentences(pages: readonly (readonly string[])[], items: readonly SentenceItem[]) {
  const placed: ResumeEntry[][] = pages.map((lines) => lines.map((text): ResumeEntry => ({ kind: 'line', text })))
  const unplaced: SentenceItem[] = []
  let target: { page: number; line: number } | null = null

  for (const item of items) {
    const wanted = item.after === null ? '' : loose(item.after)
    const spot = wanted === '' ? null : findLine(pages, wanted)
    if (!spot) {
      unplaced.push(item)
      continue
    }
    const entries = placed[spot.page]!
    // 같은 줄 아래에 이미 넣은 문장이 있으면 그 뒤에 이어 넣는다.
    let index = entries.findIndex((entry) => entry.kind === 'line' && entry.text === pages[spot.page]![spot.line])
    while (entries[index + 1]?.kind === 'added') index += 1
    entries.splice(index + 1, 0, { kind: 'added', item })
    target ??= spot
  }

  if (!target && unplaced.length > 0) {
    const page = Math.max(0, pages.length - 1)
    target = { page, line: Math.max(0, (pages[page]?.length ?? 1) - 1) }
  }
  return { pages: placed, unplaced, target }
}

/** 확대할 자리 바로 아래에 들어가는 문장 수. 자리가 없는 문장만 있으면 새 항목의 문장 수다. */
export function addedAtTarget(placed: ReturnType<typeof placeSentences>): number {
  const { target } = placed
  if (!target) return 0
  const entries = placed.pages[target.page]!
  let lines = -1
  const at = entries.findIndex((entry) => entry.kind === 'line' && (lines += 1) === target.line)
  let count = 0
  while (at !== -1 && entries[at + 1 + count]?.kind === 'added') count += 1
  return count > 0 ? count : placed.unplaced.length
}

