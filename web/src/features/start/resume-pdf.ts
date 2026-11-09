import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { itemsToText } from './resume-lines.ts'

/** 이력서 PDF의 글자를 브라우저 안에서 꺼낸다. 라이브러리는 파일을 고를 때만 불러온다. */
export async function readResumePdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const loading = pdfjs.getDocument({ data: await file.arrayBuffer() })
  try {
    const document = await loading.promise
    const pages: string[] = []
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      pages.push(itemsToText(content.items.flatMap((item) => ('str' in item ? [item] : []))))
    }
    return pages.filter((page) => page !== '').join('\n')
  } finally {
    await loading.destroy()
  }
}
