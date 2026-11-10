export type AiBinding = { run(modelId: string, inputs: never): Promise<unknown> };

export const BROKEN_CHAR = '�';

/** 모델 답에서 JSON을 꺼낸다. 코드 블록으로 감싸 오는 경우가 있다. */
export function parseJson(text: string): unknown {
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start === -1 || end <= start) return null;
	try {
		return JSON.parse(text.slice(start, end + 1));
	} catch {
		return null;
	}
}

/** Workers AI의 일일 무료 한도 오류(4006)인지 본다. */
export function isQuotaError(error: unknown): boolean {
	return error instanceof Error && /\b4006\b|daily free allocation/i.test(error.message);
}

export function contentOf(answer: unknown): string {
	const { choices, response } = (answer ?? {}) as { choices?: { message?: { content?: unknown } }[]; response?: unknown };
	const content = choices?.[0]?.message?.content ?? response;
	return typeof content === 'string' ? content : '';
}
