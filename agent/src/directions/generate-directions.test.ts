import { describe, expect, it, vi } from 'vitest';
import { checkDirections, generateDirections, parseJson } from './generate-directions.ts';

const gaps = [
	{ requirement: 'A/B 테스트 경험', verdict: 'unmet' as const },
	{ requirement: 'GraphQL 사용 경험', verdict: 'partial' as const },
];

const study = { label: 'A/B 테스트 공부', description: '가설과 지표를 정리해요.', lane: 'study', hours: 2, recommended: false };
const project = { label: '작은 실험 하기', description: '첫 화면 문구를 실험해요.', lane: 'project', hours: 4, recommended: true };

const valid = {
	directions: [
		{ gapNumber: 1, options: [study, project] },
		{ gapNumber: 2, options: [{ ...study, recommended: true }] },
	],
};

const issuesOf = (data: unknown) => {
	const result = checkDirections(data, gaps);
	return result.ok ? [] : result.issues;
};

describe('parseJson', () => {
	it('그대로 된 JSON과 코드 블록 안의 JSON을 읽는다', () => {
		expect(parseJson('{"a":1}')).toEqual({ a: 1 });
		expect(parseJson('결과입니다\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
	});

	it('JSON이 아니면 null이다', () => {
		expect(parseJson('죄송합니다')).toBeNull();
	});
});

describe('checkDirections', () => {
	it('요건 이름을 코드에서 붙여 번호순으로 돌려준다', () => {
		const shuffled = { directions: [valid.directions[1], valid.directions[0]] };
		expect(checkDirections(shuffled, gaps)).toEqual({
			ok: true,
			directions: [
				{ gapNumber: 1, requirement: 'A/B 테스트 경험', verdict: 'unmet', options: [study, project] },
				{ gapNumber: 2, requirement: 'GraphQL 사용 경험', verdict: 'partial', options: [{ ...study, recommended: true }] },
			],
		});
	});

	it('형식이 틀리면 문제로 돌려준다', () => {
		expect(issuesOf({ directions: 'x' })[0]).toMatch(/형식/);
		expect(issuesOf({ directions: [{ gapNumber: 1, options: [{ ...study, lane: 'x' }] }] })[0]).toMatch(/형식/);
	});

	it('빠진 요건, 없는 번호, 중복을 찾는다', () => {
		expect(issuesOf({ directions: [valid.directions[0]] }).join()).toMatch(/2번 요건/);
		expect(issuesOf({ directions: [...valid.directions, { gapNumber: 3, options: [study] }] }).join()).toMatch(/3번/);
		expect(issuesOf({ directions: [valid.directions[0], ...valid.directions] }).join()).toMatch(/1번/);
	});

	it('방법이 없거나 시간이 말이 안 되면 찾는다', () => {
		expect(issuesOf({ directions: [valid.directions[0], { gapNumber: 2, options: [] }] }).join()).toMatch(/2번 요건/);
		for (const hours of [0, -1, 1.5, 41]) {
			expect(issuesOf({ directions: [valid.directions[0], { gapNumber: 2, options: [{ ...study, hours }] }] }).join()).toMatch(/시간/);
		}
	});

	it('깨진 글자를 찾는다', () => {
		const broken = { ...study, label: '실험 ��하기' };
		expect(issuesOf({ directions: [valid.directions[0], { gapNumber: 2, options: [broken] }] }).join()).toMatch(/깨진/);
	});

	it('추천은 요건마다 하나만 남긴다', () => {
		const recommendedOf = (options: unknown[]) => {
			const result = checkDirections({ directions: [{ gapNumber: 1, options }, valid.directions[1]] }, gaps);
			return result.ok ? result.directions[0]!.options.map((option) => option.recommended) : null;
		};
		expect(recommendedOf([study, { ...project, recommended: false }])).toEqual([true, false]);
		expect(recommendedOf([{ ...study, recommended: true }, project])).toEqual([true, false]);
	});
});

describe('generateDirections', () => {
	const answer = (content: string) => ({ choices: [{ message: { content } }] });
	const input = { gaps, resume: '이력서' };

	it('첫 답이 맞으면 한 번만 호출한다', async () => {
		const ai = { run: vi.fn(async () => answer(JSON.stringify(valid))) };
		const result = await generateDirections(ai, input);
		expect(result.ok).toBe(true);
		expect(ai.run).toHaveBeenCalledTimes(1);
	});

	it('틀리면 문제를 알려 주며 다시 부른다', async () => {
		const ai = { run: vi.fn(async (_model: string, _inputs: { messages: { content: string }[] }) => answer(JSON.stringify(valid))) };
		ai.run.mockResolvedValueOnce(answer('{"directions":[]}'));
		const result = await generateDirections(ai, input);
		expect(result.ok).toBe(true);
		expect(ai.run).toHaveBeenCalledTimes(2);
		expect(ai.run.mock.calls[1]![1].messages.at(-1)!.content).toMatch(/1번 요건/);
	});

	it('세 번 틀리면 실패로 끝낸다', async () => {
		const ai = { run: vi.fn(async () => answer('죄송합니다')) };
		expect(await generateDirections(ai, input)).toEqual({ ok: false, reason: 'model_failed' });
		expect(ai.run).toHaveBeenCalledTimes(3);
	});

	it('모델 호출 자체가 실패해도 실패로 끝낸다', async () => {
		const ai = {
			run: vi.fn(async () => {
				throw new Error('boom');
			}),
		};
		expect(await generateDirections(ai, input)).toEqual({ ok: false, reason: 'model_failed' });
	});

	it('일일 한도 오류는 원인을 알려 주고 다시 부르지 않는다', async () => {
		const ai = {
			run: vi.fn(async () => {
				throw new Error('4006: you have used up your daily free allocation of 10,000 neurons');
			}),
		};
		expect(await generateDirections(ai, input)).toEqual({ ok: false, reason: 'quota' });
		expect(ai.run).toHaveBeenCalledTimes(1);
	});
});
