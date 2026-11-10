import { describe, expect, it, vi } from 'vitest';
import { checkSentences, generateSentences } from './generate-sentences.ts';

const resume = '프로젝트\nDigestube 유튜브 영상을 책처럼 읽는 서비스\n- 검색 순서를 리랭커로 개선\n- PostgreSQL, pgvector로 문단과 벡터를 관리\nVIZUDEN 스타일 진단 AI 서비스\n- 설문을 보고서로 바꾸는 프롬프트 설계';

const picks = [
	{ requirement: '데이터 기반 실험 경험', label: 'A/B 테스트 하기', description: '첫 화면 문구를 실험해요.', hours: 4 },
	{ requirement: 'ts-pattern 경험', label: '분기 코드 바꾸기', description: 'switch를 ts-pattern으로 바꿔요.', hours: 2 },
];

const item = (pick: number, extra: Record<string, unknown> = {}) => ({
	pick,
	sentence: `${pick}번 문장을 A/B 테스트로 검증해 {실험 결과와 결정}`,
	steps: ['가설과 지표 쓰기', '실험 실행하기'],
	after: '- 검색 순서를 리랭커로 개선',
	...extra,
});

const valid = { sentences: [item(1), item(2, { after: null })] };
const issuesOf = (data: unknown) => {
	const result = checkSentences(data, picks, resume);
	return result.ok ? [] : result.issues;
};

describe('checkSentences', () => {
	it('방법마다 문장, 할 일, 들어갈 자리를 번호순으로 돌려준다', () => {
		const result = checkSentences({ sentences: [item(2, { after: null }), item(1)] }, picks, resume);
		expect(result.ok && result.sentences.map(({ pick }) => pick)).toEqual([1, 2]);
		expect(result.ok && result.sentences[0]!.after).toBe('- 검색 순서를 리랭커로 개선');
	});

	it('형식이 틀리면 문제로 돌려준다', () => {
		expect(issuesOf({ sentences: 'x' })[0]).toMatch(/형식/);
		expect(issuesOf({ sentences: [{ pick: 1, sentence: '문장', steps: '할 일', after: null }] })[0]).toMatch(/형식/);
	});

	it('빠진 방법은 다시 쓰게 한다', () => {
		expect(issuesOf({ sentences: [item(1)] }).join()).toMatch(/2번/);
	});

	it('없는 번호와 중복 번호는 버린다', () => {
		const result = checkSentences({ sentences: [...valid.sentences, item(3), item(1)] }, picks, resume);
		expect(result.ok && result.sentences.map(({ pick }) => pick)).toEqual([1, 2]);
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
