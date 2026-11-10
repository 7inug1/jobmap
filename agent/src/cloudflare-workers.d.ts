declare module 'cloudflare:workers' {
	export const env: {
		AI: {
			run(
				modelId: string,
				inputs: Record<string, unknown>,
				options?: Record<string, unknown>,
			): Promise<Response | Record<string, unknown>>;
		};
		DAILY_USAGE: { getByName(name: string): { take(key: string, limit: number): Promise<boolean> } };
		DAILY_COMPARE_LIMIT?: number;
		DAILY_DIRECTIONS_LIMIT?: number;
		DAILY_SENTENCES_LIMIT?: number;
	};

	export abstract class DurableObject {
		protected ctx: {
			storage: {
				get<T>(key: string): Promise<T | undefined>;
				put(key: string, value: unknown): Promise<void>;
			};
		};
		constructor(ctx: unknown, env: unknown);
	}
}
