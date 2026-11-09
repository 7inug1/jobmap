import { describe, expect, it } from 'vitest';
import { checkEvidence, restoreQuote } from './check-evidence.ts';

const sources = {
	posting: '자격 요건\nReact와 TypeScript로 3년 이상 개발한 경험이 있어요.\n테스트 코드를 작성해 본 경험이 있어요.',
	resume: '주식 정보 화면을 React와 TypeScript로 만들었습니다.\n렌더링 시간을 40% 줄였습니다.',
};

const row = {
	requirement: 'React, TypeScript 3년 이상',
	verdict: 'met' as const,
	postingQuote: 'React와 TypeScript로 3년 이상 개발한 경험이 있어요.',
	resumeQuote: '주식 정보 화면을 React와 TypeScript로 만들었습니다.',
};

describe('checkEvidence', () => {
	it('두 근거가 원문에 그대로 있으면 문제가 없다', () => {
		expect(checkEvidence([row], sources)).toEqual([]);
	});

	it('공고에 없는 공고 근거를 찾아낸다', () => {
		const rows = [{ ...row, postingQuote: 'Next.js 운영 경험이 있어요.' }];
		expect(checkEvidence(rows, sources)).toEqual([
			{ rowIndex: 0, field: 'postingQuote', reason: 'not_found' },
		]);
	});

	it('이력서에 없는 이력서 근거를 찾아낸다', () => {
		const rows = [{ ...row, resumeQuote: 'MAU 100만 서비스를 운영했습니다.' }];
		expect(checkEvidence(rows, sources)).toEqual([
			{ rowIndex: 0, field: 'resumeQuote', reason: 'not_found' },
		]);
	});

	it('공고 문장을 이력서 근거로 쓰면 통과시키지 않는다', () => {
		const rows = [{ ...row, resumeQuote: row.postingQuote }];
		expect(checkEvidence(rows, sources)).toEqual([
			{ rowIndex: 0, field: 'resumeQuote', reason: 'not_found' },
		]);
	});

	it('줄바꿈과 공백 차이는 같은 문장으로 본다', () => {
		const rows = [{ ...row, postingQuote: 'React와  TypeScript로\n3년 이상 개발한 경험이 있어요.' }];
		expect(checkEvidence(rows, sources)).toEqual([]);
	});

	it('자모가 분리된 한글도 같은 문장으로 본다', () => {
		const rows = [{ ...row, resumeQuote: row.resumeQuote.normalize('NFD') }];
		expect(checkEvidence(rows, sources)).toEqual([]);
	});

	it('빈 근거는 어디에나 포함되는 것으로 치지 않는다', () => {
		const rows = [{ ...row, postingQuote: '   ', resumeQuote: '' }];
		expect(checkEvidence(rows, sources)).toEqual([
			{ rowIndex: 0, field: 'postingQuote', reason: 'empty' },
			{ rowIndex: 0, field: 'resumeQuote', reason: 'empty' },
		]);
	});

	it('충족이나 일부 충족인데 이력서 근거가 없으면 문제로 본다', () => {
		const rows = [
			{ ...row, resumeQuote: null },
			{ ...row, verdict: 'partial' as const, resumeQuote: null },
		];
		expect(checkEvidence(rows, sources)).toEqual([
			{ rowIndex: 0, field: 'resumeQuote', reason: 'missing' },
			{ rowIndex: 1, field: 'resumeQuote', reason: 'missing' },
		]);
	});

	it('불충족은 이력서 근거가 없어도 된다', () => {
		const rows = [{ ...row, verdict: 'unmet' as const, resumeQuote: null }];
		expect(checkEvidence(rows, sources)).toEqual([]);
	});
});

describe('restoreQuote', () => {
	const source = '쇼핑몰 주문 화면을 React로 4년 동안 만들고\n운영했습니다.\n주문 폼에 단위 테스트를 작성했습니다.';

	it('깨진 글자가 없으면 그대로 돌려준다', () => {
		expect(restoreQuote('아무 문장', source)).toBe('아무 문장');
	});

	it('깨진 글자를 원문의 글자로 되돌린다', () => {
		expect(restoreQuote('����몰 주문 화면을 React로', source)).toBe('쇼핑몰 주문 화면을 React로');
		expect(restoreQuote('주문 ��에 단위 테스트', source)).toBe('주문 폼에 단위 테스트');
	});

	it('원문에 없는 문장은 복원하지 않아 확인에서 걸리게 한다', () => {
		const quote = '����몰 결제 화면을 Vue로';
		expect(restoreQuote(quote, source)).toBe(quote);
	});

	it('후보가 둘 이상이면 고르지 않는다', () => {
		const quote = '주문 ��을 만들었습니다';
		expect(restoreQuote(quote, '주문 폼을 만들었습니다. 주문 창을 만들었습니다')).toBe(quote);
	});

	it('글자가 거의 다 깨졌으면 복원하지 않는다', () => {
		expect(restoreQuote('�����', source)).toBe('�����');
		expect(restoreQuote('��에', source)).toBe('��에');
	});
});
