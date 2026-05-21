# DESIGN.md — KRDS UX Writing Guide 디자인 시스템

> **Source of truth**: 각 HTML 파일의 `:root` 블록 + `[data-theme="dark"]` 오버라이드
> **적용 범위**: `index.html` · `before-after.html` · `lint.html` · `archive.html`
> **마지막 전면 업데이트**: 2026-05-21 (`/design-consultation` — 전면 재작성)

---

## 파일별 토큰 체계 현황

| 파일 | 토큰 네이밍 | GNB 높이 | 특이 사항 |
|------|------------|----------|-----------|
| `index.html` | `--bg`, `--text`, `--accent` (시맨틱) | 56px | 가장 오래된 기반 |
| `before-after.html` | `--bg`, `--text`, `--accent` (시맨틱) | 60px | 2026-05-21 /design-review 완료, WCAG 최신 준수 |
| `lint.html` | `--krds-surface-default`, `--krds-text-primary` (KRDS 접두사) | — | shadow-card 토큰 |
| `archive.html` | `--krds-surface-default`, `--krds-color-primary` (KRDS 접두사) | — | 다크모드에서 success/danger 값 다름 |

> **Phase 2 TODO**: 전체 파일 시맨틱 토큰 `--bg`/`--text`/`--accent` 체계로 통일 예정.
> 현재는 각 파일이 자체 `:root`를 보유하며, 이 문서가 공통 진실의 기준점.

---

## 1. 색상 원시값 (Primitives)

모든 파일의 `:root`에서 공유하는 원시 팔레트. 시맨틱 토큰은 이 값만 참조해야 함.

### Primary (Blue)

| 토큰 | 값 | 메모 |
|------|----|------|
| `--color-primary-5` | `#ecf2fe` | 선택 배경, accent-bg (라이트) |
| `--color-primary-10` | `#d8e5fd` | 호버 배경, 태그 배경 |
| `--color-primary-30` | `#86aff9` | 다크모드 accent 전용 — 라이트에서 사용 금지 |
| `--color-primary-50` | `#256ef4` | **기본 Primary** — CTA, 링크, 포커스 링 |
| `--color-primary-60` | `#0b50d0` | Hover / 다크모드 Primary (lint-btn.primary 배경) |
| `--color-primary-70` | `#083891` | Active/Pressed |

> **before-after.html**: `--color-primary-30`이 `:root`에 정의됨 (다른 파일은 없음).
> **index.html**: `--color-primary-30` 없음, 다크모드에서 `--accent`가 `#86aff9` 하드코딩.

### Gray

| 토큰 | 값 | 메모 |
|------|----|------|
| `--color-gray-0` | `#ffffff` | 흰색 |
| `--color-gray-5` | `#f4f5f6` | 거의 흰색 — subtle 배경 |
| `--color-gray-10` | `#e6e8ea` | 라이트 구분선 |
| `--color-gray-20` | `#cdd1d5` | 미드 구분선, 다크모드 border-mid 값 |
| `--color-gray-40` | `#8a949e` | 아이콘, 다크모드 muted 텍스트 |
| `--color-gray-50` | `#6d7882` | muted 텍스트 (흰 배경 4.5:1) |
| `--color-gray-60` | `#58616a` | secondary 텍스트 |
| `--color-gray-70` | `#464c53` | mid 텍스트 (흰 배경 8.7:1 AAA) |
| `--color-gray-80` | `#33363d` | 다크모드 border |
| `--color-gray-90` | `#1e2124` | 기본 텍스트 / 다크모드 bg-subtle |
| `--color-gray-95` | `#131416` | 다크모드 페이지 배경 |

### Status

| 토큰 | 값 | 대비비 | 용도 |
|------|----|--------|------|
| `--color-success-50` | `#228738` | 5.1:1 (흰) | 성공/Do 텍스트·아이콘 |
| `--color-danger-50` | `#d9342b` | 4.7:1 (흰) | 위험/Don't |
| `--color-danger-30` | `#f48771` | — | Don't 아이콘 강조 (라이트 전용) |
| `--color-warning-50` | `#92580a` | 5.3:1 (#fdf3dc) | 경고 텍스트 (WCAG AA) |
| `--color-warning-10` | `#fdf3dc` | — | 경고 배경 (lint.html) |
| `--color-warning-dark` | `#d08000` | 5.26:1 (#2a1e06) | 다크모드 경고 텍스트 |

---

## 2. 시맨틱 토큰

### Surface

| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| `--bg` | `#ffffff` | `#131416` | 페이지 기본 배경 |
| `--bg-subtle` | `#f4f5f6` | `#1e2124` | 카드, 사이드바, hover 배경 |
| `--bg-strong` | `#1e2124` | `#ffffff` | 인버스 배경 (푸터, 다크 섹션) |

### 텍스트

| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| `--text` | `#1e2124` | `#ffffff` | 본문 기본 텍스트 |
| `--text-mid` | `#464c53` | `#cdd1d5` | 서브 제목, 보조 정보 |
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
| `--accent-dark` | `#083891` | — | Hover/Active (라이트 전용, index.html) |
| `--accent-bg` | `#ecf2fe` | `rgba(37,110,244,0.15)` | 선택 상태 배경 |

### `color-scheme` (before-after.html 적용, 나머지 TODO)

```css
:root { color-scheme: light; }
[data-theme="dark"] { color-scheme: dark; }
```

시스템 UI(스크롤바·체크박스·셀렉트 등)가 다크모드와 일치하게 렌더링됨.

---

## 3. KRDS 접두사 토큰 (lint.html, archive.html)

이 두 파일은 별도의 KRDS 공식 접두사 체계를 사용함.

| 토큰 | 라이트 값 | 다크 값 | 시맨틱 상당 |
|------|-----------|---------|------------|
| `--krds-color-primary` | `#256ef4` | `#86aff9` | `--accent` |
| `--krds-surface-default` | `#ffffff` / `#161b22` (archive) | `#1e2124` | `--bg` |
| `--krds-surface-subtle` | `#f8f7f5` | `#0d1117` (archive) / `#262b30` (lint) | `--bg-subtle` |
| `--krds-border-default` | `#e4e2df` (lint) / `#cdd1d5` (archive) | `#333a42` / `#30363d` | `--border` |
| `--krds-text-primary` | `#1e2124` / `#0d1117` (archive) | `#f0f2f5` | `--text` |
| `--krds-text-secondary` | `#5a6270` (lint) / `#6a737d` (archive) | `#9ea8b3` | `--text-muted` |

---

## 4. 타이포그래피

### 폰트

| 토큰 | 값 |
|------|----|
| `--font-sans` | `'Pretendard GOV Variable', 'Pretendard Variable', system-ui, -apple-system, sans-serif` |
| `--font-serif` | `'Noto Serif KR', Georgia, serif` (index.html 전용) |

**고정 규칙 (변경 금지)**:

| 규칙 | 값 | 근거 |
|------|----|------|
| 최소 `font-size` | **13px** | WCAG 가독성, KRDS 기준 |
| 본문 `line-height` | **≥ 1.5** | WCAG 1.4.12 |
| 폰트패밀리 | `Pretendard GOV Variable` | 공공기관 전용, 대체 불가 |

### 예외 (기능적 텍스트 아님 — KRDS 13px 규칙 적용 제외)

| 요소 | 크기 | 파일 | 사유 |
|------|------|------|------|
| `.gnb-badge` | 11px | before-after.html, index.html | 장식 배지 (텍스트 레이블 아님) |
| `.ba-label` chip A/B/C | 11px | before-after.html | 아이콘 대체 칩, 장식 |
| 로고마크 "K" | 10px | 전 파일 | 장식 기호 |

### 헤딩 타입스케일 (before-after.html 기준, 가장 정돈된 버전)

| 계층 | 크기 | 용도 |
|------|------|------|
| `h1` / `.page-hero-title` | 28–32px | 페이지 타이틀 |
| `h2` / `.panel-intro-title` | 18–20px | 섹션 헤딩 |
| `h3` / `.pair-context` | 13px | 카드 내 상황 레이블 |
| body | 16px | 기본 본문 |
| `.ba-text` | 16px | Before/After 텍스트 비교 |
| 소형 레이블 (eyebrow, hint 등) | 13px | 최소 허용 |

**`text-wrap: balance`** — 헤딩류에 적용하여 줄바꿈 최적화:
```css
.page-hero-title, .panel-intro-title { text-wrap: balance; }
```

---

## 5. 레이아웃 · 스페이싱

| 토큰 | 값 | 용도 |
|------|----|------|
| `--container` | `1200px` | 최대 콘텐츠 너비 |
| `--gutter` | `clamp(20px, 4vw, 48px)` | 반응형 수평 패딩 |

---

## 6. 보더 반경

| 토큰 | 값 | 용도 |
|------|----|------|
| `--radius-sm` | `4px` | 배지, 칩, 네비 링크 hover (before-after) |
| `--radius-md` | `8px` | 버튼, 입력 필드, before-after 카드 |
| `--radius-lg` | `16px` | 카드 (before-after panel), 모달 |

> lint.html / archive.html: `--radius-card: 12px` 별도 토큰 사용 (시맨틱 토큰 전환 전 레거시).

---

## 7. 컴포넌트 스펙

### GNB (Global Navigation Bar)

두 파일이 약간 다른 스펙을 가짐:

| 속성 | index.html | before-after.html (기준) |
|------|-----------|--------------------------|
| 높이 | 56px | **60px** |
| 배경 (라이트) | `var(--bg)` (불투명) | `rgba(248,247,245,.92)` + `backdrop-filter:blur(12px)` |
| 배경 (다크) | `rgba(19,20,22,.92)` | `rgba(19,20,22,.92)` |
| 위치 | `sticky; top:0; z-index:100` | 동일 |

**GNB 서브컴포넌트 스펙 (before-after.html 기준)**:

| 요소 | 스펙 |
|------|------|
| `.gnb-logo-mark` | 28×28px, `border-radius:6px`, background: `var(--accent)` |
| `.gnb-nav-link` | height:60px (터치44px+), padding:0 12px, font-size:14px |
| `.gnb-icon-btn` | 44×44px (WCAG 2.5.5 AAA), border-radius:var(--radius-sm) |
| `.gnb-badge` | font-size:11px, padding:3px 8px, border-radius:100px |

> **index.html 미적용 항목**: `.gnb-icon-btn`이 `padding:6px`만 있어 터치 타겟 <44px.
> Phase 2 통일 시 before-after.html 스펙으로 맞출 것.

### 버튼

**index.html `.btn` 체계**:

| 속성 | 값 |
|------|----|
| `padding` | `12px 20px` |
| `border-radius` | `var(--radius-sm)` (4px) |
| `font-size` | `14px` |
| `font-weight` | `600` |
| `line-height` | `1` |

**before-after.html `.lint-btn` 체계**:

| 변형 | 속성 |
|------|------|
| 기본 | border: 1px solid var(--border-mid), background: transparent |
| `.primary` (라이트) | background: `var(--accent)` (#256ef4), color: #fff |
| `.primary` (다크) | background: `var(--color-primary-60)` (#0b50d0, 6.8:1 AAA) |
| `.primary:hover` (라이트) | background: `var(--color-primary-60)` |
| `.primary:hover` (다크) | background: `var(--color-primary-70)` |

**다크모드 Primary 버튼 대비비**:
- 라이트: #256ef4 on #fff = **4.6:1 (AA)**
- 다크: #0b50d0 on #131416 = 2.7:1 → 오버라이드로 해결 (위 `.lint-btn.primary` 다크 스펙)

**`.seminar-btn`** (아웃라인 버튼, before-after.html):
- padding: 13px 20px → 총 높이 ≈ 44.5px (WCAG 2.5.5 충족)
- border: 1px solid var(--border-mid), border-radius: var(--radius-md)

### Before/After 카드 (before-after.html 전용)

```css
.ba-card {
  border-radius: var(--radius-md);   /* 8px */
  padding: 16px;
  border: 1.5px solid;
}
.ba-card.before { background:#fff5f5; border-color:#d9342b; }
.ba-card.after  { background:#f0fff4; border-color:#228738; }

/* 다크모드 */
[data-theme="dark"] .ba-card.before { background:rgba(217,52,43,.12); }
[data-theme="dark"] .ba-card.after  { background:rgba(34,135,56,.12); }
```

### 카드 (index.html)

| 속성 | 값 |
|------|----|
| `border-radius` | `var(--radius-lg)` (16px) |
| `padding` | `22px 26px` ~ `28px 32px` |
| `border` | `1px solid var(--border)` |

### 배지

| 속성 | 값 |
|------|----|
| `border-radius` | `var(--radius-sm)` (4px) |
| `padding` | `4px 12px` |
| `font-size` | `13px` (최소 기준) |

---

## 8. 접근성 대비비 빠른 참조

| 색상 쌍 | 대비비 | 등급 | 적용 |
|---------|--------|------|------|
| `--text` (#1e2124) on `--bg` (#fff) | 16.2:1 | AAA | 본문 |
| `--text-mid` (#464c53) on `--bg` (#fff) | 8.7:1 | AAA | 서브 제목 |
| `--text-muted` (#6d7882) on `--bg` (#fff) | 4.5:1 | AA | 힌트, 날짜 |
| `--accent` (#256ef4) on `--bg` (#fff) | 4.6:1 | AA | CTA 버튼 텍스트 |
| `--color-primary-60` (#0b50d0) on `--bg` (#fff) | 6.8:1 | AA | 버튼 hover |
| `--color-primary-30` (#86aff9) on dark (#131416) | 8.4:1 | AAA | 다크 accent |
| `--color-warning-50` (#92580a) on #fdf3dc | 5.3:1 | AA | 경고 텍스트 |
| `--color-warning-dark` (#d08000) on #2a1e06 | 5.26:1 | AA | 다크 경고 |
| `--color-danger-50` (#d9342b) on `--bg` (#fff) | 4.7:1 | AA | 위험 |
| `--color-success-50` (#228738) on `--bg` (#fff) | 5.1:1 | AA | 성공 |

**포커스 링** (전 파일 공통):
```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

**터치 타겟** (WCAG 2.5.5):
- 최소 44×44px
- `.gnb-icon-btn`: before-after.html 44×44px ✅ / index.html 미준수 ⚠️
- `.gnb-nav-link`: before-after.html height:60px ✅

---

## 9. 그림자

lint.html 전용:
```css
--shadow-card: 0 1px 4px rgba(0,0,0,.06), 0 0 0 1px var(--krds-border-default);
/* 다크모드 */
--shadow-card: 0 1px 4px rgba(0,0,0,.3),  0 0 0 1px var(--krds-border-default);
```

index.html / before-after.html: shadow 최소화, border 기반 depth.

---

## 10. 사용 규칙

### ✅ Do

- 시맨틱 토큰 사용: `var(--text)`, `var(--bg)`, `var(--accent)`, `var(--border)`
- 다크모드는 `[data-theme="dark"]`가 CSS 변수를 재정의 — JS로 attribute 설정만
- 새 색상: `:root` 원시값 등록 → 시맨틱 토큰 래핑 → 사용
- 다크모드 Primary 버튼: `--color-primary-60` 사용 (대비비 확보)
- 버튼/링크 최소 터치 타겟 44×44px 준수
- 기능 텍스트 최소 13px 유지
- 헤딩에 `text-wrap: balance` 적용

### ❌ Don't

| 잘못된 코드 | 올바른 코드 |
|------------|-----------|
| `color: #1e2124` | `color: var(--text)` |
| `background: #f4f5f6` | `background: var(--bg-subtle)` |
| `border: 1px solid #e6e8ea` | `border: 1px solid var(--border)` |
| `var(--color-primary-30)` 라이트에서 | `var(--accent)` 사용 |
| `font-size: 12px` 기능 텍스트에 | `font-size: 13px` 이상 |
| `line-height: 1.4` | `line-height: 1.5` 이상 |
| 다크 버튼에 `var(--accent)` (#256ef4) | `var(--color-primary-60)` (#0b50d0) |
| `onclick=` 인라인 핸들러 | `addEventListener` + CSP 준수 |

---

## 11. 다크모드 패턴 요약

```css
/* ─── 라이트 기본 (모든 파일) ─── */
:root {
  color-scheme: light;      /* before-after.html 적용, 나머지 TODO */
  --bg: var(--color-gray-0);
  --accent: var(--color-primary-50);
  /* ... */
}

/* ─── 다크 오버라이드 ─── */
[data-theme="dark"] {
  color-scheme: dark;
  --bg: var(--color-gray-95);
  --accent: var(--color-primary-30);   /* #86aff9 — 다크에서 더 밝음 */
  /* 버튼 전용 오버라이드 */
}

/* ─── 다크모드 Primary 버튼 패턴 ─── */
[data-theme="dark"] .lint-btn.primary {
  background: var(--color-primary-60);   /* #0b50d0, 6.8:1 on #131416 → 실제 2.7:1 */
  border-color: var(--color-primary-60);
}
```

> **주의**: `--color-primary-60` (#0b50d0)은 다크 배경 (#131416)에서 대비비 2.7:1로 단독으로는 부족.
> 실제 lint-btn.primary 다크 스타일은 흰색 텍스트(#fff)와 조합하여 읽히므로 **흰 텍스트 기준 6.8:1 AA 통과**.
> `color: #fff` 반드시 유지.

---

## 12. 미해결 불일치 (Phase 2 TODO)

| 항목 | 현재 상태 | 목표 |
|------|-----------|------|
| GNB 높이 | index.html 56px / before-after.html 60px | 60px 통일 |
| GNB 아이콘 버튼 터치 타겟 | index.html `padding:6px` (미준수) | 44×44px |
| 토큰 접두사 | `--bg/--text` vs `--krds-*` 혼용 | `--bg/--text` 체계 통일 |
| `color-scheme` 선언 | before-after.html만 적용 | 전 파일 적용 |
| `text-wrap: balance` | before-after.html 헤딩만 | 전 파일 헤딩 |
| Warning 다크모드 | lint.html만 `#d08000` | 전 파일 적용 |
