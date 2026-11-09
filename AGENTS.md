# 잡맵 작업 규칙

잡맵은 이력서와 채용 공고를 비교해, 일주일에 쓸 수 있는 시간 안에서 이번 주 할 일을 정해 주는 서비스다.
화면 기준은 [잡맵 데모](https://claude.ai/artifact/BeCyRi5WrxU8xdTUnQf5mY), 일정은 [제작 계획](https://claude.ai/artifact/RtrRD2vrb98MfkgWU2ieR8)을 따른다.

## 구조

- `agent/`: Flue 에이전트 서버(Cloudflare Workers). 세부 규칙은 `agent/AGENTS.md`.
- `web/`: React 화면(Vite). 개발 중에는 `/agents` 요청을 `localhost:5173`으로 넘긴다.
- `docs/decision-log.md`: 판단 기록. `docs/evaluation.md`: 평가 기준과 결과.

## 명령

- Node 24 (`nvm use`)
- 에이전트: `cd agent && npm run dev` (5173), `npm test`, `npm run check:types`
- 화면: `cd web && npm run dev` (5174), `npm run lint`, `npm run build`
- Flue API는 지어내지 말고 `cd agent && npx flue docs search <검색어>`로 확인한다.

## 역할 나누기

- 에이전트: 판단과 설명(요건 비교, 확인 질문, 방향 제안, 문장 초안).
- 코드: 틀리면 안 되는 일(근거 문장이 원문에 있는지 확인, 시간 합계, 저장). 이런 함수는 Vitest 테스트를 먼저 쓴다.
- 사용자: 최종 결정. 에이전트 판단은 사용자가 바꿀 수 있어야 한다.

## 규칙

- API 키와 비밀 값은 `agent/.env`에만 둔다. 저장소에 올리지 않는다.
- 동작이 바뀌는 코드는 실패하는 테스트를 먼저 쓴다. 문서와 문구 수정은 테스트를 쓰지 않는다.
- 모델, 프롬프트, 판단 기준을 바꾸면 `docs/evaluation.md`의 숫자를 다시 재고 `docs/decision-log.md`에 한 줄 남긴다.
- 화면 문구는 짧은 존댓말(토스 톤). 붙여 쓴 가운뎃점과 엠대시는 쓰지 않는다.

## 커밋

[Conventional Commits 1.0.0](https://www.conventionalcommits.org/ko/v1.0.0/)을 따르고 `npx commitlint`로 검사한다.

- 제목: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`, `refactor:` + 한국어 명사형 한 줄 ("~ 추가", "~ 수정")
- 본문: 필요할 때만. 소제목(문제, 변경, 측정) 아래 `-` 불릿
- 크기: 커밋 하나는 되돌려도 다른 기능이 깨지지 않는 한 가지 변경. 테스트와 그 구현은 같은 커밋에 둔다.
- 공동 작성 trailer는 넣지 않는다.
