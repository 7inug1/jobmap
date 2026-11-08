import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

export const comparisonRow = v.object({
	requirement: v.string(),
	verdict: v.picklist(['met', 'partial', 'unmet']),
	postingQuote: v.string(),
	resumeQuote: v.nullable(v.string()),
});

export const comparisonOutput = v.object({ rows: v.array(comparisonRow) });

/**
 * 프레임워크 동작 확인용 가짜 도구. 입력과 무관하게 고정된 표를 돌려준다.
 * 실제 공고 비교로 교체하기 전까지만 쓴다.
 */
export function createFakeComparison(onProgress: (step: string) => void) {
	return defineTool({
		name: 'save_comparison',
		description: '연결 확인용 도구. 사용자가 비교를 요청하면 한 번 호출한다.',
		output: comparisonOutput,
		async run() {
			onProgress('공고 읽기');
			await new Promise((resolve) => setTimeout(resolve, 800));
			onProgress('이력서와 비교하기');
			await new Promise((resolve) => setTimeout(resolve, 800));
			return {
				output: {
					rows: [
						{
							requirement: '[가짜 데이터] React, TypeScript 경험',
							verdict: 'met' as const,
							postingQuote: '가짜 공고 문장',
							resumeQuote: '가짜 이력서 문장',
						},
						{
							requirement: '[가짜 데이터] 테스트 코드 작성 경험',
							verdict: 'unmet' as const,
							postingQuote: '가짜 공고 문장',
							resumeQuote: null,
						},
					],
				},
			};
		},
	});
}
