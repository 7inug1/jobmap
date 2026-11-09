declare module 'cloudflare:workers' {
	export const env: {
		AI: {
			run(
				modelId: string,
				inputs: Record<string, unknown>,
				options?: Record<string, unknown>,
			): Promise<Response | Record<string, unknown>>;
		};
	};
}
