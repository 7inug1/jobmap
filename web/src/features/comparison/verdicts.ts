import type { Verdict } from '../../shared/types.ts'

export const VERDICTS: { value: Verdict; label: string; className: string }[] = [
  { value: 'met', label: '충족', className: 'ok' },
  { value: 'partial', label: '일부 충족', className: 'part' },
  { value: 'unmet', label: '불충족', className: 'lack' },
]
