import * as v from 'valibot';

const MIN_POSTING_LENGTH = 200;
const MIN_RESUME_LENGTH = 50;
const MAX_TEXT_LENGTH = 30_000;

export const comparisonInput = v.object({
	posting: v.pipe(v.string(), v.trim(), v.minLength(MIN_POSTING_LENGTH), v.maxLength(MAX_TEXT_LENGTH)),
	resume: v.pipe(v.string(), v.trim(), v.minLength(MIN_RESUME_LENGTH), v.maxLength(MAX_TEXT_LENGTH)),
});
