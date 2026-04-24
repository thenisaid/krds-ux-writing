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

## 완료 항목

<!-- 완료 시 날짜와 커밋 해시 기록 -->

