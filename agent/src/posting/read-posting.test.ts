import { describe, expect, it } from 'vitest';
import { extractText, isAllowedUrl, readPosting } from './read-posting.ts';

const LONG = '프론트엔드 개발자의 자격 요건을 확인해 주세요. '.repeat(30);

function page(body: string, init?: ResponseInit) {
	return async () => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });
}

describe('extractText', () => {
	it('태그와 스크립트, 스타일을 빼고 글만 남긴다', () => {
		const html = '<html><style>a{}</style><script>var a="b"</script><body><h1>제목</h1><p>본문</p></body></html>';
		expect(extractText(html)).toBe('# 제목\n본문');
	});

	it('main이 있으면 main 안의 글만 쓴다', () => {
		expect(extractText('<body><nav>메뉴</nav><main><p>공고</p></main><footer>주소</footer></body>')).toBe('공고');
	});

	it('제목 태그는 단계에 맞춰 "#"을 붙여 남긴다', () => {
		expect(extractText('<main><h3 class="x">자격요건</h3><ul><li>React</li></ul></main>')).toBe('### 자격요건\n- React');
	});

	it('앞 글과 붙어 있어도 제목은 새 줄에서 시작한다', () => {
		expect(extractText('<main><span>찾습니다.</span><h3>주요업무</h3><p>본문</p></main>')).toBe('찾습니다.\n### 주요업무\n본문');
	});

	it('굵은 글씨만 있는 문단은 제목으로 남긴다', () => {
		expect(extractText('<main><p><strong>우대사항</strong></p><p>본문</p></main>')).toBe('## 우대사항\n본문');
	});

	it('빈 제목 태그는 남기지 않는다', () => {
		expect(extractText('<main><h2> </h2><p>본문</p></main>')).toBe('본문');
	});

	it('목록은 줄을 나누어 "- "로 시작한다', () => {
		expect(extractText('<main><ul><li>React</li><li>TypeScript</li></ul></main>')).toBe('- React\n- TypeScript');
	});

	it('속성 값 안의 > 때문에 태그 조각이 남지 않는다', () => {
		expect(extractText('<main><div class="[&_p>a]:m-0"><p>공고</p></div></main>')).toBe('공고');
	});

	it('HTML 엔티티를 글자로 되돌린다', () => {
		expect(extractText('<main><p>A &amp; B &lt;C&gt; &#39;D&#39; &#xD55C;&nbsp;글</p></main>')).toBe("A & B <C> 'D' 한 글");
	});
});

describe('isAllowedUrl', () => {
	it('공개 https 주소만 허용한다', () => {
		expect(isAllowedUrl('https://careers.daangn.com/jobs/role/1/')).toBe(true);
	});

	it.each([
		'http://careers.daangn.com/',
		'ftp://example.com/',
		'https://localhost:5173/',
		'https://127.0.0.1/',
		'https://[::1]/',
		'https://192.168.0.1/',
		'https://intranet/',
		'https://printer.local/',
		'https://user:pw@example.com/',
		'아무 글자',
	])('%s는 거부한다', (url) => {
		expect(isAllowedUrl(url)).toBe(false);
	});
});

describe('readPosting', () => {
	it('페이지의 글을 돌려준다', async () => {
		const result = await readPosting('https://example.com/job', page(`<main><p>${LONG}</p></main>`));
		expect(result).toEqual({ ok: true, text: LONG.trim() });
	});

	it('허용하지 않는 주소는 요청하지 않는다', async () => {
		const neverCalled = async () => {
			throw new Error('요청하면 안 된다');
		};
		expect(await readPosting('https://localhost/', neverCalled)).toEqual({ ok: false, reason: 'invalid_url' });
	});

	it('응답이 실패면 읽기 실패다', async () => {
		const result = await readPosting('https://example.com/job', page('없음', { status: 404 }));
		expect(result).toEqual({ ok: false, reason: 'fetch_failed' });
	});

	it('요청 자체가 실패해도 읽기 실패다', async () => {
		const offline = async () => {
			throw new TypeError('network');
		};
		expect(await readPosting('https://example.com/job', offline)).toEqual({ ok: false, reason: 'fetch_failed' });
	});

	it('HTML이 아니면 읽지 않는다', async () => {
		const pdf = async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } });
		expect(await readPosting('https://example.com/job.pdf', pdf)).toEqual({ ok: false, reason: 'not_html' });
	});

	it('구조화된 공고 데이터가 있으면 제목과 설명을 먼저 쓴다', async () => {
		const data = { '@type': 'JobPosting', title: '프론트엔드 개발자', description: `<h3>자격 요건</h3><ul><li>${LONG}</li></ul>` };
		const html = `<script type="application/ld+json">${JSON.stringify(data)}</script><main><p>${LONG}</p><p>연관 콘텐츠</p></main>`;
		const result = await readPosting('https://example.com/job', page(html));
		expect(result).toEqual({ ok: true, text: `프론트엔드 개발자\n### 자격 요건\n- ${LONG.trim()}` });
	});

	it('배열과 @graph 안의 공고 데이터도 찾는다', async () => {
		const posting = { '@type': ['JobPosting'], title: 'A', description: LONG };
		const graph = { '@graph': [{ '@type': 'Organization' }, posting] };
		for (const data of [[{ '@type': 'Organization' }, posting], graph]) {
			const html = `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
			expect(await readPosting('https://example.com/job', page(html))).toEqual({ ok: true, text: `A\n${LONG.trim()}` });
		}
	});

	it('설명이 한 번 더 이스케이프돼 있어도 태그를 지운다', async () => {
		const data = { '@type': 'JobPosting', title: 'A', description: `&lt;p&gt;${LONG}&lt;/p&gt;` };
		const html = `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
		expect(await readPosting('https://example.com/job', page(html))).toEqual({ ok: true, text: `A\n${LONG.trim()}` });
	});

	it('깨진 구조화 데이터는 무시하고 본문을 읽는다', async () => {
		const html = `<script type="application/ld+json">{깨짐</script><main><p>${LONG}</p></main>`;
		expect(await readPosting('https://example.com/job', page(html))).toEqual({ ok: true, text: LONG.trim() });
	});

	it('article이 있으면 main의 나머지 영역을 빼고 읽는다', async () => {
		const html = `<main><article><p>${LONG}</p></article><aside>연관 콘텐츠</aside></main>`;
		expect(await readPosting('https://example.com/job', page(html))).toEqual({ ok: true, text: LONG.trim() });
	});

	it('공고 영역 없이 메뉴만 있는 페이지는 읽은 것으로 치지 않는다', async () => {
		const html = `<body><nav>${LONG}</nav></body>`;
		expect(await readPosting('https://example.com/job', page(html))).toEqual({ ok: false, reason: 'no_text' });
	});

	it('구조화 데이터에 요건이 없으면 요건이 있는 영역을 쓴다', async () => {
		const summary = '주요 업무를 소개하는 글입니다. '.repeat(20);
		const data = { '@type': 'JobPosting', title: 'A', description: summary };
		const html = `<script type="application/ld+json">${JSON.stringify(data)}</script><main><p>${LONG}</p></main>`;
		expect(await readPosting('https://example.com/job', page(html))).toEqual({ ok: true, text: LONG.trim() });
	});

	it('요건을 어디에서도 찾지 못하면 읽은 것으로 치지 않는다', async () => {
		const summary = '정규직 채용을 진행합니다. 자세한 조건은 공고를 확인해 주세요. '.repeat(10);
		expect(await readPosting('https://example.com/job', page(`<main><p>${summary}</p></main>`))).toEqual({
			ok: false,
			reason: 'no_text',
		});
	});

	it('영어 공고의 요건도 알아본다', async () => {
		const english = 'You have strong experience with React and TypeScript. '.repeat(15);
		const result = await readPosting('https://example.com/job', page(`<main><p>${english}</p></main>`));
		expect(result).toEqual({ ok: true, text: english.trim() });
	});

	it('응답의 문자 인코딩대로 읽는다', async () => {
		const eucKr = [0xc0, 0xda, 0xb0, 0xdd, 0x20, 0xbf, 0xe4, 0xb0, 0xc7, 0x20];
		const open = [...new TextEncoder().encode('<main><p>')];
		const close = [...new TextEncoder().encode('</p></main>')];
		const bytes = new Uint8Array([...open, ...Array.from({ length: 100 }, () => eucKr).flat(), ...close]);
		const legacy = async () => new Response(bytes, { headers: { 'content-type': 'text/html; Charset=euc-kr' } });
		const result = await readPosting('https://example.com/job', legacy);
		expect(result).toEqual({ ok: true, text: '자격 요건 '.repeat(100).trim() });
	});

	it('서비스 이름을 밝히고 요청한다', async () => {
		let agent: string | null = null;
		await readPosting('https://example.com/job', async (_url, init) => {
			agent = new Headers(init?.headers).get('user-agent');
			return new Response('');
		});
		expect(agent).toContain('jobmap');
	});

	it('항목 이름만 있는 짧은 글은 읽은 것으로 치지 않는다', async () => {
		const labels = '지원자격 경력무관 학력무관 '.repeat(15);
		expect(await readPosting('https://example.com/job', page(`<main><p>${labels}</p></main>`))).toEqual({
			ok: false,
			reason: 'no_text',
		});
	});

	it('허용된 주소로의 리다이렉트는 따라간다', async () => {
		const seen: string[] = [];
		const result = await readPosting('https://example.com/old', async (url) => {
			seen.push(url);
			if (url.endsWith('/old')) return new Response(null, { status: 302, headers: { location: '/new' } });
			return page(`<main><p>${LONG}</p></main>`)();
		});
		expect(seen).toEqual(['https://example.com/old', 'https://example.com/new']);
		expect(result).toEqual({ ok: true, text: LONG.trim() });
	});

	it('내부 주소로의 리다이렉트는 요청하지 않는다', async () => {
		const seen: string[] = [];
		const result = await readPosting('https://example.com/old', async (url) => {
			seen.push(url);
			return new Response(null, { status: 302, headers: { location: 'https://localhost/secret' } });
		});
		expect(seen).toEqual(['https://example.com/old']);
		expect(result).toEqual({ ok: false, reason: 'invalid_url' });
	});

	it('리다이렉트가 끝없이 이어지면 읽기 실패다', async () => {
		let calls = 0;
		const result = await readPosting('https://example.com/a', async () => {
			calls += 1;
			return new Response(null, { status: 302, headers: { location: `/next${calls}` } });
		});
		expect(result).toEqual({ ok: false, reason: 'fetch_failed' });
		expect(calls).toBeLessThanOrEqual(6);
	});

	it('응답이 너무 크면 끝까지 읽지 않고 실패로 본다', async () => {
		const huge = async () =>
			new Response(new Uint8Array(6 * 1024 * 1024), { headers: { 'content-type': 'text/html' } });
		expect(await readPosting('https://example.com/job', huge)).toEqual({ ok: false, reason: 'fetch_failed' });
	});

	it('글이 거의 없는 페이지는 본문을 못 읽은 것으로 본다', async () => {
		const result = await readPosting('https://example.com/job', page('<main><div id="root">로딩</div></main>'));
		expect(result).toEqual({ ok: false, reason: 'no_text' });
	});
});
