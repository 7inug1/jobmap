import type { MiddlewareHandler } from 'hono';

export type UsageKind = 'compare' | 'directions' | 'sentences';

type Options = {
	/** 키의 오늘 사용 횟수가 한도보다 적으면 하나 세고 true를 돌려준다. */
	take: (key: string, limit: number) => Promise<boolean>;
	limits: Record<UsageKind, number>;
	now?: () => Date;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 사용자에게 "내일"이 자연스럽도록 한국 시간 자정으로 날짜를 나눈다. */
export function kstDay(now: Date): string {
	return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function usageKey(day: string, kind: UsageKind): string {
	return `${day}:${kind}`;
}

/** 서비스 전체 하루 총량. 뉴런을 쓰는 요청만, 모델을 부르기 전에 센다. */
export function createDailyLimit({ take, limits, now = () => new Date() }: Options) {
	const takeKind = (kind: UsageKind) => take(usageKey(kstDay(now()), kind), limits[kind]);

	const compare: MiddlewareHandler = async (c, next) => {
		if (c.req.method !== 'POST') return next();
		if (!(await takeKind('compare'))) return c.json({ ok: false, reason: 'daily_limit' }, 429);
		return next();
	};

	return { compare, takeDirections: () => takeKind('directions'), takeSentences: () => takeKind('sentences') };
}
