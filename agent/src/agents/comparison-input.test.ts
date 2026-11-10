import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { comparisonInput } from './comparison-input.ts';

const posting = '공'.repeat(200);
const resume = '이'.repeat(50);

describe('comparisonInput', () => {
	it('보통 길이의 공고와 이력서를 받는다', () => {
		expect(v.safeParse(comparisonInput, { posting, resume }).success).toBe(true);
	});

	it('너무 긴 공고나 이력서는 거부한다', () => {
		const long = 'x'.repeat(30_001);
		expect(v.safeParse(comparisonInput, { posting: long, resume }).success).toBe(false);
		expect(v.safeParse(comparisonInput, { posting, resume: long }).success).toBe(false);
	});

	it('너무 짧은 공고나 이력서는 모델을 부르기 전에 거부한다', () => {
		expect(v.safeParse(comparisonInput, { posting: '공고', resume }).success).toBe(false);
		expect(v.safeParse(comparisonInput, { posting, resume: '이력서' }).success).toBe(false);
	});

	it('공백만 늘린 글은 짧은 글로 본다', () => {
		expect(v.safeParse(comparisonInput, { posting: `${' '.repeat(300)}공`, resume }).success).toBe(false);
	});
});
