import { describe, expect, it } from 'vitest';
import { extractText, isAllowedUrl, readPosting } from './read-posting.ts';

const LONG = '프론트엔드 개발자를 찾고 있어요. '.repeat(10);

function page(body: string, init?: ResponseInit) {
	return async () => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });
}

describe('extractText', () => {
	it('태그와 스크립트, 스타일을 빼고 글만 남긴다', () => {
		const html = '<html><style>a{}</style><script>var a="b"</script><body><h1>제목</h1><p>본문</p></body></html>';
		expect(extractText(html)).toBe('제목\n본문');
	});

	it('main이 있으면 main 안의 글만 쓴다', () => {
		expect(extractText('<body><nav>메뉴</nav><main><p>공고</p></main><footer>주소</footer></body>')).toBe('공고');
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

	it('글이 거의 없는 페이지는 본문을 못 읽은 것으로 본다', async () => {
		const result = await readPosting('https://example.com/job', page('<main><div id="root">로딩</div></main>'));
		expect(result).toEqual({ ok: false, reason: 'no_text' });
	});
});
