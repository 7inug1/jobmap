'use agent';
import { useDataWriter, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';
import { createFakeComparison } from '../tools/save-comparison.ts';

export function Jobmap() {
	useModel('cloudflare/@cf/mistralai/mistral-small-3.1-24b-instruct');
	const writeProgress = useDataWriter('progress', {
		schema: v.object({ step: v.string() }),
	});
	useTool(createFakeComparison((step) => writeProgress({ step })));
	return '사용자가 비교를 요청하면 save_comparison 도구를 한 번 호출하고, 결과를 한 문장으로 알려 주세요. 한국어로 답하세요.';
}
