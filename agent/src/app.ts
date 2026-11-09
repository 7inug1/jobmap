import { setProvider } from '@flue/runtime';
import { cloudflareBindingProvider } from '@flue/runtime/cloudflare/workers-ai';
import { createAgentRouter } from '@flue/runtime/routing';
import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { Jobmap } from './agents/jobmap.ts';
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

export default app;
