import { createAgentRouter } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { Jobmap } from './agents/jobmap.ts';

const app = new Hono();

app.route('/agents/jobmap', createAgentRouter(Jobmap));

export default app;
