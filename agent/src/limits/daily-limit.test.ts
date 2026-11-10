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
	const limit = createDailyLimit({ take, limits: { compare: 50, directions: 80 }, now: () => new Date('2026-11-10T01:00:00Z') });
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
		expect(await limit.takeDirections()).toBe(true);
		expect(take).toHaveBeenCalledWith('2026-11-10:directions', 80);
	});
});
