import type { MiddlewareHandler } from 'hono';

export type UsageKind = 'compare' | 'directions' | 'sentences';

type Options = {
	/** 키의 오늘 사용 횟수가 한도보다 적으면 하나 세고 true를 돌려준다. */
	take: (key: string, limit: number) => Promise<boolean>;
	limits: Record<UsageKind, number>;
	/** 사람(접속 주소) 한 명이 하루에 쓸 수 있는 횟수. */
	personLimits: Record<UsageKind, number>;
	now?: () => Date;
};

export type TakeResult = { ok: true } | { ok: false; reason: 'person_limit' | 'daily_limit' };

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 사용자에게 "내일"이 자연스럽도록 한국 시간 자정으로 날짜를 나눈다. */
export function kstDay(now: Date): string {
	return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function usageKey(day: string, kind: UsageKind, person?: string): string {
	return person ? `${day}:${kind}:${person}` : `${day}:${kind}`;
}

/** 새 비교인지 본다. 처음 보내는 요청에만 initialData가 들어 있고, 근거를 고쳐 달라는 요청에는 없다. */
async function startsComparison(request: Request): Promise<boolean> {
	const body = (await request.clone().json().catch(() => null)) as { initialData?: unknown } | null;
	return body?.initialData !== undefined;
}

/**
 * 하루 사용 한도. 뉴런을 쓰는 요청만, 모델을 부르기 전에 센다.
 * 사람별 한도를 먼저 보고, 통과하면 서비스 전체 총량을 센다. 사람별 한도에서 막히면 전체 총량은 쓰지 않는다.
 * 사람은 접속 주소로 구분하고, 주소를 읽지 못하면 사람별 제한 없이 전체 총량만 센다.
 */
export function createDailyLimit({ take, limits, personLimits, now = () => new Date() }: Options) {
	const takeKind = async (kind: UsageKind, person?: string, perPerson = true): Promise<TakeResult> => {
		const day = kstDay(now());
		if (perPerson && person && !(await take(usageKey(day, kind, person), personLimits[kind]))) return { ok: false, reason: 'person_limit' };
		return (await take(usageKey(day, kind), limits[kind])) ? { ok: true } : { ok: false, reason: 'daily_limit' };
	};

	const compare: MiddlewareHandler = async (c, next) => {
		if (c.req.method !== 'POST') return next();
		const person = c.req.header('cf-connecting-ip');
		const result = await takeKind('compare', person, await startsComparison(c.req.raw));
		if (!result.ok) return c.json({ ok: false, reason: result.reason }, 429);
		return next();
	};

	return {
		compare,
		takeDirections: (person?: string) => takeKind('directions', person),
		takeSentences: (person?: string) => takeKind('sentences', person),
	};
}
