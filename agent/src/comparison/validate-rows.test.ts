import { describe, expect, it } from 'vitest';
import { validateRows } from './validate-rows.ts';

const posting = 'React 기반으로 제품을 3년 이상 만들어본 분';
const resume = '투자 정보 화면을 React로 만들었습니다.';
const row = { requirement: 'React 3년 이상', verdict: 'met' as const, postingQuote: posting, resumeQuote: resume };

describe('validateRows', () => {
	it('근거가 원문에 있으면 행을 돌려준다', () => {
		expect(validateRows({ rows: [row], posting, resume })).toEqual({ ok: true, rows: [row] });
	});

	it('근거가 원문에 없으면 몇 번째 줄이 틀렸는지 알려 준다', () => {
		const result = validateRows({ rows: [row, { ...row, resumeQuote: '지어낸 문장' }], posting, resume });
		expect(result.ok).toBe(false);
		expect(result.ok ? [] : result.issues).toEqual([expect.stringMatching(/2번째 줄 resumeQuote/)]);
	});

	it('전송 중 깨진 한글은 원문으로 되돌린다', () => {
		const broken = { ...row, resumeQuote: '투자 정보 화면을 React로 만�었습니다.' };
		expect(validateRows({ rows: [broken], posting, resume })).toEqual({ ok: true, rows: [row] });
	});

	it('요건이 하나도 없으면 다시 쓰게 한다', () => {
		const result = validateRows({ rows: [], posting, resume });
		expect(result.ok ? [] : result.issues).toEqual([expect.stringMatching(/한 줄도/)]);
	});
});
