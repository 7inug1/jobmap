import { describe, expect, it, vi } from 'vitest';
import { checkSentences, generateSentences, referenceLines } from './generate-sentences.ts';

const resume = '프로젝트\nDigestube 유튜브 영상을 책처럼 읽는 서비스\n- 검색 순서를 리랭커로 개선\n- PostgreSQL, pgvector로 문단과 벡터를 관리\nVIZUDEN 스타일 진단 AI 서비스\n- 설문을 보고서로 바꾸는 프롬프트 설계';

const picks = [
	{ requirement: '데이터 기반 실험 경험', label: 'A/B 테스트 하기', description: '첫 화면 문구를 실험해요.', hours: 4 },
	{ requirement: 'ts-pattern 경험', label: '분기 코드 바꾸기', description: 'switch를 ts-pattern으로 바꿔요.', hours: 2 },
];

const item = (pick: number | number[], extra: Record<string, unknown> = {}) => ({
	picks: Array.isArray(pick) ? pick : [pick],
	title: `프로젝트 ${Array.isArray(pick) ? pick.join('+') : pick}`,
	sentence: `${Array.isArray(pick) ? pick.join('+') : pick}번 문장을 A/B 테스트로 검증해 {실험 결과와 결정}`,
	steps: ['가설과 지표 쓰기', '실험 실행하기'],
	after: '- 검색 순서를 리랭커로 개선',
	...extra,
});

const valid = { sentences: [item(1), item(2, { after: null })] };
const issuesOf = (data: unknown) => {
	const result = checkSentences(data, picks, resume);
	return result.ok ? [] : result.issues;
};
const picksOf = (data: unknown) => {
	const result = checkSentences(data, picks, resume);
	return result.ok ? result.sentences.map((entry) => entry.picks) : null;
};

describe('checkSentences', () => {
	it('프로젝트마다 문장, 할 일, 들어갈 자리를 방법 번호순으로 돌려준다', () => {
		const result = checkSentences({ sentences: [item(2, { after: null }), item(1)] }, picks, resume);
		expect(result.ok && result.sentences.map((entry) => entry.picks)).toEqual([[1], [2]]);
		expect(result.ok && result.sentences[0]!.after).toBe('- 검색 순서를 리랭커로 개선');
		expect(result.ok && result.sentences[0]!.title).toBe('프로젝트 1');
	});

	it('여러 방법을 한 프로젝트로 묶은 문장을 받는다', () => {
		expect(picksOf({ sentences: [item([1, 2])] })).toEqual([[1, 2]]);
	});

	it('예전 형식(pick 하나)으로 답해도 받는다', () => {
		const { picks: _omit, ...legacy } = item(1);
		expect(picksOf({ sentences: [{ ...legacy, pick: 1 }, item(2)] })).toEqual([[1], [2]]);
	});

	it('한 프로젝트에는 방법 3개까지만 묶고 나머지는 빠진 방법이 된다', () => {
		const many = [...picks, picks[0]!, picks[1]!];
		const result = checkSentences({ sentences: [item([1, 2, 3, 4])] }, many, resume);
		expect(result.ok).toBe(false);
		expect(result.ok ? [] : result.issues.join()).toMatch(/4번/);
	});

	it('이름을 빼고 답하면 방법 이름을 이어 붙인다', () => {
		const result = checkSentences({ sentences: [item([1, 2], { title: ' ' })] }, picks, resume);
		expect(result.ok && result.sentences[0]!.title).toBe('A/B 테스트 하기 + 분기 코드 바꾸기');
	});

	it('형식이 틀리면 문제로 돌려준다', () => {
		expect(issuesOf({ sentences: 'x' })[0]).toMatch(/형식/);
		expect(issuesOf({ sentences: [{ picks: [1], sentence: '문장', steps: '할 일', after: null }] })[0]).toMatch(/형식/);
	});

	it('빠진 방법은 다시 쓰게 한다', () => {
		expect(issuesOf({ sentences: [item(1)] }).join()).toMatch(/2번/);
	});

	it('없는 번호와 이미 쓴 번호는 버린다', () => {
		expect(picksOf({ sentences: [...valid.sentences, item(3), item(1)] })).toEqual([[1], [2]]);
	});

	it('실제 결과를 넣을 빈칸이 없으면 빈칸을 붙인다', () => {
		const result = checkSentences({ sentences: [item(1, { sentence: 'A/B 테스트를 했습니다' }), item(2)] }, picks, resume);
		expect(result.ok && result.sentences[0]!.sentence).toBe('A/B 테스트를 했습니다 {실제 결과}');
	});

	it('문장이 비었거나 깨진 글자가 있으면 다시 쓰게 한다', () => {
		expect(issuesOf({ sentences: [item(1, { sentence: ' ' }), item(2)] }).join()).toMatch(/1번.*문장/);
		expect(issuesOf({ sentences: [item(1, { sentence: '실험 ��했다 {결과}' }), item(2)] }).join()).toMatch(/1번.*깨진/);
	});

	it('할 일은 1개 이상 5개까지만 받는다', () => {
		expect(issuesOf({ sentences: [item(1, { steps: [] }), item(2)] }).join()).toMatch(/1번.*할 일/);
		const many = Array.from({ length: 8 }, (_, index) => `할 일 ${index + 1}`);
		const result = checkSentences({ sentences: [item(1, { steps: many }), item(2)] }, picks, resume);
		expect(result.ok && result.sentences[0]!.steps).toHaveLength(5);
	});

	it('들어갈 자리가 이력서에 그대로 있지 않으면 null로 바꾼다', () => {
		const result = checkSentences({ sentences: [item(1, { after: '지어낸 문장입니다' }), item(2)] }, picks, resume);
		expect(result.ok && result.sentences[0]!.after).toBeNull();
	});

	it('구두점만 다르게 적은 들어갈 자리는 이력서 문장으로 되돌린다', () => {
		const result = checkSentences({ sentences: [item(1, { after: 'PostgreSQL pgvector로 문단과 벡터를 관리' }), item(2)] }, picks, resume);
		expect(result.ok && result.sentences[0]!.after).toBe('PostgreSQL, pgvector로 문단과 벡터를 관리');
	});
});

describe('referenceLines', () => {
	it('이력서에서 수치가 들어 있는 구체적인 문장을 말투 참고로 고른다', () => {
		const lines = referenceLines('경력\n- 디자인 시스템 설계\n- 리랭커 적용 후 근거가 6개에서 8개로 증가\n- 렌더링 시간을 40% 줄였습니다\n기술\nReact 4년');
		expect(lines).toEqual(['리랭커 적용 후 근거가 6개에서 8개로 증가', '렌더링 시간을 40% 줄였습니다']);
	});

	it('수치가 있는 문장이 없으면 가장 긴 문장을 고른다', () => {
		expect(referenceLines('경력\n- 짧은 줄\n- 디자인 시스템과 공용 컴포넌트를 설계했습니다')).toEqual(['디자인 시스템과 공용 컴포넌트를 설계했습니다']);
	});

	it('고를 문장이 없으면 비어 있다', () => {
		expect(referenceLines('React')).toEqual([]);
	});
});

describe('generateSentences', () => {
	const answer = (text: string) => ({ choices: [{ message: { content: text } }] });

	it('첫 답이 맞으면 한 번만 부른다', async () => {
		const ai = { run: vi.fn(async () => answer(JSON.stringify(valid))) };
		const result = await generateSentences(ai, { resume, picks });
		expect(result.ok).toBe(true);
		expect(ai.run).toHaveBeenCalledTimes(1);
	});

	it('틀리면 문제를 알려 주고 다시 받는다', async () => {
		const ai = { run: vi.fn(async (_model: string, _inputs: { messages: { content: string }[] }) => answer(JSON.stringify(valid))) };
		ai.run.mockResolvedValueOnce(answer('{"sentences":[]}'));
		expect((await generateSentences(ai, { resume, picks })).ok).toBe(true);
		expect(ai.run.mock.calls[1]![1].messages.at(-1)!.content).toMatch(/1번/);
	});

	it('세 번 틀리면 실패로 끝낸다', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const ai = { run: vi.fn(async () => answer('죄송합니다')) };
		expect(await generateSentences(ai, { resume, picks })).toEqual({ ok: false, reason: 'model_failed' });
		expect(ai.run).toHaveBeenCalledTimes(3);
		warn.mockRestore();
	});

	it('일시적인 모델 오류는 다시 부르고, 하루 한도 오류는 바로 끝낸다', async () => {
		const retry = { run: vi.fn(async () => answer(JSON.stringify(valid))) };
		retry.run.mockRejectedValueOnce(new Error('capacity'));
		expect((await generateSentences(retry, { resume, picks })).ok).toBe(true);

		const quota = { run: vi.fn(async () => { throw new Error('4006: you have used up your daily free allocation'); }) };
		expect(await generateSentences(quota, { resume, picks })).toEqual({ ok: false, reason: 'quota' });
		expect(quota.run).toHaveBeenCalledTimes(1);
	});
});
