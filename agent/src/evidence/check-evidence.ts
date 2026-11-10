type EvidenceRow = {
	verdict: 'met' | 'partial' | 'unmet';
	postingQuote: string;
	resumeQuote: string | null;
};

export type EvidenceIssue = {
	rowIndex: number;
	field: 'postingQuote' | 'resumeQuote';
	reason: 'not_found' | 'empty' | 'missing';
};

/** 붙여넣기에서 달라지는 공백과 한글 자모 분리만 맞춘다. 글자 자체는 바꾸지 않는다. */
function normalize(text: string): string {
	return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function quoteIssue(quote: string, source: string): EvidenceIssue['reason'] | null {
	const normalized = normalize(quote);
	if (normalized === '') return 'empty';
	return normalize(source).includes(normalized) ? null : 'not_found';
}

const BROKEN_CHAR = '\uFFFD';
const MIN_INTACT_CHARS = 4;

/**
 * Workers AI 응답에서 일부 한글이 U+FFFD로 깨져 온다.
 * 깨진 자리를 원문에서 찾아 되돌린다. 후보가 하나일 때만 되돌리고, 못 찾으면 그대로 둬서 근거 확인에서 걸리게 한다.
 */
export function restoreQuote(quote: string, source: string): string {
	if (!quote.includes(BROKEN_CHAR)) return quote;

	const normalized = normalize(quote);
	const intact = normalized.replaceAll(BROKEN_CHAR, '').replace(/\s/g, '');
	if (intact.length < MIN_INTACT_CHARS) return quote;

	const pattern = normalized
		.split(/(\uFFFD+)/)
		.map((part) =>
			part.startsWith(BROKEN_CHAR) ? `\\S{1,${part.length}}?` : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
		)
		.join('');
	const candidates = new Set(Array.from(normalize(source).matchAll(new RegExp(pattern, 'g')), (m) => m[0]));

	return candidates.size === 1 ? [...candidates][0]! : quote;
}

const MIN_LOOSE_CHARS = 6;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * 모델이 근거를 옮겨 적다가 구두점, 띄어쓰기, 대소문자만 바꾼 경우(예: 원문 "Claude Code · Codex"를 "Claude Code, Codex"로)
 * 글자와 숫자만 비교해 원문에서 한 곳에서만 맞으면 원문 문장으로 되돌린다.
 * 글자가 달라졌거나 여러 곳에서 맞거나 너무 짧으면 그대로 둬서 근거 확인에서 걸리게 한다.
 */
export function restoreLooseQuote(quote: string, source: string): string {
	const text = normalize(source);
	if (text.includes(normalize(quote))) return quote;

	const keptAt: number[] = [];
	let looseSource = '';
	for (let index = 0; index < text.length; index += 1) {
		if (LETTER_OR_DIGIT.test(text[index]!)) {
			keptAt.push(index);
			looseSource += text[index]!.toLowerCase();
		}
	}
	const looseQuote = Array.from(normalize(quote)).filter((char) => LETTER_OR_DIGIT.test(char)).join('').toLowerCase();
	if (looseQuote.length < MIN_LOOSE_CHARS) return quote;

	const first = looseSource.indexOf(looseQuote);
	if (first === -1 || looseSource.indexOf(looseQuote, first + 1) !== -1) return quote;
	return text.slice(keptAt[first]!, keptAt[first + looseQuote.length - 1]! + 1);
}

/** 에이전트가 든 근거 문장이 각자의 원문에 실제로 있는지 확인한다. */
export function checkEvidence(
	rows: EvidenceRow[],
	sources: { posting: string; resume: string },
): EvidenceIssue[] {
	return rows.flatMap((row, rowIndex) => {
		const issues: EvidenceIssue[] = [];

		const postingReason = quoteIssue(row.postingQuote, sources.posting);
		if (postingReason) issues.push({ rowIndex, field: 'postingQuote', reason: postingReason });

		if (row.resumeQuote === null) {
			if (row.verdict !== 'unmet') issues.push({ rowIndex, field: 'resumeQuote', reason: 'missing' });
			return issues;
		}

		const resumeReason = quoteIssue(row.resumeQuote, sources.resume);
		if (resumeReason) issues.push({ rowIndex, field: 'resumeQuote', reason: resumeReason });
		return issues;
	});
}
