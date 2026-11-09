export type TextItem = { str: string; width: number; height: number; transform: number[] }

const SAME_LINE_RATIO = 0.5
const SPACE_GAP_RATIO = 0.15
// Chrome으로 만든 PDF는 띄어쓰기가 U+0001 같은 제어 문자로 나온다. 줄바꿈은 남긴다.
const CONTROL_CHARS = /[^\P{Cc}\n]/gu

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

/**
 * PDF 한 쪽의 글자 조각을 줄로 묶는다.
 * 위치로 다시 정렬하면 2단 문서의 왼쪽과 오른쪽이 섞이므로 PDF에 적힌 순서를 그대로 쓴다.
 */
export function itemsToText(items: readonly TextItem[]): string {
  const lines: TextItem[][] = []

  for (const item of items.filter(({ str }) => str.trim() !== '')) {
    const current = lines.at(-1)
    const sameLine = current && Math.abs(current[0].transform[5] - item.transform[5]) <= item.height * SAME_LINE_RATIO
    if (sameLine) current.push(item)
    else lines.push([item])
  }

  return lines.map(joinLine).join('\n').replace(CONTROL_CHARS, ' ')
}
