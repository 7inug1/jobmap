// Worker-level Cloudflare code lives here; HTTP routing stays in src/app.ts.
//
//   - Named exports become top-level Worker exports — e.g. application-owned
//     Durable Object classes (declare their bindings in wrangler.jsonc).
//   - An optional default export adds non-HTTP handlers: scheduled (cron),
//     queue consumers, inbound email, etc. (never `fetch`).
//
// https://flueframework.com/docs/guide/cloudflare-target/#extending-cloudflarets-entrypoint
import { DurableObject } from 'cloudflare:workers';

/** 서비스 전체 하루 사용 횟수. 인스턴스 하나에서 순서대로 처리돼 동시 요청도 정확히 센다. */
export class DailyUsage extends DurableObject {
	async take(key: string, limit: number): Promise<boolean> {
		const used = (await this.ctx.storage.get<number>(key)) ?? 0;
		if (used >= limit) return false;
		await this.ctx.storage.put(key, used + 1);
		return true;
	}
}
