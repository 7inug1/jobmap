import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { comparisonInput } from './comparison-input.ts';

describe('comparisonInput', () => {
	it('보통 길이의 공고와 이력서를 받는다', () => {
		expect(v.safeParse(comparisonInput, { posting: '공고', resume: '이력서' }).success).toBe(true);
	});

	it('너무 긴 공고나 이력서는 거부한다', () => {
		const long = 'x'.repeat(30_001);
		expect(v.safeParse(comparisonInput, { posting: long, resume: '이력서' }).success).toBe(false);
		expect(v.safeParse(comparisonInput, { posting: '공고', resume: long }).success).toBe(false);
	});
});
