import type { PostingSource } from './posting-sources.ts'

export const MIN_RESUME_LENGTH = 50
const MIN_POSTING_LENGTH = 200
const MAX_TEXT_LENGTH = 30_000
const MAX_PDF_BYTES = 10 * 1024 * 1024

export type PostingNotice = { title: string; body: string }

const POSTING_FAILURES: Record<string, string> = {
  invalid_url: '공개된 https 주소만 읽을 수 있어요.',
  fetch_failed: '이 주소를 열지 못했어요. 공고가 마감됐거나 사이트가 자동 접근을 막았을 수 있어요.',
  not_html: '웹 페이지 주소만 읽을 수 있어요.',
  no_text: '이 페이지에서 공고 글을 찾지 못했어요.',
}
const UNKNOWN_FAILURE = '이 주소에서 공고를 가져오지 못했어요.'

/** 주소 입력란 안내. 서버에 보내기 전에 걸러 호출을 줄인다. */
export function checkPostingUrl(raw: string): string | null {
  if (raw === '') return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return 'https로 시작하는 공고 주소를 넣어 주세요.'
  }
  return url.protocol === 'https:' ? null : 'https로 시작하는 주소만 읽을 수 있어요.'
}

function checkText(text: string, name: string, min: number): string | null {
  const length = text.trim().length
  if (length === 0) return null
  if (length < min) return `${name} 내용이 너무 짧아요. ${min}자 이상 넣어 주세요.`
  if (length > MAX_TEXT_LENGTH) {
    return `${name} 내용이 너무 길어요. ${MAX_TEXT_LENGTH.toLocaleString('en-US')}자까지 넣을 수 있는데 지금 ${length.toLocaleString('en-US')}자예요.`
  }
  return null
}

export function checkPostingText(text: string): string | null {
  return checkText(text, '공고', MIN_POSTING_LENGTH)
}

export function checkResumeText(text: string): string | null {
  return checkText(text, '이력서', MIN_RESUME_LENGTH)
}

export function checkPdfSize(bytes: number): string | null {
  return bytes > MAX_PDF_BYTES ? 'PDF가 너무 커요. 10MB 이하 파일을 넣거나 내용을 붙여 넣어 주세요.' : null
}

export function pdfErrorMessage(error: unknown): string {
  return error instanceof Error && error.name === 'PasswordException'
    ? '암호가 걸린 PDF는 읽지 못해요. 암호를 풀어 다시 첨부하거나 내용을 붙여 넣어 주세요.'
    : 'PDF를 읽지 못했어요. 내용을 붙여 넣어 주세요.'
}

/** 공고를 링크로 읽을 수 없을 때 모달에 보여 줄 문구를 만든다. */
export function describePostingFailure(source: PostingSource, reason?: string): PostingNotice {
  if (source.kind === 'unsupported') {
    return {
      title: `${source.name} 공고는 아직 링크로 읽지 못해요`,
      body: '공고 본문을 복사해 붙여 넣거나, 아래 사이트의 공고 링크를 넣어 주세요.',
    }
  }
  return {
    title: source.kind === 'supported' ? `${source.name} 공고를 읽지 못했어요` : '이 사이트의 공고를 읽지 못했어요',
    body: (reason && POSTING_FAILURES[reason]) || UNKNOWN_FAILURE,
  }
}
