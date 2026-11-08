import { defineConfig } from 'vitest/config';

// 순수 함수 테스트는 Workers 런타임 없이 Node에서 돌린다.
// vite.config.ts의 Cloudflare 플러그인을 읽지 않도록 설정을 분리한다.
export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
	},
});
