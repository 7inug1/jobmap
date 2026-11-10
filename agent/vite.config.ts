import { cloudflare } from '@cloudflare/vite-plugin';
import { flue, flueWorkerConfig } from '@flue/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	publicDir: '../web/dist',
	plugins: [flue(), cloudflare({ config: flueWorkerConfig() })],
});
