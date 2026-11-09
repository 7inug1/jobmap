import { describe, expect, it, vi } from 'vitest';
import { createSaveComparison } from './save-comparison.ts';

const posting = 'React 기반으로 제품을 3년 이상 만들어본 분';
const resume = '투자 정보 화면을 React로 만들었습니다.';

const row = {
	requirement: 'React 3년 이상',
	verdict: 'met' as const,
	postingQuote: posting,
	resumeQuote: resume,
};

function run(rows: (typeof row)[]) {
	const onProgress = vi.fn();
	const tool = createSaveComparison({ posting, resume, onProgress });
	const result = tool.run({ data: { rows }, toolCallId: 'test' } as never);
	return { result, onProgress };
}

describe('save_comparison', () => {
	it('근거가 원문에 있으면 표를 돌려준다', () => {
		const { result } = run([row]);
		expect(result).toEqual({ output: { rows: [row] } });
	});

	it('근거가 원문에 없으면 어느 행이 틀렸는지 알려 주며 거부한다', () => {
		expect(() => run([row, { ...row, resumeQuote: '지어낸 문장' }])).toThrow(/2번째 행.*resumeQuote/);
	});

	it('전송 중 깨진 한글은 원문으로 되돌려 저장한다', () => {
		const broken = { ...row, requirement: 'Re��ct 3년', resumeQuote: '투자 정보 ��면을 React로 만들었습니다.' };
		expect(run([broken]).result).toEqual({
			output: { rows: [{ ...row, requirement: row.postingQuote, resumeQuote: resume }] },
		});
	});

	it('요건이 하나도 없으면 거부한다', () => {
		expect(() => run([])).toThrow(/요건/);
	});

	it('근거를 확인하는 동안 진행 상태를 알린다', () => {
		const { onProgress } = run([row]);
		expect(onProgress).toHaveBeenCalledWith('근거 문장 확인하기');
	});
});
