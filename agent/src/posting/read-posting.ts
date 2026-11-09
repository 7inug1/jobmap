export type ReadPostingResult =
	| { ok: true; text: string }
	| { ok: false; reason: 'invalid_url' | 'fetch_failed' | 'not_html' | 'no_text' };

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const MIN_TEXT_LENGTH = 100;
const MAX_TEXT_LENGTH = 30_000;
const TIMEOUT_MS = 10_000;

const ATTRIBUTES = `(?:"[^"]*"|'[^']*'|[^'">])*`;
const ANY_TAG = new RegExp(`</?[a-zA-Z!]${ATTRIBUTES}>`, 'g');
const MAIN = new RegExp(`<main\\b${ATTRIBUTES}>([\\s\\S]*)</main\\s*>`, 'i');
const BODY = new RegExp(`<body\\b${ATTRIBUTES}>([\\s\\S]*)</body\\s*>`, 'i');
const LIST_ITEM = new RegExp(`<li\\b${ATTRIBUTES}>`, 'gi');
const LINE_BREAK = /<\/(?:p|div|section|article|header|footer|ul|ol|li|h[1-6]|tr)\s*>|<br\s*\/?>/gi;

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
};

function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
		if (code[0] !== '#') return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
		const value = code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
		return value <= 0x10ffff ? String.fromCodePoint(value) : whole;
	});
}

/** HTML에서 사람이 읽는 글만 줄 단위로 꺼낸다. */
export function extractText(html: string): string {
	const withoutCode = html
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, ' ');
	const scope = MAIN.exec(withoutCode)?.[1] ?? BODY.exec(withoutCode)?.[1] ?? withoutCode;

	return decodeEntities(scope.replace(LIST_ITEM, '\n- ').replace(LINE_BREAK, '\n').replace(ANY_TAG, ''))
		.split('\n')
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.filter((line) => line !== '' && line !== '-')
		.join('\n');
}

/** 공개 https 주소만 통과시켜, 서버가 내부 주소를 대신 요청하지 않게 한다. */
export function isAllowedUrl(raw: string): boolean {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return false;
	}
	if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return false;

	const host = url.hostname.toLowerCase();
	const isIpLiteral = host.startsWith('[') || /^[\d.]+$/.test(host);
	const isInternalName = !host.includes('.') || /\.(?:local|internal|localhost)$/.test(host);
	return !isIpLiteral && !isInternalName;
}

export async function readPosting(
	raw: string,
	fetcher: Fetcher = (url, init) => fetch(url, init),
): Promise<ReadPostingResult> {
	if (!isAllowedUrl(raw)) return { ok: false, reason: 'invalid_url' };

	let html: string;
	try {
		const response = await fetcher(raw, { signal: AbortSignal.timeout(TIMEOUT_MS) });
		if (!response.ok) return { ok: false, reason: 'fetch_failed' };
		if (!response.headers.get('content-type')?.includes('text/html')) return { ok: false, reason: 'not_html' };
		html = await response.text();
	} catch {
		return { ok: false, reason: 'fetch_failed' };
	}

	const text = extractText(html).slice(0, MAX_TEXT_LENGTH);
	return text.length < MIN_TEXT_LENGTH ? { ok: false, reason: 'no_text' } : { ok: true, text };
}
