import { describe, expect, it, vi } from 'vitest';
import { withOutputLimit } from './output-limit.ts';

function binding() {
	return { run: vi.fn(async () => ({})) };
}

describe('withOutputLimit', () => {
	it('출력 한도를 넣어 그대로 전달한다', async () => {
		const ai = binding();
		await withOutputLimit(ai, 4096).run('model', { messages: [] }, { gateway: 'x' });
		expect(ai.run).toHaveBeenCalledWith('model', { messages: [], max_tokens: 4096 }, { gateway: 'x' });
	});

	it('호출하는 쪽이 정한 한도는 덮어쓰지 않는다', async () => {
		const ai = binding();
		await withOutputLimit(ai, 4096).run('model', { max_completion_tokens: 100 });
		expect(ai.run).toHaveBeenCalledWith('model', { max_completion_tokens: 100 }, undefined);
	});
});
