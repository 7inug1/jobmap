import { setProvider } from '@flue/runtime';
import { cloudflareBindingProvider } from '@flue/runtime/cloudflare/workers-ai';
import { createAgentRouter } from '@flue/runtime/routing';
import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { Jobmap } from './agents/jobmap.ts';
import * as v from 'valibot';
import { directionsRequest, generateDirections } from './directions/generate-directions.ts';
import { withOutputLimit } from './model/output-limit.ts';
import { readPosting } from './posting/read-posting.ts';

const MAX_OUTPUT_TOKENS = 4096;

setProvider(cloudflareBindingProvider({ binding: withOutputLimit(env.AI, MAX_OUTPUT_TOKENS) }));

const app = new Hono();

app.route('/agents/jobmap', createAgentRouter(Jobmap));

app.get('/api/posting', async (c) => {
	const result = await readPosting(c.req.query('url') ?? '');
	return c.json(result, result.ok ? 200 : 422);
});

app.post('/api/directions', async (c) => {
	const parsed = v.safeParse(directionsRequest, await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ ok: false }, 400);
	const result = await generateDirections(env.AI as never, parsed.output);
	return c.json(result, result.ok ? 200 : 502);
});

export default app;
