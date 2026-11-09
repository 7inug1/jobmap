export type ReadPostingResult =
	| { ok: true; text: string }
	| { ok: false; reason: 'invalid_url' | 'fetch_failed' | 'not_html' | 'no_text' };

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const MIN_TEXT_LENGTH = 500;
const MAX_TEXT_LENGTH = 30_000;
const TIMEOUT_MS = 10_000;
const USER_AGENT = 'jobmap/0.1 (job posting reader)';
const REQUIREMENT_WORDS = /자격|요건|우대|필수|qualification|requirement|experience/i;

const ATTRIBUTES = `(?:"[^"]*"|'[^']*'|[^'">])*`;
const ANY_TAG = new RegExp(`</?[a-zA-Z!]${ATTRIBUTES}>`, 'g');
const MAIN = new RegExp(`<main\\b${ATTRIBUTES}>([\\s\\S]*)</main\\s*>`, 'i');
const ARTICLE = new RegExp(`<article\\b${ATTRIBUTES}>([\\s\\S]*?)</article\\s*>`, 'i');
const JSON_LD = /<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script\s*>/gi;
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

function stripCode(html: string): string {
	return html
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, ' ');
}

/** HTML에서 사람이 읽는 글만 줄 단위로 꺼낸다. */
export function extractText(html: string): string {
	const withoutCode = stripCode(html);
	const scope = MAIN.exec(withoutCode)?.[1] ?? BODY.exec(withoutCode)?.[1] ?? withoutCode;

	return decodeEntities(scope.replace(LIST_ITEM, '\n- ').replace(LINE_BREAK, '\n').replace(ANY_TAG, ''))
		.split('\n')
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.filter((line) => line !== '' && line !== '-')
		.join('\n');
}

function isJobPosting(node: unknown): node is { title?: unknown; description: string } {
	if (typeof node !== 'object' || node === null) return false;
	const { '@type': type, description } = node as Record<string, unknown>;
	const isPosting = type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));
	return isPosting && typeof description === 'string';
}

function findJobPosting(data: unknown) {
	const nodes = Array.isArray(data) ? data : [data, ...(((data as { '@graph'?: unknown[] } | null)?.['@graph']) ?? [])];
	return nodes.find(isJobPosting);
}

/** 페이지에 심어진 schema.org JobPosting에서 제목과 설명을 HTML로 꺼낸다. */
function structuredPosting(html: string): string | null {
	for (const [, json] of html.matchAll(JSON_LD)) {
		try {
			const posting = findJobPosting(JSON.parse(json!));
			if (!posting) continue;
			const description = posting.description.includes('&lt;') && !posting.description.includes('<')
				? decodeEntities(posting.description)
				: posting.description;
			return `<p>${typeof posting.title === 'string' ? posting.title : ''}</p>${description}`;
		} catch {
			// 깨진 구조화 데이터는 건너뛰고 화면 영역을 읽는다.
		}
	}
	return null;
}

/** 공고가 있을 만한 영역을 정확한 순서로 고른다. 메뉴가 섞이는 body 전체는 쓰지 않고, 지원 요건이 없는 글은 공고 본문으로 치지 않는다. */
function postingText(html: string): string | null {
	const withoutCode = stripCode(html);
	const candidates = [structuredPosting(html), ARTICLE.exec(withoutCode)?.[1], MAIN.exec(withoutCode)?.[1]];
	for (const candidate of candidates) {
		const text = candidate ? extractText(candidate) : '';
		if (text.length >= MIN_TEXT_LENGTH && REQUIREMENT_WORDS.test(text)) return text;
	}
	return null;
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
		const response = await fetcher(raw, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'user-agent': USER_AGENT } });
		if (!response.ok) return { ok: false, reason: 'fetch_failed' };
		const contentType = response.headers.get('content-type') ?? '';
		if (!contentType.includes('text/html')) return { ok: false, reason: 'not_html' };
		const charset = /charset=([^;\s]+)/i.exec(contentType)?.[1] ?? 'utf-8';
		html = new TextDecoder(charset).decode(await response.arrayBuffer());
	} catch {
		return { ok: false, reason: 'fetch_failed' };
	}

	const text = postingText(html);
	return text ? { ok: true, text: text.slice(0, MAX_TEXT_LENGTH) } : { ok: false, reason: 'no_text' };
}
