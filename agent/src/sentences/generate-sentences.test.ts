import { describe, expect, it, vi } from 'vitest';
import { checkSentences, existingNames, generateSentences, projectSectionEnd, referenceLines } from './generate-sentences.ts';

const resume = '경력\n한경에이셀 프론트엔드 2022.09 - 2026.02\n- 디자인 시스템 설계\n주요 프로젝트\nDigestube 유튜브 영상을 책처럼 읽는 서비스\n- 검색 순서를 리랭커로 개선\n- PostgreSQL, pgvector로 문단과 벡터를 관리\nVIZUDEN 스타일 진단 AI 서비스\n- 설문을 보고서로 바꾸는 프롬프트 설계\n기술\nReact, TypeScript';

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
		expect(result.ok && result.sentences[0]!.title).toBe('프로젝트 1');
	});

	it('들어갈 자리는 모델이 정한 곳이 아니라 이력서의 프로젝트 영역 맨 끝 줄이다', () => {
		// 모델이 이전 회사 항목 아래를 가리켜도 새 별개 프로젝트이므로 무시한다.
		const result = checkSentences({ sentences: [item(1, { after: '- 디자인 시스템 설계' }), item(2, { after: '지어낸 줄' })] }, picks, resume);
		expect(result.ok && result.sentences.map((entry) => entry.after)).toEqual(['- 설문을 보고서로 바꾸는 프롬프트 설계', '- 설문을 보고서로 바꾸는 프롬프트 설계']);
	});

	it('프로젝트 영역이 없으면 들어갈 자리를 정하지 않는다', () => {
		const result = checkSentences({ sentences: [item(1), item(2)] }, picks, '경력\n한경에이셀 프론트엔드\n- 디자인 시스템 설계');
		expect(result.ok && result.sentences.map((entry) => entry.after)).toEqual([null, null]);
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
});

describe('existingNames', () => {
	it('목록 바로 위의 줄에서 이력서에 있는 회사와 프로젝트 이름을 뽑는다', () => {
		expect(existingNames(resume)).toEqual(['한경에이셀', 'Digestube', 'VIZUDEN']);
	});

	it('이름이 될 수 없는 짧은 말과 영역 제목은 뽑지 않는다', () => {
		expect(existingNames('경력\n- 일\n주요 프로젝트\n- 일\nAI 서비스\n- 일')).toEqual([]);
	});

	it('목록이 없는 이력서에서는 뽑지 않는다', () => {
		expect(existingNames('경력\n한경에이셀 프론트엔드\n기술\nReact')).toEqual([]);
	});
});

describe('기존 회사와 프로젝트 이름', () => {
	it('문장, 이름, 할 일에 이력서의 회사나 프로젝트 이름이 나오면 새 프로젝트로 다시 쓰게 한다', () => {
		const text = (extra: Record<string, unknown>) => checkSentences({ sentences: [item(1, extra), item(2)] }, picks, resume);
		for (const extra of [{ sentence: 'Digestube에 A/B 테스트를 붙여 {결과}' }, { title: '한경에이셀 개선' }, { steps: ['VIZUDEN 보고서 고치기'] }]) {
			const result = text(extra);
			expect(result.ok).toBe(false);
			expect(result.ok ? '' : result.issues.join()).toMatch(/1번.*새.*별개/);
		}
	});

	it('이름이 없는 새 프로젝트 문장은 통과한다', () => {
		expect(checkSentences({ sentences: [item(1), item(2)] }, picks, resume).ok).toBe(true);
	});
});

describe('projectSectionEnd', () => {
	it('프로젝트 영역의 맨 끝 줄을 찾는다', () => {
		expect(projectSectionEnd(resume)).toBe('- 설문을 보고서로 바꾸는 프롬프트 설계');
	});

	it('여러 쪽(\\f)에 걸쳐도 다음 영역 제목 앞까지를 영역으로 본다', () => {
		expect(projectSectionEnd('경력\n- 회사 일\n\f\n프로젝트\n- 개인 일 1\n- 개인 일 2\n\f\n학력\n대학')).toBe('- 개인 일 2');
	});

	it('영문 제목과 개인 프로젝트 제목도 찾는다', () => {
		expect(projectSectionEnd('Experience\n- job\nProjects\n- side one\nSkills\nReact')).toBe('- side one');
		expect(projectSectionEnd('개인 프로젝트\n- 하나')).toBe('- 하나');
	});

	it('프로젝트 영역이 맨 끝이면 이력서의 마지막 줄이다', () => {
		expect(projectSectionEnd('경력\n- 일\n프로젝트\n- 첫째\n- 마지막')).toBe('- 마지막');
	});

	it('프로젝트 영역이 없으면 null이다', () => {
		expect(projectSectionEnd('경력\n- 일\n기술\nReact')).toBeNull();
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
