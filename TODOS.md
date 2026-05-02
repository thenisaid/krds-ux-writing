# TODOS

공개 백로그 — 현재 스코프에서 의도적으로 제외한 항목들.
각 항목에는 동기(Why)와 시작점(Context)을 명시하여 나중에 이 파일을 보는 사람도 판단할 수 있도록 함.

---

## 열린 항목

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
**Depends on**: TODO-008 (danger 색상 통일) 선행 권장
**Blocked by**: 없음

---

---

## 완료 항목

<!-- 완료 시 날짜와 커밋 해시 기록 -->

### ✅ TODO-008: Danger 색상 통일 (#d9342b)
**완료**: 2026-05-02
**What**: lint.html `#d43a2f`, archive.html `#c7371a` → `#d9342b`로 통일 (sed 치환)
**Result**: 3개 파일(lint.html, archive.html, design-system.md) 모두 `#d9342b` 동일

