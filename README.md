# HR 노무전문가 토킹클럽

한국 기업의 HR/노무 질문을 여러 전문가 패널이 라운드별로 토론하고, 마지막에 실무형 Decision Card를 제시하는 Next.js + TypeScript MVP입니다.

## 기능

- 한국어 우선 로비 화면과 회의장형 토론 화면
- 샘플 질문 선택 및 자동 사안 세팅
- 질문 재작성, 카테고리 분류, 자동 패널 선택
- 노동법 변호사, 공인노무사, HRBP, 보상·평가, 조직개발, CFO, 지배구조법 패널
- 3라운드 토론, 현재 발언자 하이라이트, SSE 기반 순차 출력
- 최종 Decision Card, 즉시 액션, 증빙 체크리스트, Governance 체크리스트
- API key 없이도 완전 동작하는 mock mode
- Anthropic Claude Messages API 기반 real mode

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3100`으로 접속합니다.

## 환경변수

`.env.example`을 참고해 `.env.local`을 만듭니다.

```bash
ANTHROPIC_API_KEY=
CLAUDE_MODEL_CLASSIFIER=claude-sonnet-4-20250514
CLAUDE_MODEL_DEBATE=claude-sonnet-4-20250514
CLAUDE_MODEL_SUMMARY=claude-sonnet-4-20250514
APP_MOCK_MODE=false
```

동작 원칙:
- `APP_MOCK_MODE=true`이면 mock mode입니다.
- `ANTHROPIC_API_KEY`가 없으면 mock mode입니다.
- `ANTHROPIC_API_KEY`가 있고 `APP_MOCK_MODE=false`이면 Claude real mode입니다.
- 화면에는 API key 입력칸을 두지 않습니다. key는 `.env.local`의 `ANTHROPIC_API_KEY`로만 관리합니다.

## API

- `POST /api/debate/start`: 질문 재작성, 카테고리/쟁점 추출, 패널 선택
- `POST /api/debate/stream`: SSE 이벤트로 라운드별 발언과 최종 결론 송신
- `GET /api/personas`: persona registry 반환
- `GET /api/sample-questions`: 샘플 질문 반환
- `POST /api/discuss`: 기존 화면 호환용 통합 응답 API

SSE 이벤트:
- `session_created`
- `intro`
- `round_started`
- `speaker_started`
- `speaker_chunk`
- `speaker_finished`
- `round_finished`
- `final_decision`
- `completed`
- `error`

## 폴더 구조

- `app/page.tsx`: 로비 + 토론 화면
- `app/api/debate/start/route.ts`: 토론 세션 시작 API
- `app/api/debate/stream/route.ts`: SSE 토론 스트림 API
- `lib/llm/client.ts`: Anthropic Claude Messages API client
- `lib/llm/prompts.ts`: 공통/페르소나/라운드/최종결론 프롬프트
- `lib/debate/rewriter.ts`: 질문 재작성
- `lib/debate/generateSpeech.ts`: 패널별 발언 생성
- `lib/debate/synthesizer.ts`: 최종 Decision Card 생성
- `lib/debate/orchestrator.ts`: mock/real 라운드 오케스트레이션
- `lib/debate/selector.ts`: 카테고리와 질문 기반 패널 선택
- `lib/personas/registry.ts`: persona 단일 원천
- `lib/knowledge/*`: HR 원칙, 노무 체크리스트, Governance 원칙, 샘플 질문
- `data/mock/mockDebates.json`: mock debate fixture

## Persona 수정

패널 이름, 역할, 말투, 우선순위, 금지 규칙은 `lib/personas/registry.ts`에서 수정합니다. 지배구조법 패널은 `domainMemory`를 통해 내부통제, 보고라인, 이사회/위원회 감독책임, 금융회사/상장사 governance risk 관점이 real mode prompt에 직접 주입됩니다.

## Knowledge 수정

공통 판단 원칙은 `lib/knowledge` 아래 파일을 수정합니다.

- `hr-principles.ts`
- `labor-risk-checklist.ts`
- `governance-principles.ts`
- `suggested-questions.ts`
- `debate-fixtures.ts`

mock 토론 데이터는 `data/mock/mockDebates.json`을 수정합니다.

## 검증

```bash
npm run typecheck
npm run build
```

## 확장 포인트

- mock debate fixture 추가
- 카테고리별 selector 정교화
- Claude token-level streaming 적용
- 세션 저장소 도입
- 토론 결과 Word/PDF export
- 관리자용 persona/knowledge 편집 UI
