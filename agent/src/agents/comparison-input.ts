import * as v from 'valibot';

const MAX_TEXT_LENGTH = 30_000;

export const comparisonInput = v.object({
	posting: v.pipe(v.string(), v.maxLength(MAX_TEXT_LENGTH)),
	resume: v.pipe(v.string(), v.maxLength(MAX_TEXT_LENGTH)),
});
