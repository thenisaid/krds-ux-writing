# TODOS

공개 백로그 — 현재 스코프에서 의도적으로 제외한 항목들.
각 항목에는 동기(Why)와 시작점(Context)을 명시하여 나중에 이 파일을 보는 사람도 판단할 수 있도록 함.

---

## 열린 항목

### TODO-015: AI 인라인 지적 — 겹친 팝오버 UI 처리
**Priority**: P3
**Discovered by**: /autoplan (CEO 리뷰) 2026-08-20
**What**: 두 개 이상의 지적이 화면상 인접/겹칠 때 팝오버를 어떻게 배치할지 미설계.
**Why**: 짧은 문장에 여러 위반이 몰리면(예: 행정어+이중부정 동시 발생) 팝오버가 겹쳐 가독성이 떨어질 수 있음.
**Pros**: 실사용 시 혼란 방지, 완성도 상승
**Cons**: 지금 막지 않아도 초기 데모(시연 페이지 1곳, 공개 예시 문구)에서는 드문 케이스
**Context**: 설계 문서(7457948-main-design-20260819.md) Section 4 리뷰에서 발견. content script 구현(Next Steps #2) 중 실제로 겹치는 사례가 나오면 그때 UI 패턴 결정.
**Effort**: S (human) → S (CC)
**Depends on**: content script 뼈대 구현 완료 후

### TODO-016: AI 인라인 지적 — 반복 문장 캐싱
**Priority**: P3
**Discovered by**: /autoplan (CEO 리뷰) 2026-08-20
**What**: 사용자가 커서만 이동하고 텍스트를 바꾸지 않았는데 동일 문장이 재검사되는 경우 캐싱.
**Why**: API 호출 비용/레이턴시(Open Questions #3)를 줄이는 손쉬운 최적화.
**Pros**: 비용 절감, 체감 속도 향상
**Cons**: 캐시 무효화 시점(원칙/사전 버전이 바뀌면?) 추가 설계 필요
**Context**: Section 7(Performance) 리뷰에서 발견. Next Steps #1 API 계약 스파이크 이후, 실제 호출 빈도를 보고 우선순위 재평가.
**Effort**: S (human) → S (CC)
**Depends on**: Next Steps #1 (API 계약 스파이크) 완료

### TODO-017: AI 인라인 지적 — 룰 후보 반영 배지·Top5 요약·PR 미리보기
**Priority**: P3
**Discovered by**: /autoplan (CEO 리뷰, CEO 플랜 문서에서 이관) 2026-08-20
**What**: (1) 룰 후보가 실제 반영되면 확장에 배지/알림 표시 (2) 옵션 화면에 "이번 주 거절 패턴 Top 5" 요약 (3) 룰 후보 diff를 GitHub PR처럼 미리보기.
**Why**: 학습 루프에 기여했다는 피드백을 사용자에게 주는 델라이트 요소 — CEO 리뷰의 10x 확장 스캔에서 발견됐으나 학습 루프 인프라(이벤트 수집처+스키마)가 먼저 서야 의미가 있어 이번 사이클에서는 보류.
**Pros**: 사용자 참여감 상승, "죽어있는 도구"가 아니라 "살아있는 헌법"이라는 비전에 부합
**Cons**: 이벤트 수집처/스키마 확정 전에는 구현 불가능한 3개 항목을 한 TODO로 묶음 — 실제 착수 시 분리 필요
**Context**: CEO 플랜(~/.gstack/projects/thenisaid-krds-ux-writing/ceo-plans/2026-08-20-ai-inline-lint-rule-loop.md) Expansion scan에서 (b)(c)(e)로 식별, DEFERRED 결정.
**Effort**: M (human) → S (CC) per item
**Depends on**: Next Steps #3(이벤트 수집처 결정), #4(이벤트 스키마 설계) 완료

### TODO-011: Anthropic API 월 사용량 한도 설정
**Priority**: P2
**What**: Anthropic 대시보드 → Settings → Billing → Usage limits에서 월 하드 리밋($10-20) 설정
**Why**: Vercel 배포 후 공개 URL로 API가 노출됨. 레이트 리밋(5회/IP/시간)은 in-memory Map 기반으로 cold start 시 초기화됨(TODO-002). 의도치 않은 비용 폭주 방어 최후의 안전망.
**Pros**:
- 비용 폭주 방지 (한도 초과 시 API가 429 반환)
- 구현 비용: ~5분 (Anthropic 대시보드에서 수동)
**Cons**:
- 한도 초과 시 정상 사용자도 차단됨
**Context**: Vercel 배포(2026-05-08) 이후 즉시 적용 권장. plan-ceo-review Section 3 (Security) 에서 발견.
**Depends on**: Vercel 배포 완료
**Blocked by**: 현재 회사(HMG) 프록시를 통해 Claude API 사용 중 → 개인 Anthropic 계정 없음. 회사로부터 독립하는 시점에 처리. (`console.anthropic.com → Settings → Billing → Usage limits`)

---

### TODO-001: HWP/Word 다운로드 포맷 지원
**Priority**: P2
**What**: 현재 독립 실행형 HTML 파일만 제공하는 다운로드 기능을 `.hwp` 또는 `.docx` 포맷으로 확장
**Why**: 공공기관 내부 결재·공문 프로세스는 한글(HWP) 또는 Word 기반. 생성된 가이드라인을 기관이 내부 문서 시스템에 바로 첨부하려면 HTML이 아닌 오피스 포맷이 필요함. SeMA 담당자의 실제 사용 패턴에서 확인 필요.
**Pros**:
- 기관 내부 결재 프로세스와 완전히 통합 가능
- "HTML을 어떻게 쓰나요?" 라는 장벽 제거
- 공공기관 담당자 채택률 상승 기대

**Cons**:
- HWP: 오픈소스 라이브러리 성숙도 낮음 (libreoffice 서버 필요 또는 HWP SDK 라이선스)
- Word: `docx` npm 패키지 존재하지만 스타일 충실도 제한적
- Vercel Edge Function은 무거운 런타임 불가 → Python/LibreOffice 기반은 Phase 2 내부망 배포 시 가능

**Context**: MVP에서는 HTML 다운로드로 충분히 증명 가능. 2개 기관 파일럿(SeMA + 추가 1곳) 피드백에서 "HWP로 줘야 쓸 수 있겠다"는 반응이 나오면 Phase 2 최우선 작업으로 격상.
**Depends on**: Phase 2 내부망 배포 전환 (Python FastAPI 백엔드) 또는 Vercel 외부 PDF/docx 변환 서비스 연동
**Blocked by**: 없음 (MVP 이후 독립적으로 진행 가능)

---

### TODO-002: 레이트 리밋 지속성 — Vercel KV 전환
**Priority**: P3
**What**: 현재 in-memory `Map` 기반 레이트 리밋을 Vercel KV (또는 동등한 엣지 호환 KV 스토어)로 교체
**Why**: Vercel Edge Function은 요청마다 새 V8 isolate가 생성될 수 있어, in-memory `Map`이 cold start 시 초기화됨. 동일 IP가 서버 재시작 사이에 5회 제한을 우회할 수 있는 구조적 취약점. MVP 단계에서는 실제 피해가 낮지만(트래픽 적음), 파일럿 이후 노출도 증가 시 대응 필요.
**Pros**:
- Cold start 간 레이트 리밋 상태 유지 → 제한 우회 불가
- Vercel KV는 Edge Runtime 완전 호환 (Zero-latency reads)
- 기관별 사용 통계 수집 기반 마련 (Phase 2 분석)

**Cons**:
- Vercel KV는 유료 플랜 필요 (Hobby 플랜 무료 티어 한정적)
- in-memory보다 약간 느린 레이턴시 (~1ms)
- 환경 변수 `KV_REST_API_URL`, `KV_REST_API_TOKEN` 추가 필요

**Context**: MVP(2026-05-10)에서는 in-memory Map으로 충분히 검증 가능. 레이트 리밋은 완전한 방어가 아닌 남용 억제 수단으로 설계되어 있으며, 우회가 발생해도 API 비용 초과 시 Claude API가 429를 반환하므로 최종 안전망은 존재함. Phase 2 내부망 배포 전환 시 함께 적용.
**Depends on**: Phase 2 전환 (Vercel KV 또는 내부망 Redis)
**Blocked by**: 없음 (MVP 이후 독립적으로 진행 가능)

> **⚠️ 알려진 경쟁 조건 (D11)**: `checkRateLimitKV`의 INCR + EXPIRE 호출은 원자적이지 않음.
> 두 요청이 동시에 count=0을 읽으면 둘 다 INCR → count=1 처리 후 EXPIRE를 각각 실행 →
> 두 번째 EXPIRE가 TTL을 초기화해 윈도우가 연장됨. 실제 영향: 창 시작 시점에 최대 N개 동시 요청이
> N+1회로 처리될 수 있음. 해결책: Lua 스크립트 또는 Vercel KV의 원자적 EVAL 사용. Phase 2 KV 전환 시 함께 적용.

---


### TODO-010: computeScore 한국어 형태소 분석기 연동 (Phase 2)
**Priority**: P3
**What**: `krds-lint.js`의 `computeScore()`는 공백 기준 어절 분리(`split(' ')`)로 단어 수를 계산함. 교착어인 한국어에서는 어절 수 ≠ 형태소 수이므로, base 값이 과소 산정되어 짧은 텍스트에서 점수가 비정상적으로 낮게 나올 수 있음.
**Why**: 영어 단어 기준 정규화는 한국어 형태소 단위 문장과 직접 비교할 수 없음. 예: "처리되시겠습니다" 1어절 = 형태소 7개.
**Fix**: Kiwi(한국어 형태소 분석기) 또는 mecab-ko 바인딩을 Node.js 모듈로 추가하여 형태소 단위 token count로 base 교체. 브라우저 환경 폴백은 현행 어절 분리 유지.
**Context**: `krds-lint.js` `computeScore()` 함수 JSDoc 주석에 한계 명시 완료 (2026-05-04). Phase 2 내부망 배포 전환 시 함께 적용.
**Depends on**: Phase 2 Node.js 서버 배포 (현재 브라우저 전용 번들)
**Blocked by**: 없음 (MVP 이후 독립적으로 진행 가능)

---

## 완료 항목

### ✅ TODO-012: DESIGN.md 생성
**완료**: 2026-05-19
**Result**: `DESIGN.md` 생성 — 색상 원시값·시맨틱 토큰·타이포·레이아웃·보더 반경·컴포넌트 스펙·Do/Don't 규칙·접근성 대비비 표 포함. Source of truth: `index.html` `:root` 블록.

### ✅ TODO-014: principles/ 프롬프트 스니펫 자동 동기화 — 완전 완료
**완료**: 2026-05-19 (인프라 + 실제 동기화 모두 완료)
**Result**:
- `scripts/sync-prompts.js` — 외부 의존성 없는 Node.js 스크립트. prompt-library.html에서 `data-principle="<id>"` 요소 추출 → 원칙 페이지 sync 마커 사이에 삽입.
- `.github/workflows/sync-prompts.yml` — prompt-library.html 또는 sync 스크립트 변경 push 시 자동 실행.
- 3개 원칙 페이지에 `<!-- sync:<id>:start/end -->` 마커 삽입 완료.
- **prompt-library.html 생성 + push → GitHub Actions 자동 실행 (commit a9c6c19)** — 3개 원칙 페이지에 스니펫 자동 삽입 완료. TODO-014 완전 종료.

### ✅ TODO-009: Generator API 배포 설정 — 현행 유지 결정
**완료**: 2026-05-08
**Decision**: GitHub Pages + "기본 양식 사용하기" 폴백으로 현행 유지. AI 생성 기능(SSE)은 외부 Anthropic API 키 없이는 공개 배포 불가 (사내 HMG 프록시 토큰은 외부 서비스에서 사용 불가). Cloudflare Pages / Vercel 배포는 별도 Anthropic 계정 확보 시점에 재검토.

### ✅ TODO-009 IP: IP 헤더 일관성 (CF-Connecting-IP)
**완료**: 2026-05-08, commit e2acb22
**Result**: `api/generate.js` `getClientIp()`에 `cf-connecting-ip` 최우선 검사 추가.

### ✅ UX-GEN-001: Generator 취소 플로우 간소화
**완료**: 2026-05-08, commit e2acb22
**Result**: `generator/app.js` 취소 버튼 2단계 → 1단계 (클릭 즉시 초기 폼 복귀).

<!-- 완료 시 날짜와 커밋 해시 기록 -->

### ✅ ISSUE-001: 다크모드 토글 이중 등록 버그
**완료**: 2026-05-14, commit 290530c
**What**: `index.html` 인라인 `<script>`와 `script.js` 양쪽에서 `#themeToggle` click 리스너가 중복 등록됨. 클릭 시 두 핸들러가 순서대로 실행되어 light→dark→light로 원위치 됨.
**Fix**: `index.html` 인라인 블록에서 Theme Toggle + Mobile Menu 섹션 제거. CSP SHA256 해시 재계산 후 업데이트.
**Fixed by**: /qa on main, 2026-05-14

### ✅ ISSUE-002: archive.html CSP — theme-init 인라인 스크립트 해시 누락
**완료**: 2026-05-14, commit bf93a9a
**What**: `archive.html` CSP `script-src` 디렉티브에 theme-init IIFE SHA256 해시 미포함 → 콘솔 에러 + 다크모드 초기화 실패 가능성.
**Fix**: `script-src`에 `'sha256-3gjIJGd6+ZKFIG/jtiC7rBSQsd4EpjvtsAnqBTXVgvA='` 추가.
**Fixed by**: /qa on main, 2026-05-14

### ✅ ISSUE-003: archive.html 한국어 원칙명 검색 불가
**완료**: 2026-05-14, commit 81ae944 (fix) + 02720c4 (cache-bust ?v=2)
**What**: `archive.js` `applyFilters()`가 원칙명 한국어('무번역', '정보핵심화', '심리적안전망')로 검색 시 거의 결과 없음. `PRINCIPLE_NAMES` 맵 부재로 원칙 코드(A/B/C)만 검색 가능.
**Fix**: `PRINCIPLE_NAMES = { 'A': '무번역', 'B': '정보핵심화', 'C': '심리적안전망' }` 맵 추가 + `applyFilters()`에 `.principle.split('/').some(p => PRINCIPLE_NAMES[p.trim()].includes(q))` 검색 로직 추가.
**Verified**: '무번역' 검색 → 77개 표시 / 전체 222개 (정상)
**Fixed by**: /qa on main, 2026-05-14

### ✅ TODO-001: HWP/Word 다운로드 드롭다운 UI
**완료**: 2026-05-04, commit 3a77440
**Result**: generator/index.html + app.js — split-button 드롭다운 (HTML/.hwp/.docx), role=menu, 키보드 Arrow/Enter/Esc. HWP/Word은 "준비 중" 배지 표시 + 에러 메시지 반환.

### ✅ TODO-002: 레이트 리밋 KV 스텁
**완료**: 2026-05-04, commit 3a77440
**Result**: api/generate.js — checkRateLimitKV() 추가. KV_REST_API_URL/TOKEN 환경변수 설정 시 Vercel KV INCR/EXPIRE, 미설정 시 in-memory 폴백.

### ✅ TODO-003: Skip-to-content 링크
**완료**: 2026-05-04, commit 3a77440
**Result**: 3개 파일 `<body>` 바로 다음 `.skip-link` 추가. lint.html→`#main`, archive.html/generator→`#main-content`. focus-visible + reduced-motion CSS 포함.

### ✅ TODO-004: Print 스타일시트
**완료**: 2026-05-04, commit 3a77440
**Result**: 3개 파일 `@media print` 추가. GNB/toast/공유버튼 숨김, body 흑백, @page 2cm 여백, .card page-break-inside:avoid. lint.html `.empty-print-msg` 요소 추가.

### ✅ TODO-005: 태블릿 브레이크포인트
**완료**: 2026-05-04, commit 3a77440
**Result**: lint.html `.grid-2` 브레이크포인트 680px→900px 확장. archive.html/generator 불필요 (기존 그리드 대응).

### ✅ TODO-006: prefers-reduced-motion 전체 적용
**완료**: 2026-05-04, commit 3a77440
**Result**: lint.html — score-ring/filter-tab/toast 전환 비활성화. archive.html — arc-card/arc-tab 전환 비활성화. generator — 기존 spinner 블록 유지 + skip-link 추가.

### ✅ TODO-007: CSS 토큰 --krds-* 프리픽스 통일
**완료**: 2026-05-04, commit 3a77440
**Result**: Python re.sub + `(?![-\w])` 음수 전방탐색으로 접두어 충돌 없이 3개 파일 전체 교체. focus ring: textarea outline:none 제거 → :focus outline 추가, arc-search outline:none → :focus-visible outline 추가.

### ✅ ISSUE-003: archive.html recommendation 필드 항상 빈값
**완료**: 2026-05-06, commit ba22fde
**What**: getField('권장 개선안')이 Cycle 8+ 항목(수정 제안/개선안 라벨 사용)을 매칭 못해 222개 카드 모두 recommendation 빈값
**Fix**: `recommendation: getField('권장 개선안') || getField('수정 제안') || getField('개선안')`

### ✅ lint.html 중복 CSP 헤더 (DOMPurify CDN 차단)
**완료**: 2026-05-06, commit eac62c2
**What**: 두 번째 `<meta Content-Security-Policy>` 태그가 첫 번째를 덮어써 cdn.jsdelivr.net이 script-src에서 제거됨
**Fix**: Python 문자열 치환으로 중복 태그 제거

### ✅ api/generate.js 레이트 리밋 Map 크기 버그
**완료**: 2026-05-06, commit eac62c2
**What**: rateLimitMap.set() 가 RATE_LIMIT_MAP_MAX 검사 전에 호출되어 Map 무한 증가 가능
**Fix**: `if (rateLimitMap.size < RATE_LIMIT_MAP_MAX)` 가드 추가

### ✅ TODO-008: Danger 색상 통일 (#d9342b)
**완료**: 2026-05-02 (lint/archive/design-system), 2026-05-04 (generator — commit 8dfdf3a)
**What**: lint.html `#d43a2f`, archive.html `#c7371a`, generator/index.html `#c82020` → `#d9342b`로 통일
**Result**: 4개 파일(lint.html, archive.html, design-system.md, generator/index.html) 모두 `#d9342b` 동일


---

### ~~TODO-013: warning 색상 접근성 — 텍스트에 #92580a 사용~~ ✅ FIXED
**Priority**: P3
**Discovered by**: /qa 2026-05-15
**Fixed by**: /qa 2026-05-18 (commit b4a1768)
**What**: `--color-warning-50: #c07000` → `#92580a` in lint.html (3.42:1 → 5.25:1 on #fdf3dc). Dark mode override `#d08000` added (5.26:1 on #2a1e06). Hardcoded rgba/hex values updated.
**Why**: WCAG 1.4.3 — 텍스트 색상 대비 최소 4.5:1 요건
**Status**: RESOLVED

---

### TODO-014: principles/ 프롬프트 스니펫 자동 동기화
**Priority**: P3
**Discovered by**: /plan-ceo-review 2026-05-18
**What**: `prompt-library.html`의 10개 프롬프트 패턴과 `principles/` 3개 페이지에 발췌 삽입된 핵심 패턴(3개) 간 콘텐츠 동기화 자동화. 현재는 수동 업데이트 필요 — prompt-library.html 수정 시 각 원칙 페이지도 수동으로 같이 업데이트해야 함.
**Why**: prompt-library.html이 단일 진실 소스(source of truth). principles/ 페이지의 발췌 스니펫이 오래된 버전으로 방치될 경우 원칙-실행 간 내용 불일치 발생.
**Pros**:
- 수동 동기화 작업 완전 제거
- 콘텐츠 일관성 자동 보장
- 향후 패턴 10개→20개 확장 시 스케일 가능
**Cons**:
- 빌드 스텝 추가 필요 (현재 빌드 파이프라인 없음 — GitHub Pages 정적 배포)
- 발췌 선정 로직(어떤 3개를 각 원칙 페이지에) 코드로 인코딩 필요
- 오버헤드 대비 현재 스코프(3개 페이지 × 3패턴 = 9개 스니펫)에서 ROI 낮음
**Context**: /plan-ceo-review 2026-05-18 SELECTIVE EXPANSION 검토에서 발견. prompt-library.html 완성 이후 수동 동기화 운영 → 콘텐츠 규모 증가 시 자동화 재검토. 배포 파이프라인 없는 GitHub Pages 환경에서는 Node.js 빌드 스크립트 + GitHub Actions 조합이 가장 현실적.
**Depends on**: prompt-library.html 완성 (현재 스코프 내)
**Blocked by**: 없음
