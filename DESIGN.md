# DESIGN.md — KRDS CSS 토큰 레퍼런스

> Source of truth: `index.html` `:root` 블록 (라인 33–81)
> 설계 철학·컴포넌트 상세: `design-system.md` | 이 파일: 라이브 토큰 빠른 참조

---

## 1. 색상 원시값 (Primitives)

### Primary (Blue)

| 토큰 | 값 | 용도 |
|------|----|------|
| `--color-primary-5` | `#ecf2fe` | 선택 상태 배경, accent-bg |
| `--color-primary-10` | `#d8e5fd` | 호버 배경, 태그 배경 |
| `--color-primary-30` | `#86aff9` | 다크모드 accent (Hero 강조 텍스트) — **dark only** |
| `--color-primary-50` | `#256ef4` | **기본 Primary** — CTA 버튼, 링크, 아이콘 |
| `--color-primary-60` | `#0b50d0` | Hover 상태 |
| `--color-primary-70` | `#083891` | Active/Pressed 상태 |

> ⚠️ `--color-primary-30`은 `:root`에 정의되지 않음 — `[data-theme="dark"]` accent 전용.
> 라이트모드 코드에서 직접 사용 금지.

### Gray

| 토큰 | 값 | 시각 |
|------|----|------|
| `--color-gray-0` | `#ffffff` | 흰색 |
| `--color-gray-5` | `#f4f5f6` | 거의 흰색 — subtle 배경 |
| `--color-gray-10` | `#e6e8ea` | 라이트 구분선 |
| `--color-gray-20` | `#cdd1d5` | 미드 구분선 |
| `--color-gray-40` | `#8a949e` | 아이콘, disabled 텍스트 |
| `--color-gray-50` | `#6d7882` | muted 텍스트 (흰배경 4.5:1 충족) |
| `--color-gray-60` | `#58616a` | secondary 텍스트 |
| `--color-gray-70` | `#464c53` | mid 텍스트 |
| `--color-gray-80` | `#33363d` | 다크모드 보더 |
| `--color-gray-90` | `#1e2124` | 기본 텍스트, 다크모드 배경 |
| `--color-gray-95` | `#131416` | 다크모드 subtle 배경 |

### Status (lint.html / archive.html fallback 참조)

| 토큰 | 값 | 대비비 | 용도 |
|------|----|--------|------|
| `--color-success-50` | `#228738` | 5.1:1 (흰배경) | 성공/Do |
| `--color-danger-30` | `#f48771` | — | Don't 아이콘 강조 (라이트 전용) |
| `--color-danger-50` | `#d9342b` | 4.8:1 (흰배경) | 위험/Don't 기본 |
| `--color-warning-50` | `#92580a` | 5.25:1 (#fdf3dc 배경) | 경고 텍스트 (WCAG AA) |

---

## 2. 시맨틱 토큰

### Surface

| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| `--bg` | `#ffffff` | `#131416` | 페이지 기본 배경 |
| `--bg-subtle` | `#f4f5f6` | `#1e2124` | 카드, 사이드바 배경 |
| `--bg-strong` | `#1e2124` | `#ffffff` | 인버스 배경 (푸터, 다크 섹션) |

### 텍스트

| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| `--text` | `#1e2124` | `#ffffff` | 본문 기본 텍스트 |
| `--text-mid` | `#464c53` | `#cdd1d5` | 서브 제목, 보조 정보 |
| `--text-secondary` | `#464c53` | (gray-30) | 보조 텍스트 |
| `--text-muted` | `#6d7882` | `#8a949e` | 힌트, 플레이스홀더, 날짜 |
| `--text-on-dark` | `#ffffff` | `#1e2124` | 인버스 배경 위 텍스트 |

### 보더

| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| `--border` | `#e6e8ea` | `#33363d` | 기본 구분선, 카드 테두리 |
| `--border-mid` | `#cdd1d5` | `#464c53` | 강조 구분선, 입력 필드 |

### Accent

| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| `--accent` | `#256ef4` | `#86aff9` | CTA, 링크, 포커스 링 |
| `--accent-dark` | `#083891` | — | Hover/Active (라이트 전용) |
| `--accent-bg` | `#ecf2fe` | `rgba(37,110,244,0.15)` | 선택 상태 배경 |

---

## 3. 타이포그래피

| 토큰 | 값 |
|------|----|
| `--font-sans` | `'Pretendard GOV Variable', 'Pretendard Variable', system-ui, -apple-system, sans-serif` |
| `--font-serif` | `'Noto Serif KR', Georgia, serif` |

**고정 규칙** (변경 금지):

| 규칙 | 값 | 기준 |
|------|----|------|
| 최소 `font-size` | `13px` | WCAG 가독성 |
| 본문 `line-height` | `≥ 1.5` | WCAG 1.4.12 |
| 폰트패밀리 | `Pretendard GOV Variable` | 공공기관 전용, 대체 불가 |

---

## 4. 레이아웃 · 스페이싱

| 토큰 | 값 | 용도 |
|------|----|------|
| `--container` | `1200px` | 최대 콘텐츠 너비 |
| `--gutter` | `clamp(20px, 4vw, 48px)` | 반응형 수평 패딩 |

---

## 5. 보더 반경

| 토큰 | 값 | 용도 |
|------|----|------|
| `--radius-sm` | `4px` | 배지, 소형 칩 |
| `--radius-md` | `8px` | 버튼, 입력 필드 |
| `--radius-lg` | `16px` | 카드, 모달 |

---

## 6. 컴포넌트 스펙

| 컴포넌트 | `border-radius` | `padding` |
|---------|----------------|-----------|
| 버튼 | `--radius-md` (8px) | `14px 28px` |
| 카드 | `--radius-lg` (16px) | `22px 26px` ~ `28px 32px` |
| 배지 | `--radius-sm` (4px) | `4px 12px` |

---

## 7. 사용 규칙

### ✅ Do

- 시맨틱 토큰 사용: `var(--text)`, `var(--bg)`, `var(--accent)`
- 다크모드는 자동 전환 — `[data-theme="dark"]` 오버라이드가 CSS 변수를 재정의함
- 새 색상 추가: `:root` 원시값 먼저 등록 → 시맨틱 토큰으로 래핑 후 사용

### ❌ Don't

| 잘못된 코드 | 올바른 코드 |
|------------|-----------|
| `color: #1e2124` | `color: var(--text)` |
| `background: #f4f5f6` | `background: var(--bg-subtle)` |
| `border: 1px solid #e6e8ea` | `border: 1px solid var(--border)` |
| `var(--color-primary-30)` (라이트모드) | `var(--accent)` 사용 |
| `font-size: 12px` | `font-size: 13px` 이상 |
| `line-height: 1.4` | `line-height: 1.5` 이상 |

---

## 8. 접근성 대비비 빠른 참조

| 색상 쌍 | 대비비 | 등급 |
|---------|--------|------|
| `--text` (#1e2124) on `--bg` (#fff) | 17.1:1 | AAA |
| `--text-mid` (#464c53) on `--bg` (#fff) | 9.7:1 | AAA |
| `--text-muted` (#6d7882) on `--bg` (#fff) | 4.6:1 | AA |
| `--accent` (#256ef4) on `--bg` (#fff) | 4.5:1 | AA (경계) |
| `--color-warning-50` (#92580a) on #fdf3dc | 5.25:1 | AA |
| `--color-danger-50` (#d9342b) on `--bg` (#fff) | 4.8:1 | AA |

> 포커스 링: `outline: 2px solid var(--accent); outline-offset: 2px` — `:focus-visible`에만 적용
