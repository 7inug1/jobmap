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
