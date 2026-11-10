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

	it('형식이 틀린 위치를 문제에 적는다', () => {
		const message = issuesOf({ directions: [{ gapNumber: 1, options: [{ ...study, hours: '2시간' }] }] })[0];
		expect(message).toMatch(/directions\.0\.options\.0\.hours/);
	});

	it('형식이 틀리면 문제로 돌려준다', () => {
		expect(issuesOf({ directions: 'x' })[0]).toMatch(/형식/);
		expect(issuesOf({ directions: [{ gapNumber: 1, options: [{ ...study, lane: 'x' }] }] })[0]).toMatch(/형식/);
	});

	it('빠진 요건과 방법이 없는 요건은 다시 쓰게 한다', () => {
		expect(issuesOf({ directions: [valid.directions[0]] }).join()).toMatch(/2번 요건/);
		expect(issuesOf({ directions: [valid.directions[0], { gapNumber: 2, options: [] }] }).join()).toMatch(/2번 요건/);
	});

	it('없는 번호와 중복된 번호는 버리고 나머지를 받는다', () => {
		const extra = { directions: [...valid.directions, { gapNumber: 3, options: [study] }, valid.directions[0]] };
		const result = checkDirections(extra, gaps);
		expect(result.ok).toBe(true);
		expect(result.ok ? result.directions.map((direction) => direction.gapNumber) : []).toEqual([1, 2]);
	});

	it('시간은 정수로 맞추고 최소 시간 상한(공부 6시간, 프로젝트 12시간)을 넘으면 상한으로 줄인다', () => {
		const hoursOf = (option: typeof study, hours: number) => {
			const result = checkDirections({ directions: [valid.directions[0], { gapNumber: 2, options: [{ ...option, hours }] }] }, gaps);
			return result.ok ? result.directions[1]!.options[0]!.hours : null;
		};
		expect([0, -1, 1.5, 2.4, 7, 40].map((hours) => hoursOf(study, hours))).toEqual([1, 1, 2, 2, 6, 6]);
		expect([0, 2.4, 11.6, 13, 40].map((hours) => hoursOf(project, hours))).toEqual([1, 2, 12, 12, 12]);
	});

	it('시간이 숫자가 아니면 형식 문제다', () => {
		expect(issuesOf({ directions: [valid.directions[0], { gapNumber: 2, options: [{ ...study, hours: '2시간' }] }] })[0]).toMatch(/형식/);
	});

	it('깨진 글자가 있는 방법은 버리고 다른 방법을 받는다', () => {
		const broken = { ...study, label: '실험 ��하기' };
		const result = checkDirections({ directions: [{ gapNumber: 1, options: [broken, project] }, valid.directions[1]] }, gaps);
		expect(result.ok ? result.directions[0]!.options.map((option) => option.label) : null).toEqual(['작은 실험 하기']);
	});

	it('방법이 모두 깨졌으면 다시 쓰게 한다', () => {
		const broken = { ...study, label: '실험 ��하기' };
		expect(issuesOf({ directions: [{ gapNumber: 1, options: [broken] }, valid.directions[1]] }).join()).toMatch(/1번 요건.*깨진/);
	});

	it('추천 표시를 빼고 답해도 받고, 추천이 없으면 첫 방법을 추천한다', () => {
		const { recommended: _omitted, ...withoutRecommended } = project;
		const result = checkDirections({ directions: [{ gapNumber: 1, options: [{ ...study, recommended: undefined }, withoutRecommended] }, valid.directions[1]] }, gaps);
		expect(result.ok ? result.directions[0]!.options.map((option) => option.recommended) : null).toEqual([true, false]);
	});

	it('설명을 빼고 답해도 받는다', () => {
		const { description: _omitted, ...withoutDescription } = study;
		const result = checkDirections({ directions: [{ gapNumber: 1, options: [withoutDescription] }, valid.directions[1]] }, gaps);
		expect(result.ok ? result.directions[0]!.options[0]!.description : null).toBe('');
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

	it('모델 호출이 일시적으로 한 번 실패하면 다시 불러 받는다', async () => {
		const ai = { run: vi.fn(async () => answer(JSON.stringify(valid))) };
		ai.run.mockRejectedValueOnce(new Error('capacity'));
		expect((await generateDirections(ai, input)).ok).toBe(true);
		expect(ai.run).toHaveBeenCalledTimes(2);
	});

	it('틀린 시도마다 어떤 문제였는지 로그로 남긴다', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const ai = { run: vi.fn(async () => answer('죄송합니다')) };
		await generateDirections(ai, input);
		expect(warn).toHaveBeenCalledTimes(3);
		expect(warn.mock.calls[0]![0]).toBe('directions_attempt_failed');
		warn.mockRestore();
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
