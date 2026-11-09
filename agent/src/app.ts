import { createAgentRouter } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { Jobmap } from './agents/jobmap.ts';
import { readPosting } from './posting/read-posting.ts';

const app = new Hono();

app.route('/agents/jobmap', createAgentRouter(Jobmap));

app.get('/api/posting', async (c) => {
	const result = await readPosting(c.req.query('url') ?? '');
	return c.json(result, result.ok ? 200 : 422);
});

export default app;
