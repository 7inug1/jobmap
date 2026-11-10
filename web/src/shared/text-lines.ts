export type LineKind = 'heading' | 'item' | 'text'

const ITEM_MARK = /^(?:[-•·*▪◦]|\d{1,2}[.)])\s+/
const SECTION_NAMES =
  /^(?:자격\s*요건|지원\s*자격|필수\s*(?:요건|사항|역량)|우대\s*(?:사항|요건)|주요\s*업무|담당\s*업무|업무\s*내용|복지|혜택|채용\s*절차|전형\s*절차|근무\s*조건|기술\s*스택|이런 분|qualifications?|requirements?|responsibilities|preferred(?: qualifications)?|nice to have|benefits|about (?:the )?(?:role|team|you|us)|what you(?:'|’)ll do|who you are|logistics)$/i
const MAX_HEADING_LENGTH = 40

function isHeadingLike(text: string): boolean {
  return text.length <= MAX_HEADING_LENGTH && !/[.!?。]$/.test(text) && !/^[\d$₩€£]/.test(text)
}

/**
 * 공고 줄을 제목, 목록 항목, 문단으로 나눈다. HTML 구조는 글로 옮기며 사라지므로 모양으로 추정한다.
 * 제목: 잘 알려진 섹션 이름, 쌍점으로 끝나는 짧은 줄, 목록 바로 위의 짧은 줄.
 */
export function classifyLines(lines: readonly string[]): { kind: LineKind; text: string }[] {
  const isItem = (text: string | undefined) => text !== undefined && ITEM_MARK.test(text.trim())
  return lines.map((raw, index) => {
    const text = raw.trim()
    const marked = /^#{1,6}\s+(.+)$/.exec(text)
    if (marked) return { kind: 'heading', text: marked[1]! }
    if (isItem(text)) return { kind: 'item', text: text.replace(ITEM_MARK, '') }
    const heading =
      isHeadingLike(text) && (SECTION_NAMES.test(text.replace(/:$/, '')) || text.endsWith(':') || isItem(lines[index + 1]))
    return { kind: heading ? 'heading' : 'text', text }
  })
}
