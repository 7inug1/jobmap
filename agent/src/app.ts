import { setProvider } from '@flue/runtime';
import { cloudflareBindingProvider } from '@flue/runtime/cloudflare/workers-ai';
import { createAgentRouter } from '@flue/runtime/routing';
import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { Jobmap } from './agents/jobmap.ts';
import * as v from 'valibot';
import { directionsRequest, generateDirections } from './directions/generate-directions.ts';
import { createDailyLimit } from './limits/daily-limit.ts';
import { checkRequest, validateRows } from './comparison/validate-rows.ts';
import { generateSentences, sentencesRequest } from './sentences/generate-sentences.ts';
import { withOutputLimit } from './model/output-limit.ts';
import { readPosting } from './posting/read-posting.ts';

const MAX_OUTPUT_TOKENS = 4096;

setProvider(cloudflareBindingProvider({ binding: withOutputLimit(env.AI, MAX_OUTPUT_TOKENS) }));

const dailyLimit = createDailyLimit({
	take: (key, limit) => env.DAILY_USAGE.getByName('global').take(key, limit),
	limits: {
		compare: Number(env.DAILY_COMPARE_LIMIT ?? 50),
		directions: Number(env.DAILY_DIRECTIONS_LIMIT ?? 80),
		sentences: Number(env.DAILY_SENTENCES_LIMIT ?? 80),
	},
	personLimits: {
		compare: Number(env.PERSON_COMPARE_LIMIT ?? 3),
		directions: Number(env.PERSON_DIRECTIONS_LIMIT ?? 6),
		sentences: Number(env.PERSON_SENTENCES_LIMIT ?? 6),
	},
});

const app = new Hono();

app.use('/agents/jobmap/:id', dailyLimit.compare);
app.route('/agents/jobmap', createAgentRouter(Jobmap));

app.get('/api/posting', async (c) => {
	const result = await readPosting(c.req.query('url') ?? '');
	return c.json(result, result.ok ? 200 : 422);
});

// AI를 부르지 않는 근거 검사. 화면이 스트리밍으로 받은 판단을 응답이 끝난 뒤 보낸다.
app.post('/api/comparison/check', async (c) => {
	const parsed = v.safeParse(checkRequest, await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ ok: false, issues: ['요청 형식이 맞지 않습니다.'] }, 400);
	return c.json(validateRows(parsed.output));
});

app.post('/api/directions', async (c) => {
	const parsed = v.safeParse(directionsRequest, await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ ok: false }, 400);
	const taken = await dailyLimit.takeDirections(c.req.header('cf-connecting-ip'));
	if (!taken.ok) return c.json({ ok: false, reason: taken.reason }, 429);
	const result = await generateDirections(env.AI as never, parsed.output);
	return c.json(result, result.ok ? 200 : result.reason === 'quota' ? 429 : 502);
});

// 고른 프로젝트 방법을 이력서에 넣을 문장과 할 일, 들어갈 자리로 바꾼다.
app.post('/api/resume-sentences', async (c) => {
	const parsed = v.safeParse(sentencesRequest, await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ ok: false }, 400);
	const taken = await dailyLimit.takeSentences(c.req.header('cf-connecting-ip'));
	if (!taken.ok) return c.json({ ok: false, reason: taken.reason }, 429);
	const result = await generateSentences(env.AI as never, parsed.output, env.SENTENCES_MODEL || undefined);
	return c.json(result, result.ok ? 200 : result.reason === 'quota' ? 429 : 502);
});

export default app;
