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
		/** 이력서 문장 만들기에만 쓸 모델. 비우면 기본 모델을 쓴다. */
		SENTENCES_MODEL?: string;
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
