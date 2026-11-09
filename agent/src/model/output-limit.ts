type AiBinding = {
	run(modelId: string, inputs: Record<string, unknown>, options?: Record<string, unknown>): Promise<Response | Record<string, unknown>>;
};

/**
 * Flue는 Workers AI에 출력 한도를 보내지 않아 모델 기본값(256토큰)에서 잘린다.
 * 요건이 많은 공고의 도구 호출이 끝까지 나오도록 호출마다 한도를 넣는다.
 */
export function withOutputLimit(binding: AiBinding, maxTokens: number): AiBinding {
	return {
		run(modelId, inputs, options) {
			const limited = 'max_completion_tokens' in inputs ? inputs : { ...inputs, max_tokens: maxTokens };
			return binding.run(modelId, limited, options);
		},
	};
}
