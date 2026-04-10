# KRDS UX Writing Guide — Project Instructions

## 프로젝트 개요

- **서비스**: KRDS UX Writing 가이드 (공공기관 UX 라이팅 원칙 문서)
- **파일**: `index.html` (HTML + CSS, ~75KB) + `script.js` (JS 로직, 743줄) — 2026-04-07 분리
- **배포**: GitHub Pages → `git push origin main` 으로 자동 배포
- **URL**: https://thenisaid.github.io/krds-ux-writing/

---

## 파일 수정 규칙

### 대용량 파일 (100KB+) — heredoc 필수
```bash
# Write 툴 사용 금지 (content is missing 에러) → Bash heredoc 사용
cat > /Users/7457948/KRDS/index.html << 'HTMLEOF'
<!-- 내용 -->
HTMLEOF
```

### JS 수정 후 문법 검사 (필수)
JS SyntaxError 발생 시 전체 스크립트 실행 불가 → 화면 콘텐츠 미표시
```bash
# script.js 직접 검사 (2026-04-07 이후 분리됨)
node --check /Users/7457948/KRDS/script.js && echo "✅ JS 문법 OK"
```

### 흔한 JS 버그 패턴
- `const` 중복 선언 (같은 함수 스코프) → SyntaxError
- `getElementById('class-name')` → null (class는 querySelector 사용)
- IntersectionObserver 앵커 이동 후 `.visible` 미추가 → revealInAndAbove() 패턴 사용

---

## 로컬 테스트

```bash
# 서버 시작 (포트 8300)
lsof -ti:8300 | xargs kill -9 2>/dev/null; python3 -m http.server 8300 &
sleep 1
# → http://localhost:8300/index.html

# 서버 종료
lsof -ti:8300 | xargs kill -9 2>/dev/null
```

---

## 디자인 시스템 (KRDS 토큰)

### 핵심 색상 토큰
| 토큰 | 값 | 용도 |
|------|-----|------|
| `--color-primary-50` | `#256ef4` | Primary 기본 |
| `--color-primary-30` | `#86aff9` | Hero 강조 텍스트 (다크 배경) |
| `--color-success-50` | `#228738` | 성공/Do |
| `--color-danger-30` | `#f48771` | 위험/Don't |
| `--color-border-gray-light` | `#cdd1d5` | 카드 border |
| `--color-surface-inverse` | `#1e2124` | 푸터 배경 |

### 타이포그래피
- 폰트: `Pretendard GOV Variable` (공공기관 전용)
- line-height: **1.5** 고정 (KRDS 표준, WCAG 1.4.12)
- 최소 폰트: **13px** (WCAG 접근성 기준)

### 컴포넌트 스펙
| 컴포넌트 | border-radius | padding |
|---------|-------------|---------|
| 버튼 | 8px | 14px 28px |
| 카드 | 12px | 22px 26px ~ 28px 32px |
| 배지 | 4px | 4px 12px |

### CSS 아키텍처 (2026-04-07 Mintlify 리디자인)
- **배경**: `body { background: #f8f7f5 }` — 웜 오프화이트 (Mintlify 스타일)
- **GNB**: `rgba(248,247,245,.92)` + `backdrop-filter: blur(12px)`, height 60px, sticky
- **Hero**: `linear-gradient(160deg, #eef4ff 0%, #f8f7f5 55%)` 라이트 그라디언트
- **카드 depth**: border 기반 (`border: 1px solid var(--border)`) — shadow 최소화
- **CSS 교체 전략**: `:root` 변수 블록 보존, `/* ===== RESET & BASE ===== */` 마커 기준으로 Python `re.sub(DOTALL)` 교체
- **다크 모드**: `[data-theme="dark"]` 오버라이드 유지 (JS가 시스템 다크모드 자동 감지)

---

## 접근성 (WCAG 2.1)

- 체크리스트: `role="checkbox"`, `aria-checked`, `tabindex="0"`, Enter/Space 키 지원
- 모달: trapFocus/releaseFocus 패턴 (Tab 순환 가두기)
- 색상 대비: 4.5:1 이상 (텍스트), 3:1 이상 (UI 컴포넌트)
- 터치 타겟: 44×44px 이상
- reduced-motion: `@media (prefers-reduced-motion: reduce)` 적용

---

## gstack

웹 브라우징은 반드시 `/browse` 스킬을 사용. `mcp__claude-in-chrome__*` 툴 사용 금지.

스킬이 동작하지 않으면: `cd .claude/skills/gstack && ./setup`

| 스킬 | 역할 |
|------|------|
| `/office-hours` | 제품 전략 재정의 (YC 방식) |
| `/plan-ceo-review` | CEO 관점 플랜 검토 |
| `/plan-eng-review` | 엔지니어링 아키텍처 검토 |
| `/plan-design-review` | 디자인 품질 검토 |
| `/design-consultation` | 디자인 시스템 구축 |
| `/design-review` | 디자인 감사 + 수정 |
| `/review` | 코드 리뷰 (프로덕션 버그 검출) |
| `/investigate` | 루트 코즈 디버깅 |
| `/qa` | 실브라우저 QA + 버그 수정 |
| `/qa-only` | QA 리포트만 (수정 없음) |
| `/ship` | PR 생성 + 테스트 |
| `/land-and-deploy` | 머지 → 배포 → 카나리 검증 |
| `/canary` | 배포 후 모니터링 |
| `/benchmark` | 성능 회귀 감지 |
| `/browse` | 헤드리스 브라우저 |
| `/document-release` | 문서 자동 업데이트 |
| `/retro` | 주간 회고 분석 |
| `/cso` | 보안 감사 (OWASP + STRIDE) |
| `/autoplan` | CEO+Design+Eng 자동 리뷰 |
| `/careful` | 파괴적 명령어 경고 |
| `/freeze` | 편집 범위 제한 |
| `/guard` | 최대 안전 모드 |
| `/unfreeze` | freeze 해제 |
| `/gstack-upgrade` | gstack 업그레이드 |

---

## 참조 문서

| 파일 | 내용 |
|------|------|
| `ux-evaluation.md` | UX 평가 보고서 (16개 이슈, Phase 1-3 로드맵) |
| `ux-improvement-plan.md` | 타이포그래피·레이아웃 개선 계획 |
| `/tmp/krds_unification_report.md` | KRDS 디자인 통일화 분석 |
| `/tmp/krds_product_ux_review.md` | Product & UX/UI 종합 코드 리뷰 (P1~P3) |

---

## 현재 상태 (2026-04-07)

### 완료
- US-001~010 구현
- Phase 2 완료 (전체 이슈)
- P1 KRDS 통일화 (GNB sticky, Hero 색상 토큰, 다크모드 HC)
- P1 접근성 (체크리스트 ARIA, 포커스 트랩, reduced-motion, clipboard fallback)
- P1 폰트 (Pretendard GOV Variable CDN, line-height 1.5, 13px 미만 수정)
- P2 GNB 키보드 내비게이션 (ArrowDown/Up/Esc/Tab, ARIA menu role)
- P2 검색 미리보기 강화 (preview 텍스트, 키보드 내비게이션)
- P2 border-light 토큰화 (--color-border-gray-lightest)
- P3 CSS 중복 제거 (393줄 감소), 변수명 KRDS 전환
- H4-2: GNB 구조 개선, H6-1: Sticky TOC
- 크롬 확장 프로그램 v1.0.0 (`krds-extension/`, Manifest V3)
- SeMA 강연 자료 P1~P4 + index.html GitHub Pages 배포 완료 (https://thenisaid.github.io/sema-lecture/)
- **Mintlify 스타일 CSS 전체 리디자인** (127KB→106KB, 1,309삭제+734추가, 2026-04-07)
- **보안 감사 + CSP 강화** (2026-04-07, commit d20aad0)
  - CSP meta tag 추가 + `script-src 'unsafe-inline'` 완전 제거
  - `script.js` 분리 (743줄) — inline `<script>` 블록 외부화
  - `onclick` 73개 → `addEventListener` / 이벤트 위임 교체
  - Pretendard CDN SRI(`sha384-...`) + localStorage whitelist 추가
  - Chrome Extension: manifest CSP 명시, innerHTML→DOM API, 섹션 allowlist

### 남은 작업 (기존 site 유지보수)
- 없음 (모든 계획 항목 완료)

### CSP 준수 규칙 (2026-04-07 이후 필수)
- `onclick=` 인라인 핸들러 금지 → `addEventListener` 사용
- `innerHTML` 동적 콘텐츠 금지 → `createElement`/`textContent` 사용
- 새 인라인 `<script>` 추가 시 SHA256 해시 재계산 후 CSP 업데이트 필수:
```bash
python3 -c "
import hashlib, base64, re
c = open('/Users/7457948/KRDS/index.html').read()
s = re.findall(r'<script(?!\s+src)>([\s\S]*?)</script>', c)[0]
h = base64.b64encode(hashlib.sha256(s.encode()).digest()).decode()
print(f\"sha256-{h}\")
"
```

### 다음 단계 — 가이드라인 전체 재구성 (2026-04~)
- KRDS UX Writing 원칙 전면 재설계 (사용자 주도 / 어시스턴트는 구조화·문서화·슬라이드 변환 담당)
- 워크플로우: KRDS 원칙 설계 → SeMA(서울시립미술관) 파생 적용 → 슬라이드 제작
- index.html 전면 재작성 (SeMA 납품 완료 이후)
