# TODOS

공개 백로그 — 현재 스코프에서 의도적으로 제외한 항목들.
각 항목에는 동기(Why)와 시작점(Context)을 명시하여 나중에 이 파일을 보는 사람도 판단할 수 있도록 함.

---

## 열린 항목

### TODO-012: DESIGN.md 생성
**Priority**: P3
**What**: `:root` CSS 디자인 토큰을 별도 `DESIGN.md` 파일로 문서화. 색상·타이포·스페이싱 토큰 설명 + Do/Don't 사용 가이드 포함.
**Why**: 디자인 시스템 업데이트 시 일관성 체크 관점 부재. 제3자 콘트리뷰터가 결정 기준 없이 임의 값을 사용할 위험.
**Pros**:
- 토큰 의미(의도) 문서화 — `--color-primary-50`이 언제 쓰이고 언제 안 쓰이는지
- plan-design-review 다음 실행 시 시스템 정렬 체크 기준 확보
**Cons**:
- 유지보수 부담 (CSS 바꿀 때 DESIGN.md도 업데이트)
- 1인 프로젝트에서는 오버헤드
**Context**: /plan-design-review 2026-05-11 실행에서 발견. DESIGN.md 없어도 CSS 토큰이 source of truth로 기능하지만, 리뷰 품질과 신규 기여자 온보딩을 위해 중기적으로 필요.
**Blocked by**: 없음

---

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
**Blocked by**: 없음

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

### TODO-009: IP 헤더 일관성 — CF-Connecting-IP vs x-forwarded-for
**Priority**: P2
**What**: `api/generate.js`의 `getClientIp()`는 `x-real-ip` → `x-forwarded-for` 순으로 IP를 읽음. Vercel을 Cloudflare 프록시 뒤에 배포할 경우 Cloudflare가 `CF-Connecting-IP` 헤더를 추가하며, `x-forwarded-for`에는 Cloudflare 엣지 IP가 포함될 수 있음 → 모든 요청이 같은 IP로 집계되어 레이트 리밋이 작동하지 않는 구조적 위험.
**Why**: KRDS 서비스가 Cloudflare CDN 뒤에 배포될 가능성 있음. 현재 코드에서는 `CF-Connecting-IP`를 전혀 읽지 않음.
**Fix**: `getClientIp()` 에 `req.headers.get('cf-connecting-ip')` 최우선 검사 추가:
```javascript
// 우선순위: CF-Connecting-IP > x-real-ip > x-forwarded-for (last)
const cfIp = req.headers.get('cf-connecting-ip');
if (cfIp) return cfIp.trim();
```
**Depends on**: Cloudflare 배포 여부 확인 후 적용
**Blocked by**: 없음 (독립적으로 적용 가능)

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

### TODO-003: Skip-to-content 링크 추가
**Priority**: P2
**What**: lint.html · archive.html · generator/index.html 세 파일 모두에 페이지 상단 skip-to-content 링크(`<a href="#main-content" class="skip-link">본문으로 이동</a>`) 추가
**Why**: 키보드·스크린리더 사용자가 GNB/헤더를 반복 탐색하지 않고 바로 핵심 기능(텍스트 입력, 이슈 목록, 입력 폼)에 접근할 수 있어야 함. 공공기관 대상 도구이므로 WCAG 2.1 AA 2.4.1 준수가 실질적으로 요구됨.
**Pros**:
- WCAG 2.1 AA 2.4.1 "Bypass Blocks" 충족
- 보조기기 사용 담당자의 실제 접근성 개선
- 구현 비용 낮음 (CSS + 링크 1개)

**Cons**:
- 시각적으로 링크가 노출되지 않도록 focus-visible 스타일 주의 필요
- 3개 파일 각각 적용해야 함

**Context**: `/plan-design-review` Pass 6 (접근성) 에서 발견. 현재 세 파일 모두 skip 링크 없음.
**Depends on**: 없음
**Blocked by**: 없음

**구현 스펙 (2026-05-04 plan-design-review 확정)**:
- 삽입 위치: `<body>` 바로 다음 첫 번째 자식 (GNB 이전)
- 링크 타겟:
  - `lint.html` → `href="#main"` (id="main" 이미 존재)
  - `archive.html` → `href="#main-content"` (id="main-content" 추가 필요)
  - `generator/index.html` → `href="#main-content"` (id 추가 필요)
- CSS 스펙:
  ```css
  .skip-link {
    position: absolute;
    top: 8px; left: 8px;
    transform: translateY(-200%);
    padding: 12px 20px;
    background: #256ef4; color: #ffffff;
    font-size: 14px; font-weight: 600;
    border-radius: 6px;
    text-decoration: none;
    z-index: 9999;
    transition: transform 0.15s ease;
  }
  .skip-link:focus {
    transform: translateY(0);
    outline: 3px solid #ffffff;
    outline-offset: -3px;
  }
  @media (prefers-reduced-motion: reduce) {
    .skip-link { transition: none; }
  }
  ```

---

### TODO-004: Print 스타일시트 추가
**Priority**: P3
**What**: lint.html · archive.html · generator/index.html에 `@media print` 구기 추가 — GNB·토스트·공유버튼 숨김, 폰트 색상 흑백 강제, 페이지 여백 설정
**Why**: 공공기관 담당자가 린트 결과·이슈 목록·생성된 가이드라인을 출력해 결재 자료로 활용하는 실제 요구 있음. 기본 브라우저 출력 시 UI 크롬이 함께 인쇄되어 가독성 저하.
**Pros**:
- 오프라인 결재·공유 시나리오 지원
- 구현 비용 낮음 (CSS 30줄 내외)
- 기관 담당자 채택 장벽 추가 제거

**Cons**:
- 인쇄 레이아웃 QA 별도 필요
- 3개 파일 각각 적용

**Context**: `/plan-design-review` Pass 6 (접근성·인쇄) 에서 발견.
**Depends on**: 없음
**Blocked by**: 없음

**구현 스펙 (2026-05-04 plan-design-review 확정)**:
- 숨길 요소: `.gnb` (header), `.toast`, `[role="complementary"]`, `.share-btn`, `.footer`
- print 흑백 강제: `body { color: #000; background: #fff; }`
- 페이지 여백: `@page { margin: 2cm; }`
- 빈 결과 처리: 결과 카드가 모두 `display:none`이면 `<p class="empty-print-msg">결과가 없습니다. 텍스트를 입력하고 검사를 실행해 주세요.</p>` HTML 요소 추가 (기본값 `display:none`, `@media print`에서 `display:block`). ⚠️ CSS `content` 속성은 `::before`/`::after` 수도 요소에만 동작 — 일반 요소에 사용 불가.
- 페이지 나누기: `.card { page-break-inside: avoid; }`

---

### TODO-005: Tablet 브레이크포인트 추가 (768px–1023px)
**Priority**: P2
**What**: 현재 `<768px`(모바일)와 `≥1024px`(데스크톱) 사이에 768–1023px 브레이크포인트 누락. 세 파일 모두 태블릿에서 데스크톱 레이아웃이 압축되어 표시됨.
**Why**: 공공기관 담당자는 윈도우 노트북 + 태블릿 혼용 환경 빈번. lint.html의 2열 레이아웃(입력+결과)이 768px에서 깨지는 현상 보고됨.
**Pros**:
- 태블릿 사용 담당자 UX 직접 개선
- CSS 미디어 쿼리 추가만으로 해결 가능

**Cons**:
- 각 파일 레이아웃 구조 확인 후 적용 필요
- 자동화된 태블릿 QA 없으면 회귀 위험

**Context**: `/plan-design-review` Pass 6 (반응형) 에서 발견. 768px 디바이스에서 목측 확인 권장.
**Depends on**: 없음
**Blocked by**: 없음

**구현 스펙 (2026-05-04 plan-design-review 확정, D3 결정)**:
- `lint.html`: `@media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }` 추가. 기존 `@media (max-width: 680px)` 제거 (900px으로 대체). 1열 순서: 입력 패널 → 결과 패널.
- `archive.html`: `auto-fill, minmax(340px, 1fr)` 그리드가 768px에서 자연스럽게 동작 → 별도 태블릿 브레이크포인트 불필요.
- `generator/index.html`: 이미 `@media (max-width: 767px)` 존재 → 추가 불필요.

---

### TODO-006: prefers-reduced-motion 전체 적용
**Priority**: P2
**What**: lint.html의 점수 링 SVG 애니메이션, 필터 탭 전환 효과, 하이라이트 페이드; archive.html의 카드 확장; generator/index.html의 스피너·스트림 출력 — 모두 `@media (prefers-reduced-motion: reduce)` 쿼리 적용
**Why**: 전정기관 장애 등 모션 민감 사용자에게 현재 애니메이션이 불편을 줄 수 있음. 공공기관 도구이므로 WCAG 2.3.3 준수 필요.
**Pros**:
- 모션 민감 사용자 접근성 직접 개선
- WCAG 2.3.3 준수
- 패턴 단순 (`transition: none`, `animation: none`)

**Cons**:
- 모든 애니메이션 위치 파악 필요 (JS + CSS 양쪽)
- 3개 파일 전체 검토

**Context**: `/plan-design-review` Pass 6 (접근성) 에서 발견.
**Depends on**: 없음
**Blocked by**: 없음

**구현 스펙 (2026-05-04 plan-design-review 확정, D2 결정)**:
- 점수 링 SVG (lint.html): `@media (prefers-reduced-motion: reduce) { .score-ring circle { transition: none; animation: none; } }`. JS에서 애니메이션 클래스 없이 `stroke-dashoffset`을 최종값으로 직접 설정.
- 필터 탭·하이라이트 페이드 (lint.html): `transition: none` 적용
- 카드 확장 (archive.html): `transition: none` 적용
- 스피너 (generator): `animation: none` 적용. `@media (prefers-reduced-motion: reduce)` 이미 존재하므로 spinner 규칙만 추가.
- 스트림 출력 (generator): 토큰 도착 시 opacity 페이드 → 즉시 표시.

---

### TODO-007: CSS 토큰 네이밍 통일 (--krds-* 프리픽스)
**Priority**: P2
**What**: lint.html(`--color-*`), archive.html(베어 이름: `--accent`, `--text`, `--bg`), generator/index.html(혼합) 세 파일의 CSS 변수 이름을 design-system.md 카노니컬 `--krds-*` 프리픽스로 통일
**Why**: 도구 간 색상 토큰이 3가지 다른 컨벤션 사용 중. 향후 테마 변경·다크모드 확장·새 도구 추가 시 대규모 수작업 필요. 코드베이스 유지보수 비용 증가.
**Pros**:
- 단일 `:root` 정의로 3개 도구 일관성 보장
- 향후 새 도구 추가 시 토큰 재사용 즉시 가능
- design-system.md와 코드가 실제로 일치

**Cons**:
- 3개 파일 전체 CSS 변수 교체 → 회귀 위험 (테스트 필요)
- `--color-danger-50` 등 KRDS 공식 토큰과 이름 충돌 가능성 검토 필요

**Context**: `/plan-design-review` Pass 5 (디자인 시스템 정렬) 에서 발견. 해결 전까지 Pass 5 점수 6/10 유지.
**Depends on**: TODO-008 (danger 색상 통일) 선행 권장 — 완료됨 ✅
**Blocked by**: 없음

**구현 스펙 (2026-05-04 plan-design-review 추가)**:
- 토큰 매핑 (기존→카노니컬):
  - lint.html `--color-primary-50` → `--krds-color-primary`
  - lint.html `--color-danger-50` → `--krds-color-danger`
  - lint.html `--color-danger-10` → `--krds-color-danger-subtle`
  - lint.html `--color-surface` → `--krds-surface-default`
  - lint.html `--color-surface-sub` → `--krds-surface-subtle`
  - lint.html `--color-text` → `--krds-text-primary`
  - lint.html `--color-text-sub` → `--krds-text-secondary`
  - lint.html `--color-border` → `--krds-border-default`
  - archive.html `--accent` → `--krds-color-primary`
  - archive.html `--bg` → `--krds-surface-subtle`
  - archive.html `--bg-card` → `--krds-surface-default`
  - archive.html `--text` → `--krds-text-primary`
  - archive.html `--text-muted` → `--krds-text-tertiary`
  - archive.html `--border` → `--krds-border-default`
  - archive.html `--danger` → `--krds-color-danger`
  - generator `--color-bg` → `--krds-surface-subtle`
  - generator `--color-text-secondary` → `--krds-text-secondary`
- **focus ring 수정 (Pass 5 추가 발견)**:
  - lint.html textarea: `outline: none` 제거 → `outline: 2px solid var(--krds-border-focus); outline-offset: 2px` 추가 (box-shadow 병용 가능)
  - archive.html `.arc-search`: `outline: none` 제거 → `:focus-visible { outline: 2px solid var(--krds-border-focus); outline-offset: 2px; }` 추가
- 교체 방법: Python `re.sub` (sed는 변수명 충돌 위험) + `node --check` 로 JS 문법 검증. **⚠️ 모든 `re.sub` 패턴에 음수 전방탐색 `(?![-\w])` 필수** — 미적용 시 접두어 충돌 발생 (예: `--accent` 패턴이 `--accent-light`도 치환). 올바른 형식: `re.sub(r'--TOKEN-NAME(?![-\w])', '--NEW-NAME', content)`
- 교체 후 Playwright MCP로 3개 도구 시각 회귀 확인 필수

---

### TODO-001 UI 스펙 보완 (HWP/Word 다운로드 — 2026-05-04 plan-design-review, D4 결정)
**기존 TODO-001에 추가되는 UI 스펙**:
- 드롭다운 버튼 그룹 패턴:
  - 기존 `#download-btn` ("HTML 파일 다운로드") 오른쪽에 구분선 + 쐐기(▾) 토글 버튼 추가
  - 쐐기 버튼 클릭 시 드롭다운 열림: [HTML 파일 (.html)] / [한글 (.hwp)] / [Word (.docx)]
  - 드롭다운: `role="menu"`, `aria-label="다운로드 포맷 선택"`, 키보드 Arrow/Enter/Esc 지원
  - 포맷 없이 기존 버튼 클릭: HTML 직접 다운로드 (기존 동작 유지)
- 변환 중 상태: 기존 스피너 패턴 재사용, "변환 중..." 레이블
- 실패 상태: 기존 `#download-error` 영역 재사용, 포맷명 포함 에러 메시지 (예: "HWP 변환에 실패했습니다. HTML로 다운로드해 주세요.")

---

### UX-GEN-001: Generator cancel flow — 2단계 취소 UX
**Priority**: Low
**What**: "취소하기" 클릭 시 "취소되었습니다. 처음으로 돌아가려면 아래 버튼을 눌러주세요." 메시지 + "처음으로 돌아가기" 버튼이 표시됨. 한 번 더 클릭해야 폼으로 복귀.
**Why**: 단일 클릭으로 폼 복귀가 더 직관적. 현재 2단계는 불필요한 마찰.
**Fix**: 취소 시 "처음으로 돌아가기" 버튼 표시 없이 바로 초기 폼 상태로 복귀.
**Context**: QA 2026-05-06 발견.
**Depends on**: 없음
**Blocked by**: 없음

---

## 완료 항목

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

