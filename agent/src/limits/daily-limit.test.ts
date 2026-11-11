import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createDailyLimit, kstDay, usageKey } from './daily-limit.ts';

describe('kstDay', () => {
	it('한국 시간 자정을 기준으로 날짜를 나눈다', () => {
		expect(kstDay(new Date('2026-11-10T14:59:59Z'))).toBe('2026-11-10');
		expect(kstDay(new Date('2026-11-10T15:00:00Z'))).toBe('2026-11-11');
	});
});

describe('usageKey', () => {
	it('날짜와 종류로 키를 만든다', () => {
		expect(usageKey('2026-11-10', 'compare')).toBe('2026-11-10:compare');
	});
});

function setup(allowed: boolean) {
	const take = vi.fn(async () => allowed);
	const limit = createDailyLimit({ take, limits: { compare: 50, directions: 80, sentences: 60 }, personLimits: { compare: 3, directions: 6, sentences: 6 }, now: () => new Date('2026-11-10T01:00:00Z') });
	const app = new Hono();
	app.use('/agents/jobmap/:id', limit.compare);
	app.post('/agents/jobmap/:id', (c) => c.text('sent'));
	app.get('/agents/jobmap/:id', (c) => c.text('read'));
	app.post('/agents/jobmap/:id/abort', (c) => c.text('aborted'));
	return { app, take, limit };
}

describe('비교 시작 제한', () => {
	it('한도 안이면 그날 키로 하나 세고 통과시킨다', async () => {
		const { app, take } = setup(true);
		const response = await app.request('/agents/jobmap/a', { method: 'POST' });
		expect(await response.text()).toBe('sent');
		expect(take).toHaveBeenCalledWith('2026-11-10:compare', 50);
	});

	it('한도를 넘으면 모델을 부르기 전에 429로 막는다', async () => {
		const { app } = setup(false);
		const response = await app.request('/agents/jobmap/a', { method: 'POST' });
		expect(response.status).toBe(429);
		expect(await response.json()).toEqual({ ok: false, reason: 'daily_limit' });
	});

	it('대화 읽기와 중단은 세지 않는다', async () => {
		const { app, take } = setup(false);
		expect(await (await app.request('/agents/jobmap/a')).text()).toBe('read');
		expect(await (await app.request('/agents/jobmap/a/abort', { method: 'POST' })).text()).toBe('aborted');
		expect(take).not.toHaveBeenCalled();
	});
});

describe('방향 제안 제한', () => {
	it('방향 제안 키와 한도로 센다', async () => {
		const { take, limit } = setup(true);
		expect(await limit.takeDirections()).toEqual({ ok: true });
		expect(take).toHaveBeenCalledWith('2026-11-10:directions', 80);
	});
});

describe('이력서 문장 제한', () => {
	it('이력서 문장 키와 한도로 센다', async () => {
		const { take, limit } = setup(true);
		expect(await limit.takeSentences()).toEqual({ ok: true });
		expect(take).toHaveBeenCalledWith('2026-11-10:sentences', 60);
	});
});


describe('사람별 제한', () => {
	const limits = { compare: 50, directions: 80, sentences: 60 };
	const personLimits = { compare: 3, directions: 6, sentences: 6 };
	const now = () => new Date('2026-11-10T01:00:00Z');
	const start = (body: unknown, ip: string | null = '1.2.3.4') => ({
		method: 'POST',
		headers: { 'content-type': 'application/json', ...(ip ? { 'cf-connecting-ip': ip } : {}) },
		body: JSON.stringify(body),
	});

	function build(take: (key: string, limit: number) => Promise<boolean>) {
		const limit = createDailyLimit({ take, limits, personLimits, now });
		const app = new Hono();
		app.use('/agents/jobmap/:id', limit.compare);
		app.post('/agents/jobmap/:id', (c) => c.text('sent'));
		return { app, limit };
	}

	it('키에 사람 주소를 붙인다', () => {
		expect(usageKey('2026-11-10', 'compare', '1.2.3.4')).toBe('2026-11-10:compare:1.2.3.4');
	});

	it('비교를 새로 시작하면 사람별 한도를 먼저 세고 전체 한도를 센다', async () => {
		const take = vi.fn(async () => true);
		const { app } = build(take);
		const response = await app.request('/agents/jobmap/a', start({ message: { kind: 'user', body: 'x' }, initialData: {} }));
		expect(await response.text()).toBe('sent');
		expect(take.mock.calls).toEqual([
			['2026-11-10:compare:1.2.3.4', 3],
			['2026-11-10:compare', 50],
		]);
	});

	it('사람별 한도를 넘으면 전체 한도는 쓰지 않고 429로 막는다', async () => {
		const take = vi.fn(async (key: string) => key.endsWith('1.2.3.4') === false);
		const { app } = build(take);
		const response = await app.request('/agents/jobmap/a', start({ initialData: {} }));
		expect(response.status).toBe(429);
		expect(await response.json()).toEqual({ ok: false, reason: 'person_limit' });
		expect(take).toHaveBeenCalledTimes(1);
	});

	it('고쳐 쓰기 요청은 사람별 횟수로 세지 않고 전체 한도만 센다', async () => {
		const take = vi.fn(async () => true);
		const { app } = build(take);
		await app.request('/agents/jobmap/a', start({ message: { kind: 'user', body: '고쳐 주세요' } }));
		expect(take.mock.calls).toEqual([['2026-11-10:compare', 50]]);
	});

	it('주소를 읽지 못하면 사람별 제한 없이 전체 한도만 센다', async () => {
		const take = vi.fn(async () => true);
		const { app } = build(take);
		await app.request('/agents/jobmap/a', start({ initialData: {} }, null));
		expect(take.mock.calls).toEqual([['2026-11-10:compare', 50]]);
	});

	it('본문이 JSON이 아니어도 고쳐 쓰기로 보고 전체 한도만 센다', async () => {
		const take = vi.fn(async () => true);
		const { app } = build(take);
		await app.request('/agents/jobmap/a', { method: 'POST', headers: { 'cf-connecting-ip': '1.2.3.4' }, body: 'not json' });
		expect(take.mock.calls).toEqual([['2026-11-10:compare', 50]]);
	});

	it('방향 제안은 사람별 한도 후 전체 한도 순서로 센다', async () => {
		const take = vi.fn(async () => true);
		const { limit } = build(take);
		expect(await limit.takeDirections('1.2.3.4')).toEqual({ ok: true });
		expect(take.mock.calls).toEqual([
			['2026-11-10:directions:1.2.3.4', 6],
			['2026-11-10:directions', 80],
		]);
	});

	it('이력서 문장이 사람별 한도를 넘으면 이유와 함께 거절한다', async () => {
		const take = vi.fn(async (key: string) => !key.endsWith('1.2.3.4'));
		const { limit } = build(take);
		expect(await limit.takeSentences('1.2.3.4')).toEqual({ ok: false, reason: 'person_limit' });
		expect(take).toHaveBeenCalledTimes(1);
	});

	it('전체 한도를 넘으면 daily_limit 이유로 거절한다', async () => {
		const take = vi.fn(async (key: string) => key.includes('1.2.3.4'));
		const { limit } = build(take);
		expect(await limit.takeSentences('1.2.3.4')).toEqual({ ok: false, reason: 'daily_limit' });
	});
});
