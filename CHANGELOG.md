# 학자금 OCR 파이프라인 v2 — 배포 변경 내역

**적용일**: 2026-04-22
**버전 태그**: `tuition-ocr.v2.0`
**대상 배포**: Render.com (hrroom.onrender.com) / `uvicorn server:app`

---

## 요약 (MECE)

설계서 "학자금 영수증 OCR 파이프라인 개선 설계서"를 `deploy/` 폴더(= GitHub push 대상)에 반영했습니다. 기존 동작을 깨지 않으면서 설계서의 (A) 금액 4분리 스키마, (B) 규칙엔진, (C) 중복탐지, (D) Claude-A 분류 / Claude-B 추출 2-패스, (E) 관리자 재추출/재업로드 요청 플로우를 덧씌우는 방식(overlay)으로 구현했습니다.

### 변경 범위 (세 파일)
1. **`server.py`** (1801 → 2257 라인, +456)
2. **`static/tuition/pages/apply.html`** (492 → 549 라인, +57)
3. **`static/tuition/pages/admin_review.html`** (915 → 987 라인, +72)

---

## 1) 백엔드 (`server.py`)

### 1-1. 신규 파이프라인 모듈 (cross_reference 직후 삽입)

상수:

- `PIPELINE_VERSION = "tuition-ocr.v2.0"`
- `PROMPT_VERSION_EXTRACT/CLASSIFY/REVIEW`
- 임계값: `CONF_AUTO_APPROVAL=0.85`, `CONF_MANUAL_REVIEW=0.70`, `CONF_SCREENSHOT_CAP=0.75`, `CONF_LOW_QUALITY_CAP=0.70`
- `_CORE_FIELDS` = school_name / child_name / academic_year / semester_code / actual_paid_amount
- `_SCHOOL_ALIASES` = 대학 별칭 사전 (서울대/연대/고대/한양대/성균관대)

헬퍼:

- `_to_int_amount(v)` — 콤마·'원'·공백 제거 후 정수화
- `_normalize_semester(raw)` — '1'|'2'|'summer'|'winter'|'unknown'
- `_school_alias_match(a, b)` — 부분일치 + 별칭 사전 매칭
- `_ocr_normalize(ocr)` — 설계서 스키마로 OCR 결과 정규화 (금액 4분리, semester_code, document_type 매핑, 기본 플래그)
- `_rule_engine(ocr, cross_ref, hints)` — F/S/N/M/C/R 카테고리별 점검, blockers/warnings/confidence/decision 산출
- `_duplicate_by_hash(sha256, employee_id, window_days=90)` — `applications.json` 전체 스캔

### 1-2. `/api/ocr-invoice` 프롬프트 v2 전면 교체

- 신규 필드: `document_type` (enum), `source_quality` (high/medium/low), `is_screenshot_suspect` (bool), `extracted_text_snippets`
- 금액 4분리: `gross_tuition_amount / scholarship_amount / discount_amount / actual_paid_amount / unpaid_amount`
- 학년도/학기 분리: `academic_year`, `semester_code`
- "JSON만 반환, 코드블록 금지, 추정 금지" 명시

응답에 `_ocr_normalize()` 자동 적용 및 `prompt_version / pipeline_version` 태그 부착.

### 1-3. `/api/tuition/submit` 확장 (기존 유지 + 규칙엔진 연동)

Request 추가 필드:

- `file_sha256` (원본 파일 해시)
- `source_file_type` (pdf|image|unknown)
- `application_hints` (프론트 힌트 dict)

Response 추가 필드: `decision`, `confidence`, `blockers`, `warnings`, `review_required`, `pipeline_version` — 기존 `verdict`, `flags`는 그대로 유지.

저장 레코드에 `rule_result`, `file_sha256`, `duplicate_scan`, `pipeline_version` 추가.

### 1-4. 신규 엔드포인트 3종

| 메서드 | 경로 | 용도 |
|--|--|--|
| POST | `/api/ocr-classify` | Claude-A 분류 패스(문서유형/품질/캡처의심) — 본격 추출 전 빠른 컷오프 |
| POST | `/api/tuition/admin/applications/{app_id}/reextract` | 관리자가 저신뢰 건에 대해 이미지 재업로드 → 2차 추출·재평가 |
| POST | `/api/tuition/admin/applications/{app_id}/request-reupload` | 관리자가 직원에게 재업로드 요청(상태 전이 기록) |

### 1-5. 유지된 기존 엔드포인트

`/api/tuition/admin/applications`, `/api/tuition/admin/applications/{id}`, PATCH `.../action`, POST `.../draft`, `/api/ellis/*`, `/api/hr-newsroom/digest`, `/api/fetch-reference`, `/api/score-resumes`, `/api/hrx/feedback`, `/api/health`, 그리고 `/tuition` · `/` 정적 마운트 모두 그대로 유지.

### 1-6. 하위호환

- `amount_total` ↔ `actual_paid_amount` 양방향 정규화 — 구버전 프론트가 `amount_total`만 보내더라도 서버가 자동 보정.
- 기존 `cross_reference()` 로직은 전혀 수정하지 않음. 규칙엔진은 그 위에 추가 레이어로 동작.

---

## 2) 프론트 — 직원 신청 페이지 (`apply.html`)

1. **PDF 원본 권장 배너** — 업로드 영역 아래에 주황색 경고 박스: "캡처본은 해상도·편집 의심으로 신뢰도가 낮게 평가됩니다. PDF 원본·고해상도 스캔본 업로드 시 자동승인 확률 상승."
2. **저신뢰 알림** (`#lowq-alert`) — Step 3에서 `confidence<70` OR `is_screenshot_suspect` OR `source_quality==='low'` 일 때 재업로드 권장 배너 표시.
3. **OCR 결과 그리드 v2** — '납부 총액' → '실납부액' 강조, '등록금 총액 / 장학금 / 감면·할인' 3개 필드 추가, '수혜연도·기간' → '학년도·학기' (academic_year + semester_code).
4. **제출 로직** — `crypto.subtle.digest('SHA-256')` 로 원본 파일 해시 계산 후 `file_sha256`, `source_file_type`, `application_hints` 동봉 전송.
5. **영수증 화면** — 서버가 반환한 `decision` 을 한국어로 맵핑하여 '처리 상태' 표시 (자동승인 후보 / 수기 검토 예정 / 재업로드 요청 예정 / 반려 예정), `warnings` 상위 3개를 '검토 참고' 행으로 노출.

---

## 3) 프론트 — 관리자 검토 페이지 (`admin_review.html`)

1. **사이드바 확장** — 기존 '판정' 아래에 'AI 결정' 과 '신뢰도' 행 추가.
2. **규칙엔진 패널** (Step 1 상단) — decision 배지(색 구분), 신뢰도 %, 블로커(빨강)/경고(노랑) 리스트, '재추출' 버튼.
3. **재추출 버튼** (`triggerReextract()`) — 파일 선택 → base64 인코딩 → `/api/tuition/admin/applications/{id}/reextract` 호출 → decision/confidence 토스트 후 페이지 새로고침.
4. **비교 그리드** — '납부총액' → '실납부액' (`ocr.actual_paid_amount || ocr.amount_total`).
5. **기안문 빌더** — 본문의 납부액 라인도 실납부액 기준으로 산출.

---

## 4) 운영 · 배포 체크리스트

1. `git add server.py static/tuition/pages/apply.html static/tuition/pages/admin_review.html CHANGELOG.md`
2. `git commit -m "feat(tuition): OCR 파이프라인 v2 — 규칙엔진·중복탐지·재추출 도입"`
3. `git push origin main` → Render 자동 배포
4. 배포 후 `GET /api/health` 가 `200` 인지, `POST /api/ocr-classify` 가 `503` (ANTHROPIC_API_KEY 미설정) 또는 정상 JSON 을 반환하는지 확인
5. 기존 신청 데이터 (`data/applications.json`) 는 스키마가 단순 확장이므로 마이그레이션 불필요 — 구 레코드는 `rule_result` 필드가 없을 뿐 정상 조회됨

---

## 5) 알려진 한계 / 다음 단계 로드맵

- **Claude-C 리뷰 패스**: 상수·버전 태그는 준비됐으나 실제 엔드포인트·호출 로직은 본 릴리스에 포함되지 않음. 다음 릴리스에서 `/api/tuition/admin/applications/{id}/review` 로 추가 예정.
- **별칭 사전 확대**: `_SCHOOL_ALIASES` 는 대학교 대표 5 건만 등록. 유치원·고교·해외교 별칭은 운영 데이터 누적 후 점진적 보강.
- **PII 로깅**: 현재 `rule_trace` 에 원본 금액·학교명이 포함됨. 운영 환경 로그 수집 시 마스킹 미들웨어 추가 고려.
- **재추출 원본 보관**: `/reextract` 는 관리자가 다시 업로드한 이미지만 재분석. 최초 업로드 이미지 서버 저장은 Phase 2(MinIO/S3 연동)에서 다룸.
- **confidence 가중 공식**: 현재 `0.05*warning + 0.15*blocker` 선형 감점. 설계서의 `0.20*Q + 0.15*T + 0.25*F + 0.20*L + 0.15*M − 0.05*W` 세부 가중치는 실측 후 튜닝.
