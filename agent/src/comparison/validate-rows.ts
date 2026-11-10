import * as v from 'valibot';
import { checkEvidence, restoreQuote, type EvidenceIssue } from '../evidence/check-evidence.ts';
import { comparisonInput } from '../agents/comparison-input.ts';

export const comparisonRow = v.object({
	requirement: v.pipe(v.string(), v.maxLength(2_000)),
	verdict: v.picklist(['met', 'partial', 'unmet']),
	postingQuote: v.pipe(v.string(), v.maxLength(2_000)),
	resumeQuote: v.nullable(v.pipe(v.string(), v.maxLength(2_000))),
});
type Row = v.InferOutput<typeof comparisonRow>;

export const checkRequest = v.object({
	...comparisonInput.entries,
	rows: v.pipe(v.array(comparisonRow), v.maxLength(60)),
});

const REASON_TEXT: Record<EvidenceIssue['reason'], string> = {
	not_found: '원문에 없는 문장입니다. 원문을 글자 그대로 복사하세요',
	empty: '근거가 비어 있습니다',
	missing: '충족이나 일부 충족이면 이력서 근거가 필요합니다. 없으면 unmet으로 판단하세요',
};

function describeIssue({ rowIndex, field, reason }: EvidenceIssue): string {
	return `${rowIndex + 1}번째 줄 ${field}: ${REASON_TEXT[reason]}`;
}

export type ValidateResult = { ok: true; rows: Row[] } | { ok: false; issues: string[] };

/**
 * AI가 한 줄씩 쓴 판단을 코드로 확인한다. 깨진 한글은 원문으로 되돌리고, 근거가 원문에 없으면 고칠 줄을 알려 준다.
 * AI를 부르지 않는 검사라 화면이 응답을 다 받은 뒤 호출한다.
 */
export function validateRows({ rows, posting, resume }: { rows: Row[]; posting: string; resume: string }): ValidateResult {
	if (rows.length === 0) return { ok: false, issues: ['요건 줄을 한 줄도 읽지 못했습니다. 한 줄에 JSON 하나씩, 요건마다 한 줄을 쓰세요.'] };

	const restored = rows.map((row) => {
		const postingQuote = restoreQuote(row.postingQuote, posting);
		return {
			...row,
			requirement: row.requirement.includes('�') ? postingQuote : row.requirement,
			postingQuote,
			resumeQuote: row.resumeQuote === null ? null : restoreQuote(row.resumeQuote, resume),
		};
	});

	const issues = checkEvidence(restored, { posting, resume });
	return issues.length > 0 ? { ok: false, issues: issues.map(describeIssue) } : { ok: true, rows: restored };
}
