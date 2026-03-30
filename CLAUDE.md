# KRDS UX Writing Guide — Project Instructions

## 프로젝트 개요

- **서비스**: KRDS UX Writing 가이드 (공공기관 UX 라이팅 원칙 문서)
- **파일**: `index.html` 단일 파일 (HTML + CSS + JS 통합, 100KB+)
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
node -e "
const fs = require('fs');
const html = fs.readFileSync('/Users/7457948/KRDS/index.html', 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (match) { new (require('vm').Script)(match[1]); console.log('✅ JS 문법 OK'); }
"
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

---

## 접근성 (WCAG 2.1)

- 체크리스트: `role="checkbox"`, `aria-checked`, `tabindex="0"`, Enter/Space 키 지원
- 모달: trapFocus/releaseFocus 패턴 (Tab 순환 가두기)
- 색상 대비: 4.5:1 이상 (텍스트), 3:1 이상 (UI 컴포넌트)
- 터치 타겟: 44×44px 이상
- reduced-motion: `@media (prefers-reduced-motion: reduce)` 적용

---

## 참조 문서

| 파일 | 내용 |
|------|------|
| `ux-evaluation.md` | UX 평가 보고서 (16개 이슈, Phase 1-3 로드맵) |
| `ux-improvement-plan.md` | 타이포그래피·레이아웃 개선 계획 |
| `/tmp/krds_unification_report.md` | KRDS 디자인 통일화 분석 |
| `/tmp/krds_product_ux_review.md` | Product & UX/UI 종합 코드 리뷰 (P1~P3) |

---

## 현재 상태 (2026-03-31)

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

### 남은 작업 (우선순위 순)
- **기능**: 크롬 확장 프로그램
