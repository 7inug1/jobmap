import { defineTool } from '@flue/runtime/tool';
import * as v from 'valibot';
import { checkEvidence, restoreQuote, type EvidenceIssue } from '../evidence/check-evidence.ts';

export const comparisonRow = v.object({
	requirement: v.string(),
	verdict: v.picklist(['met', 'partial', 'unmet']),
	postingQuote: v.string(),
	resumeQuote: v.nullable(v.string()),
});

export const comparison = v.object({ rows: v.array(comparisonRow) });

const REASON_TEXT: Record<EvidenceIssue['reason'], string> = {
	not_found: '원문에 없는 문장입니다. 원문을 글자 그대로 복사하세요',
	empty: '근거가 비어 있습니다',
	missing: '충족이나 일부 충족이면 이력서 근거가 필요합니다. 없으면 unmet으로 판단하세요',
};

function describeIssue({ rowIndex, field, reason }: EvidenceIssue): string {
	return `${rowIndex + 1}번째 행 ${field}: ${REASON_TEXT[reason]}`;
}

/** 비교 표를 받아 근거 문장을 코드로 확인한다. 틀리면 도구 오류로 돌려보내 모델이 고치게 한다. */
export function createSaveComparison({
	posting,
	resume,
	onProgress,
}: {
	posting: string;
	resume: string;
	onProgress: (step: string) => void;
}) {
	return defineTool({
		name: 'save_comparison',
		description:
			'공고 요건별 비교 표를 저장한다. 근거 문장이 원문에 없으면 오류를 돌려주므로, 오류에 적힌 행을 고쳐 다시 호출한다.',
		input: comparison,
		output: comparison,
		run({ data }) {
			onProgress('근거 문장 확인하기');
			if (data.rows.length === 0) throw new Error('요건이 하나도 없습니다. 공고의 요건을 행으로 적으세요.');

			const rows = data.rows.map((row) => {
				const postingQuote = restoreQuote(row.postingQuote, posting);
				return {
					...row,
					requirement: row.requirement.includes('\uFFFD') ? postingQuote : row.requirement,
					postingQuote,
					resumeQuote: row.resumeQuote === null ? null : restoreQuote(row.resumeQuote, resume),
				};
			});

			const issues = checkEvidence(rows, { posting, resume });
			if (issues.length > 0) throw new Error(issues.map(describeIssue).join('\n'));

			return { output: { rows } };
		},
	});
}
