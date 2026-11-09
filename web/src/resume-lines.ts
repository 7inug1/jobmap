export type TextItem = { str: string; width: number; height: number; transform: number[] }

const SAME_LINE_RATIO = 0.5
const SPACE_GAP_RATIO = 0.15

function joinLine(line: TextItem[]): string {
  return line
    .toSorted((a, b) => a.transform[4] - b.transform[4])
    .reduce((text, item, index, sorted) => {
      if (index === 0) return item.str
      const previous = sorted[index - 1]
      const gap = item.transform[4] - (previous.transform[4] + previous.width)
      return text + (gap > item.height * SPACE_GAP_RATIO ? ' ' : '') + item.str
    }, '')
}

/** PDF 한 쪽의 글자 조각을 위치 기준으로 읽는 순서의 줄로 묶는다. */
export function itemsToText(items: readonly TextItem[]): string {
  const lines: TextItem[][] = []

  for (const item of items.filter(({ str }) => str.trim() !== '').toSorted((a, b) => b.transform[5] - a.transform[5])) {
    const current = lines.at(-1)
    const sameLine = current && Math.abs(current[0].transform[5] - item.transform[5]) <= item.height * SAME_LINE_RATIO
    if (sameLine) current.push(item)
    else lines.push([item])
  }

  return lines.map(joinLine).join('\n')
}
