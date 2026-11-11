# DESIGN.md — KRDS UX Writing Guide 디자인 시스템

> **Source of truth**: 각 HTML 파일의 `:root` 블록 + `[data-theme="dark"]` 오버라이드. 이 문서는 그 값을 정리한 기준점이며, 코드와 다르면 코드가 먼저다(단, 아래 §13 '코드 수정 필요' 항목은 문서가 정답).
> **적용 범위**: `index.html` · `before-after.html` · `lint.html` · `archive.html` (토큰 정본 4개) + 로고 시스템(§9, 현재 `index.html`만 적용) + 확장 프로그램·오프라인 앱(§12)
> **마지막 갱신**: 2026-11-10 (코드 대조 감사 — 로고 시스템 신설, 드리프트 정정)
> **직전 전면 업데이트**: 2026-05-21 (`/design-consultation`)

### 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-11-10 | 코드 대조 감사. §9 로고 시스템 신설(태극 마크·UXW 워드마크·`--logo-blue/red`). §3·§7·§8·§12 드리프트 정정: `--radius-*` 값(index 12/20px), 버튼 pill, GNB 높이 60px 통일, 대비율 재계산(4.5:1 경계값 소수 둘째 자리 표기), 다크 `--accent` 위 흰 텍스트 위반 기록. §13 '코드 수정 필요' 목록 신설 |
| 2026-05-26 | 터치 타겟 ⚠️ 표기 오류 수정 (`3619697`) |
| 2026-05-21 | 전면 재작성 — 4개 파일 시맨틱 토큰 통일(Phase 2 완료) |

---

## 0. 이번 감사의 드리프트 요약

문서(2026-05-21 기준)와 코드(2026-11-10 `5bb7cac`)를 대조한 결과. **수정 방향** 열이 "문서"이면 이 문서를 고쳤고, "코드"이면 §13 목록으로만 보고하고 손대지 않았다.

| # | 항목 | 이전 문서 | 실제 코드 | 수정 방향 |
|---|------|-----------|-----------|-----------|
| 1 | GNB 로고 마크 | `28×28`, `border-radius:6px`, `var(--accent)` 배경 'K' | `index.html`은 태극 SVG(28×28) + `UXW` 워드마크. 나머지 페이지는 여전히 'K' 사각 마크 | 문서 (§9 신설, 적용 현황 표) |
| 2 | 로고 토큰 | 없음 | `--logo-blue` `#003964`/`#8cb6ff`, `--logo-red` `#ed1a3b`/`#ff9bad` (`index.html`만) | 문서 |
| 3 | favicon | 언급 없음 | `index.html`만 태극 data URI. 나머지는 'K' 파랑 원. `lint.html`·`ontology-query.html`·`term-graph.html`·`offline-app`은 favicon 없음. 루트 `favicon.svg`(K 사각)는 어디서도 참조되지 않음 | 문서(현황) + 코드(§13) |
| 4 | `--radius-md/lg` (index.html) | 8px / 16px | **12px / 20px**, 추가로 `--radius-pill: 9999px`. `before-after.html`만 8/16 유지 | 문서 |
| 5 | 버튼 radius (index.html) | `var(--radius-sm)` 4px, padding `12px 20px` | **pill 9999px**, padding `13px 24px`, `min-height:44px` (`31ef00a`, 2026-06-24 Mintlify 리디자인) | 문서 |
| 6 | 카드 radius (index.html) | 16px | `--radius-md` = **12px** (`.quote-card`, `.ba-card`, `.dg-checklist`) | 문서 |
| 7 | GNB 높이 | 파일별 표는 index 56px, 미해결 표(§12)는 '60px 통일 완료'로 기재 — 문서 내부 모순 | index·before-after·lint·archive·dictionary·generator·case-studies **60px**, corpus **62px**, `shared/style.css` 사용 페이지(principles/*, prompt-library) **56px** | 문서 (페이지별 현황 표) |
| 8 | GNB 배경 (index.html) | `var(--bg)` 불투명 | 동일(불투명). before-after·lint·archive는 `rgba(248,247,245,.92)`+blur | 일치 (현황 표 정정) |
| 9 | `.gnb-nav-link` | `height:60px; padding:0 12px; font-size:14px` (before-after 기준 열) | before-after 는 문서와 일치(14px). index 는 `13px` 이므로 파일별 값을 §6 GNB 표에 분리 표기 | 문서 (표기 보강, 실질 드리프트 아님) |
| 10 | `.gnb-badge` | `11px` (index·before-after) | index `11px`, before-after `11px`, **`shared/style.css` 10px** | 문서 + 코드(§13) |
| 11 | 대비율: `--text` on `#fff` | 16.2:1 | **16.18:1** | 문서 (소수 둘째 자리) |
| 12 | 대비율: `--accent` on `#fff` | 4.6:1 | **4.55:1** (warm `#f8f7f5` 위 **4.25:1 — AA 미달**) | 문서 + 코드(§13) |
| 13 | 대비율: `--text-muted` on `#fff` | 4.5:1 | **4.51:1** (`#f4f5f6` 위 4.13:1, warm 위 4.21:1 — AA 미달) | 문서 + 코드(§13) |
| 14 | 대비율: `--color-success-50` on `#fff` | 5.1:1 | **4.57:1** (이전 값 오기) | 문서 |
| 15 | 대비율: `--color-danger-50` on `#fff` | 4.7:1 | **4.69:1** | 문서 |
| 16 | 대비율: `--color-primary-60` on `#fff` | 6.8:1 | **6.83:1** | 문서 |
| 17 | 다크 `--accent`(`#86aff9`) 위 흰 텍스트 | §11이 '다크 버튼은 `--color-primary-60` 사용'이라 규정 | `index.html` 다크: `.btn-primary`·`.skip-nav`·필터 칩·배지가 **흰 글자 on `#86aff9` = 2.21:1** | 코드 (§13) |
| 18 | 다크 Primary 버튼 대비 서술 | `#0b50d0` 를 '#131416 위 6.8:1' 로 적은 곳과 '2.7:1' 로 적은 곳이 혼재(글자-배경 쌍과 버튼-페이지 쌍을 혼동) | 정확한 값: 흰 글자 on `#0b50d0` = 6.83:1(통과). 버튼 **배경** `#0b50d0` vs 페이지 `#131416` = 2.70:1(WCAG 1.4.11 UI 3:1 미달, 단 텍스트가 있어 통상 허용) | 문서 |
| 19 | `color-scheme` | 'before-after 적용, 나머지 TODO' (index 는 2026-05-21 추가 완료로 기재) | 선언된 파일은 **index·before-after·generator 3개뿐**(`grep -E '(^\|[^-])color-scheme *:'`). lint·archive·corpus·dictionary/*·case-studies·prompt-library·shared/style.css(principles/*)·ontology-query·term-graph·offline-app·확장은 **미선언** — 다크에서 스크롤바·폼 컨트롤이 라이트로 렌더 | 문서 + 코드(§13-11) |
| 20 | 최소 13px 규칙 현황 | '2026-05-21 4개 파일 전수 통일 완료' | 정본 4파일에도 `index.html` 5곳·`before-after.html` 3곳·`lint.html` 3곳·`archive.html` 2곳(`.8rem`=12.8px) 잔존. 레포 전체 건수는 재집계 필요(슬라이드·목업 포함 시 400건대) | 문서(정정) + 코드(§13) |
| 21 | `.gnb-icon-btn` 44px | index·before-after 44×44 | 일치. `shared/style.css` 의 `.gnb-icon-btn`은 `padding:6px`(실측 28×28) | 문서 + 코드(§13) |
| 22 | 경고 색 `--color-warning-dark` | `#d08000` 토큰 | 코드에 `--color-warning-dark` 토큰은 **없음**. 실제로는 `--color-warning-50` 을 다크에서 `#d08000` 으로 **재정의** (before-after·lint) | 문서 |
| 23 | 폰트 로딩 | 'Pretendard GOV Variable' 단일 | `index/before-after/corpus/prompt-library/principles` = variable-gov CDN(`document.fonts` 에 `Pretendard GOV Variable` loaded 확인). `generator` = static `pretendard-gov.min.css` → `document.fonts` 에는 `Pretendard GOV`(공백 포함) 9개 face 가 등록되지만, body 스택은 `PretendardGOV`(공백 없음) → `Pretendard GOV Variable` → `Pretendard Variable` → `Pretendard` 순이라 **등록된 패밀리명 `Pretendard GOV` 가 스택에 없어** 측정 시점 loaded 0건(시스템 폴백). **`lint.html`은 `<link rel="preconnect">` 만 있고 폰트 스타일시트 링크가 없어 `document.fonts` 가 비어 있음(0 faces) → 시스템 폴백**. `offline-app` = 시스템 폰트 스택(의도) | 문서(현황) + 코드(§13-12) |
| 24 | 확장 프로그램 | 설명 없음 | `krds-extension/` 자체 토큰(§12). 아이콘은 `#256ef4` 바탕 흰 'K' PNG — 태극 로고 미적용 | 문서 |
| 25 | `--krds-*` 접두사 | §3에 마이그레이션 표 | `lint.html`·`archive.html`에는 `--krds-color-danger` 만 잔존. `dictionary/*`·`generator/*`·`case-studies`는 아직 자체 토큰 체계(`--color-primary` 등) | 문서 |
| 26 | `--shadow-card` | lint.html 전용 | 일치 | 일치 |
| 27 | `--bg-strong` | 정의 | 정의만 있고 사용처 0건 (index·before-after 모두) | 문서(주석) |

---

## 파일별 토큰 체계 현황

| 파일 | 토큰 네이밍 | GNB 높이 | 반경 토큰 | 특이 사항 |
|------|------------|----------|-----------|-----------|
| `index.html` | `--bg`, `--text`, `--accent` (시맨틱) | 60px | `--radius-sm/md/lg/pill` = 4/12/20/9999 | 태극 로고 적용. Noto Serif KR(히어로 제목) 병용 |
| `before-after.html` | 동일 | 60px (blur) | `--radius-sm/md/lg` = 4/8/16 | 'K' 마크. Warning 다크 재정의 |
| `lint.html` | 동일 + `--radius-card/btn/badge` 12/8/4 | 60px (blur) | 별도 | `--shadow-card`, `--krds-color-danger`, **다크 `--accent` 미재정의** (§13) |
| `archive.html` | `--bg`, `--text`, `--accent`, `--radius`=12 | 60px (blur) | 단일 `--radius` | `--krds-color-danger`, 다크 팔레트가 GitHub 계열(`#161b22`/`#0d1117`) |
| `shared/style.css` (principles/*, prompt-library) | 시맨틱 | **56px** (`--gnb-h`) | 하드코딩 | 다크 accent `#6699ff` |
| `dictionary/*`, `case-studies`, `generator` | `--color-primary`, `--color-bg` 등 **자체 체계** | 60px | 하드코딩 | 시맨틱 토큰 미전환 |
| `corpus/index.html` | `--accent`, `--surface`, `--radius:18px` | 62px | 단일 | 별도 웜 팔레트 `#f7f5f1` |
| `term-graph.html` | 하드코딩 | — | — | 항상 다크(`#0d1117`) 단일 테마 |

> 모든 파일이 자체 `:root`를 가지며 색상값은 파일별로 다르다. 이 문서는 **정본 4파일**의 공통 기준이다. `data-theme` 속성은 `localStorage['krds-theme']` 로 전 페이지가 공유한다(허용값 `light`/`dark`, 그 외는 `light`).

---

## 1. 색상 원시값 (Primitives)

### Primary (Blue)

| 토큰 | 값 | 메모 |
|------|----|------|
| `--color-primary-5` | `#ecf2fe` | 선택 배경, accent-bg (라이트) |
| `--color-primary-10` | `#d8e5fd` | 호버 배경, 태그 배경 |
| `--color-primary-30` | `#86aff9` | 다크모드 accent 전용 — 라이트에서 텍스트 사용 금지 |
| `--color-primary-50` | `#256ef4` | **기본 Primary** — CTA, 링크, 포커스 링 |
| `--color-primary-60` | `#0b50d0` | Hover / 다크모드 Primary 버튼 배경 (before-after `.lint-btn.primary`) |
| `--color-primary-70` | `#083891` | Active/Pressed, `--accent-dark` (index) |

> `index.html` 은 `--color-primary-30` 을 `:root`에 정의하고 다크에서 `--accent: var(--color-primary-30)` 로 참조한다(이전 문서의 '하드코딩'은 오류). `lint.html` 은 `--color-primary-30` 을 정의하지만 `--accent` 다크 재정의는 하지 않는다(§13-4).

### Gray

| 토큰 | 값 | 메모 |
|------|----|------|
| `--color-gray-0` | `#ffffff` | 흰색 |
| `--color-gray-5` | `#f4f5f6` | subtle 배경 |
| `--color-gray-10` | `#e6e8ea` | 라이트 구분선 |
| `--color-gray-20` | `#cdd1d5` | 미드 구분선, 다크 text-mid |
| `--color-gray-30` | `#aeb4bb` | (index.html만 정의) |
| `--color-gray-40` | `#8a949e` | 아이콘, 다크 muted 텍스트 |
| `--color-gray-50` | `#6d7882` | muted 텍스트 (흰 배경 4.51:1) |
| `--color-gray-60` | `#58616a` | secondary 텍스트 (흰 6.30:1) |
| `--color-gray-70` | `#464c53` | mid 텍스트 (흰 8.68:1), 다크 border-mid |
| `--color-gray-80` | `#33363d` | 다크 border |
| `--color-gray-90` | `#1e2124` | 기본 텍스트 / 다크 bg-subtle / 푸터 배경 |
| `--color-gray-95` | `#131416` | 다크 페이지 배경 |

### Status

| 토큰 | 값 | 대비비 | 용도 |
|------|----|--------|------|
| `--color-success-50` | `#228738` | 4.57:1 (흰) | 성공/Do 텍스트·아이콘. `#f4f5f6` 위 4.19:1 — 소형 텍스트 주의 |
| `--color-danger-50` | `#d9342b` | 4.69:1 (흰) | 위험/Don't (before-after, generator에 정의) |
| `--krds-color-danger` | `#d9342b` / 다크 `#f48771`(archive) | — | lint·archive의 상태 전용 토큰 (보존) |
| `--color-danger-30` | `#f48771` | 다크 `#131416` 위 7.50:1 | Don't 아이콘 강조 |
| `--color-warning-50` | 라이트 `#92580a` / 다크 `#d08000` | 5.25:1 (`#fdf3dc`) / 5.26:1 (`#2a1e06`) | 경고 텍스트. 다크는 같은 토큰을 재정의 |
| `--color-warning-10` | 라이트 `#fdf3dc` / 다크 `#2a1e06` | — | 경고 배경 (lint, before-after) |
| `--color-info-50/10` | `#1565c0` / `#e3f2fd` | 5.03:1 | lint·offline-app 전용 |
| `--color-danger` (offline-app) | `#c62828` | 5.62:1 (흰), 4.92:1 (`#fdecea`) | 오프라인 앱 전용 |

> `design-guide.md`에 있던 `#f5a623`(흰 배경 2.03:1)은 코드 어디에도 없으며 텍스트 사용 시 AA 위반이다. 제거했다.

---

## 2. 시맨틱 토큰

### Surface

| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| `--bg` | `#ffffff` | `#131416` | 페이지 기본 배경 |
| `--bg-card` | `#ffffff` | `#1e2124` | 카드 (index) |
| `--bg-subtle` | `#f4f5f6` | `#1e2124` | 카드, 사이드바, hover 배경 |
| `--bg-strong` | `#1e2124` | `#ffffff` | 인버스 배경 (정의만 존재, 사용처 없음) |

### 텍스트

| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| `--text` | `#1e2124` | `#ffffff` | 본문 기본 텍스트 (16.18:1 / 18.43:1) |
| `--text-mid` | `#464c53` | `#cdd1d5` | 서브 제목, 보조 정보 (8.68:1 / 12.00:1) |
| `--text-muted` | `#6d7882` | `#8a949e` | 힌트, 플레이스홀더, 날짜 (4.51:1 / 5.98:1) |
| `--text-on-dark` | `#ffffff` | `#1e2124` | 인버스 배경 위 텍스트 |

### 보더

| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| `--border` | `#e6e8ea` | `#33363d` | 기본 구분선, 카드 테두리 (장식 — 대비 요구 없음) |
| `--border-mid` | `#cdd1d5` | `#464c53` | 강조 구분선, 입력 필드 |

### Accent

| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| `--accent` | `#256ef4` | `#86aff9` | CTA, 링크, 포커스 링 |
| `--accent-dark` | `#083891` | — | Hover/Active (index.html) |
| `--accent-bg` | `#ecf2fe` | `rgba(37,110,244,0.15)` | 선택 상태 배경 |
| `--logo-blue` / `--logo-red` | §9 | §9 | 로고 전용 — UI 강조색으로 쓰지 않는다 |

### `color-scheme`

```css
:root { color-scheme: light; }
[data-theme="dark"] { color-scheme: dark; }
```

선언된 파일은 `index.html`·`before-after.html`·`generator/index.html` 3개뿐이다. `lint`·`archive`·`corpus`·`dictionary/*`·`case-studies`·`prompt-library`·`shared/style.css`(principles/*)·`ontology-query`·`term-graph`·`offline-app`·확장 팝업은 미선언(§13-11).

---

## 3. 보더 반경

| 토큰 | index.html | before-after.html | 용도 |
|------|-----------|-------------------|------|
| `--radius-sm` | `4px` | `4px` | 배지, 칩, 네비 링크 hover |
| `--radius-md` | **`12px`** | `8px` | 카드, 입력 필드 |
| `--radius-lg` | **`20px`** | `16px` | 큰 패널 |
| `--radius-pill` | `9999px` | — | **index `.btn`**, 필터 칩 |

CLAUDE.md 의 컴포넌트 기준(버튼 8px · 카드 12px · 배지 4px)과 비교:

| 컴포넌트 | CLAUDE.md | index.html | before-after.html | lint/offline |
|----------|-----------|-----------|-------------------|--------------|
| 버튼 | 8px | **pill** (불일치 — §13-6) | `.lint-btn` 4px · `.seminar-btn` 8px | 8px ✅ |
| 카드 | 12px | 12px ✅ | 8px | 12px ✅ |
| 배지 | 4px | 4px ✅ | 100px(칩) | 4px ✅ |

---

## 4. 타이포그래피

### 폰트

| 토큰 | 값 |
|------|----|
| `--font-sans` | `'Pretendard GOV Variable', 'Pretendard Variable', system-ui, -apple-system, sans-serif` |
| `--font-serif` | `'Noto Serif KR', Georgia, serif` (index.html `.hero-title` 전용, Google Fonts 로드) |

**고정 규칙**:

| 규칙 | 값 | 근거 |
|------|----|------|
| 최소 `font-size` | **13px** | WCAG 가독성, KRDS 기준 |
| 본문 `line-height` | **≥ 1.5** | WCAG 1.4.12 |
| 폰트패밀리 | `Pretendard GOV Variable` | 공공기관 전용 |

본문 `line-height` 실측: index·archive·dictionary·offline-app = **1.5**, before-after·lint·corpus·generator = **1.6**, shared/style.css = **1.7**. 모두 ≥1.5 충족. 단 `index.html`의 `.btn`(1), `.editorial-num`·`.strip-num`(1) 등 **한 줄짜리 UI 라벨/숫자**는 1.0~1.35 로 의도적으로 낮다 (본문 단락이 아니므로 WCAG 1.4.12 대상 외).

### 예외 (장식 요소 — 13px 규칙 제외, 정본 4파일 기준)

| 요소 | 크기 | 파일 | 사유 |
|------|------|------|------|
| `.gnb-badge` | 11px | index, before-after | 장식 배지 |
| `.tab-principle-chip` / `.ba-label` | 11px | before-after | 장식 칩 (A/B/C) |
| `.generator-banner-badge` | 11px | index | 'NEW' 장식 배지 |
| `.entry-link::before` `→`, 체크리스트 `□` | 11–12px | index | 장식 기호 |
| `.section-nav-clear` | **12px** | index | ⚠ 기능 텍스트인데 12px — 예외 아님, §13 |

> 이전 문서의 '로고마크 K 10px' 예외는 삭제했다. index 푸터 로고는 이제 SVG이고, 다른 페이지의 K 마크는 11–14px 이다.

레포 전체 현황(2026-11-10): 13px 미만 `font-size` 선언의 **정확한 건수는 재집계 필요**(슬라이드·목업 포함 시 400건대, 집계 범위·정규식에 따라 달라짐). 참고로 `principles/*`에서만 69곳이 확인된다. 정본 4파일은 index 5 · before-after 3 · lint 3 · archive 2(`.8rem`).

### 헤딩 타입스케일 (실측)

| 계층 | before-after.html | index.html |
|------|-------------------|-----------|
| `h1` 계열 | `.page-hero-title` `clamp(24px,4vw,36px)` 700 / lh 1.25 | `.hero-title` `clamp(36px,5vw,60px)` 700 / lh 1.25 (serif) |
| `h2` 계열 | `.panel-intro-title` 18px 700 | `.section-nav-title` 28px 등 섹션별 상이 |
| 본문 | 16px / `.panel-intro-desc` 15px | 17px(`.hero-desc`) / 16px |
| 소형 | 13px | 13px |

`text-wrap: balance` — `index.html` `.hero-title`, `before-after.html` `.page-hero-title`·`.panel-intro-title` 에 적용.

---

## 5. 레이아웃 · 스페이싱

| 토큰 | 값 | 용도 |
|------|----|------|
| `--container` | `1200px` | 최대 콘텐츠 너비 (index, before-after) |
| `--gutter` | `clamp(20px, 4vw, 48px)` | 반응형 수평 패딩 |
| `--sidebar-w` / `--gnb-h` | `240px` / `56px` | shared/style.css |

---

## 6. 컴포넌트 스펙 (실측)

### GNB (Global Navigation Bar)

| 속성 | index.html | before-after / lint / archive |
|------|-----------|-------------------------------|
| 높이 | **60px** | 60px |
| 배경 (라이트) | `var(--bg)` 불투명 | `rgba(248,247,245,.92)` + `backdrop-filter:blur(12px)` |
| 배경 (다크) | `var(--bg)` = `#131416` | before-after `rgba(19,20,22,.92)` · lint `rgba(30,33,36,.92)` · archive `rgba(13,17,23,.92)` |
| 위치 | `sticky; top:0; z-index:100` | 동일 |
| `.gnb-nav-link` | `13px/500`, 높이 60, padding `0 12px` | before-after `14px`, lint·archive `13px`/높이 약 32 |
| `.gnb-icon-btn` | **44×44** | before-after 44×44 · `shared/style.css` **28×28(미달)** |
| `.gnb-theme-btn` | — | lint·archive 44×44 |

실측(1280px 뷰포트): index `.gnb` 높이 60, `.gnb-logo` 69.3×28, `.gnb-icon-btn` 44×44, `.btn` 119.3×44.

### 버튼

**index.html `.btn`** (2026-06-24 Mintlify 리디자인 이후):

| 속성 | 값 |
|------|----|
| `padding` | `13px 24px`, `min-height: 44px` |
| `border-radius` | `var(--radius-pill)` (9999px) |
| `font-size / weight` | `14px / 600`, `line-height:1` |
| Primary | `background: var(--accent)`, `color:#fff` (라이트 4.55:1 ✅ / 다크 2.21:1 ❌ §13-1) |
| Outline | `1px solid var(--border-mid)`, `color: var(--text-mid)` |

**before-after.html**:

| 요소 | 속성 | 실측 |
|------|------|------|
| `.lint-btn` | `padding:12px 20px`, radius 4px, `1.5px` border | 119.6×43.5 |
| `.lint-btn.primary` (라이트) | `var(--accent)`, `#fff` | 4.55:1 |
| `.lint-btn.primary` (다크) | `var(--color-primary-60)` `#0b50d0`, 흰 글자 | **6.83:1 ✅** |
| `.seminar-btn` | `padding:13px 20px`, radius 8px | 118.3×44.5 ✅ |

**lint.html `.btn`**: `padding:10px 20px`, radius 8px → 실측 **115.7×36** (44px 미달, §13-8). **offline-app**: `#lint-btn` 66.2×39.5 (미달, §13-8).

### Before/After 카드

```css
/* before-after.html */
.ba-card { border-radius: var(--radius-md); /* 8px */ padding: 20px 24px; border: 1.5px solid; }
.ba-card.before { background:#fff5f5; border-color:#d9342b; }
.ba-card.after  { background:#f0fff4; border-color:#228738; }
[data-theme="dark"] .ba-card.before { background:rgba(217,52,43,.12); }
[data-theme="dark"] .ba-card.after  { background:rgba(34,135,56,.12); }
```
(이전 문서의 `padding:16px` 는 오기 — 코드는 `20px 24px`.)

`index.html` 의 `.ba-card` 는 별개 컴포넌트: radius `--radius-md`(12px), `.ba-col` radius 6px, `.ba-tag` 13px/radius 4px.

### 카드·배지

| 컴포넌트 | 속성 |
|----------|------|
| 카드 (index `.quote-card` 등) | radius 12px, padding `32px`, `1px solid var(--border)` |
| 배지 (`.ba-tag`) | radius 4px, padding `3px 10px`, **13px** |

### 모달·다이얼로그

`before-after.html` `#seminarOverlay` — `role="dialog"` `aria-modal="true"` `aria-label`. `index.html` 모바일 메뉴 — `trapFocus()` (`script.js`). 모달 전용 radius/padding 토큰은 코드에 **없음**(이전 `design-guide.md`의 '모달 32px/16px'은 이상값).

---

## 7. 접근성 대비비 빠른 참조 (직접 계산)

계산식: WCAG 2.1 상대 휘도 `L = 0.2126R + 0.7152G + 0.0722B` (R·G·B 는 sRGB 선형화 후), 대비 `(L1+0.05)/(L2+0.05)` (L1 이 밝은 쪽). 표의 수치는 소수 둘째 자리 반올림이다. 기준선 바로 위인 쌍은 원값을 함께 적는다: `#6d7882`/흰 = 4.5072, `#256ef4`/흰 = 4.5500.

| 색상 쌍 | 대비비 | 등급 | 적용 |
|---------|--------|------|------|
| `--text` #1e2124 on #fff | 16.18:1 | AAA | 본문 |
| `--text` #1e2124 on #f8f7f5 | 15.11:1 | AAA | warm 배경 본문 |
| `--text` #fff on #131416 | 18.43:1 | AAA | 다크 본문 |
| `--text-mid` #464c53 on #fff | 8.68:1 | AAA | 서브 제목 |
| `--text-muted` #6d7882 on #fff | 4.51:1 | AA(경계) | 힌트·날짜 — **#f4f5f6 위 4.13:1, #f8f7f5 위 4.21:1 ❌** |
| `--text-muted` #8a949e on #131416 | 5.98:1 | AA | 다크 muted |
| `--accent` #256ef4 on #fff | 4.55:1 | AA | 링크·버튼 텍스트 |
| `--accent` #256ef4 on #f8f7f5 / #f4f5f6 | 4.25:1 / 4.17:1 | ❌ | 소형 링크는 불통과 |
| `#fff` on `--accent` #256ef4 | 4.55:1 | AA | 라이트 Primary 버튼 |
| `#fff` on `--color-primary-60` #0b50d0 | 6.83:1 | AA | 다크 Primary 버튼(before-after) |
| `--accent`(다크) #86aff9 on #131416 | 8.35:1 | AAA | 다크 링크 |
| `#fff` on `--accent`(다크) #86aff9 | **2.21:1** | ❌ | index 다크 `.btn-primary` (§13-1) |
| `#1e2124` on #86aff9 | 7.33:1 | AAA | 위 위반의 올바른 대안 |
| `--color-success-50` #228738 on #fff | 4.57:1 | AA | 성공 (이전 문서 5.1 오기) |
| `--color-danger-50` #d9342b on #fff | 4.69:1 | AA | 위험 |
| `--color-warning-50` #92580a on #fdf3dc | 5.25:1 | AA | 경고 |
| `--color-warning-50`(다크) #d08000 on #2a1e06 | 5.26:1 | AA | 다크 경고 |
| `--color-primary-60` #0b50d0 on #131416 | 2.70:1 | — | 버튼 **배경 vs 페이지**(UI 3:1 미달). 텍스트가 6.83:1 로 읽히므로 허용 |

**UI 컴포넌트 경계선 3:1**: `--border` `#e6e8ea`(1.23:1)·`--border-mid` `#cdd1d5`(1.54:1)는 **장식 구분선**이다. 입력 필드처럼 경계가 유일한 식별 수단인 컴포넌트는 `#6d7882`(4.51:1) 이상 또는 `#8a949e`(3.08:1) 를 써야 한다 → `generator`의 `--color-border: #9ca3af` 는 주석 '3.1:1' 과 달리 실측 **2.54:1**(§13-9).

**포커스 링** (정본 4파일 공통):
```css
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```
라이트 4.55:1 / 다크 8.35:1 로 모두 UI 3:1 충족. ⚠ `index.html` `.section-nav-input:focus { outline:none }` 는 부모 `.section-nav-search` 에 `:focus-within` 대체 스타일이 **없어** 포커스 표시가 사라진다(Playwright 실측: 부모 border-color·box-shadow 변화 없음, §13-5). `ontology-query.html`·`dictionary/index.html` 은 `box-shadow` 로 대체해 문제없음.

### 터치 타겟 (WCAG 2.5.5 AAA 44×44 — 실측)

| 요소 | 실측 | 판정 |
|------|------|------|
| index `.gnb-icon-btn` / `.btn` | 44×44 / 119.3×44 | ✅ |
| before-after `.gnb-icon-btn` / `.seminar-btn` / `.lint-btn` | 44×44 / 118.3×44.5 / 119.6×43.5 | ✅ / ✅ / 43.5(0.5px 미달) |
| lint·archive `.gnb-theme-btn` | 44×44 | ✅ |
| lint `.btn` | 115.7×36 | ❌ |
| offline-app `#lint-btn` `#clear-btn` | 66.2×39.5 / 78.3×39.5 | ❌ |
| lint·archive `.gnb-nav-link` | 31.2×32.8 / 35.8×32.4 | ❌ |
| principles `.gnb-actions button` | 28×28 | ❌ |
| 확장 `.icon-btn` / `.chip` / `.btn-full-guide` | 30×30 / 58.7×24.5 / 348×33.5 | ❌ (팝업은 380px 고정폭 도구 UI) |
| index `.footer-link` | 112.1×19.5 | ❌ (인라인 텍스트 링크 예외 해석 가능) |

> WCAG 2.1 의 2.5.5(AAA, 44×44)보다 완화된 WCAG 2.2 의 2.5.8(AA)은 최소 24×24 이다. 2.5.8 기준으로는 위 ❌ 중 `.footer-link`(높이 19.5px)만 미달이며, 이것도 문장 속 인라인 링크 예외로 해석될 수 있다. 나머지는 모두 24px 이상이다. 프로젝트 기준은 CLAUDE.md 에 따라 44px 이다.

---

## 8. 그림자

lint.html 전용:
```css
--shadow-card: 0 1px 4px rgba(0,0,0,.06), 0 0 0 1px var(--border);   /* 라이트 */
--shadow-card: 0 1px 4px rgba(0,0,0,.3),  0 0 0 1px var(--border);   /* 다크 */
```
(이전 문서의 `--krds-border-default` 참조는 `--border` 로 전환됨.) index·before-after 는 shadow 최소화, border 기반 depth.

---

## 9. 로고 시스템

> **적용 현황**: 2026-11-10 `2740295` 로 **`index.html`(GNB·푸터·favicon)에만** 적용되었다. 나머지 페이지는 이전 'K' 사각 마크를 유지 중이며 이는 §13-2 의 코드 수정 대상이다. `design-mockups/` 는 로컬 전용(gitignore)이므로 이 문서는 참조하지 않는다.

### 9.1 구성

```
[ 태극 마크 ]  [ UXW 워드마크 ]
   28×28          14px / 800
```

**마크** — `viewBox="0 0 200 200"` 의 태극 원형.
- 외곽 원 `cx=100 cy=100 r=96`, 같은 원으로 `clipPath` 클리핑 (획이 원 밖으로 번지지 않게).
- 바탕 원 = **빨강**(`.logo-fill-red`), 그 위에 **파랑** 패스(`.logo-fill-blue`) `M100,4 A48,48 0 0,1 100,100 A48,48 0 0,0 100,196 A96,96 0 0,1 100,4`.
- 픽셀 검증(400px 렌더): 좌측 중앙 = 파랑 `0,57,100`, 우측 중앙 = 빨강 `237,26,59`, 위쪽 모서리 바깥 = 투명. 즉 **파랑이 좌·상단, 빨강이 우·하단** 이다.
- 크기: **GNB 28×28px**(`.gnb-logo-mark`, `flex-shrink:0`, `display:block`), **푸터 20×20px**(인라인 style). 두 곳 모두 별도 `border-radius`·배경 없음(원형은 SVG 자체).
- `clipPath` id 는 문서 내 중복 금지: GNB `gnbLogoClip`, 푸터 `footerLogoClip`.

**워드마크** — `<span class="gnb-logo-wordmark"><span class="u">U</span>X<span class="w">W</span></span>`
- `UXW` = **U**X **W**riting. `U`=파랑(`--logo-blue`), `X`=본문색(`--text`), `W`=빨강(`--logo-red`).
- `font-weight:800`, 부모 `.gnb-logo` 가 `14px`, `letter-spacing:-0.02em`(실측 -0.28px), 마크와 `gap:8px`.
- `X` 는 색칠하지 않고 본문색을 따른다(`.gnb-logo{color:var(--text)}`). 양 끝 글자가 태극의 두 색에 대응하는 구조로 읽히나, 설계 의도는 커밋 메시지에 기록되어 있지 않아 이는 해석이다.

### 9.2 색상 토큰

| 토큰 | 라이트 | 다크 | 비고 |
|------|--------|------|------|
| `--logo-blue` | `#003964` | `#8cb6ff` | 마크 파랑 + 워드마크 `U` |
| `--logo-red` | `#ed1a3b` | `#ff9bad` | 마크 빨강 + 워드마크 `W` |

- 정의 위치: `index.html` `:root`(라이트) · `[data-theme="dark"]`(다크). 클래스 `.logo-fill-blue{fill:var(--logo-blue)}` `.logo-fill-red{fill:var(--logo-red)}`, `.gnb-logo-wordmark .u/.w{color:...}`.
- `--accent`(`#256ef4`)·`--color-danger-*` 와 **별개 토큰**이다. 로고 색을 UI 의 강조색·위험색으로 재사용하거나 그 반대로 하지 않는다 (둘은 색상값·역할이 다름: 로고 빨강 `#ed1a3b` ≠ danger `#d9342b`).

### 9.3 대비율 (직접 계산)

배경: 라이트 페이지 `#ffffff`, 라이트 GNB warm `#f8f7f5`(blur 계열 페이지), 다크 페이지 `#131416`, 다크 subtle `#1e2124`.

| 전경 | 배경 | 대비비 | 기준 | 판정 |
|------|------|--------|------|------|
| 라이트 파랑 `#003964` | `#ffffff` | **11.87:1** | 텍스트 4.5 / 그래픽 3 | ✅ AAA |
| 라이트 파랑 `#003964` | `#f8f7f5` | **11.09:1** | 〃 | ✅ AAA |
| 라이트 빨강 `#ed1a3b` | `#ffffff` | **4.36:1** | 그래픽 3:1 | ✅ (마크) |
| 라이트 빨강 `#ed1a3b` | `#ffffff` | 4.36:1 | 텍스트 4.5:1 | ❌ **0.14 부족** |
| 라이트 빨강 `#ed1a3b` | `#f8f7f5` | **4.08:1** | 그래픽 3:1 | ✅ |
| 라이트 빨강 `#ed1a3b` | `#f8f7f5` | 4.08:1 | 텍스트 4.5:1 | ❌ **0.42 부족** |
| 다크 파랑 `#8cb6ff` | `#131416` | **9.00:1** | 텍스트 4.5 | ✅ AAA |
| 다크 파랑 `#8cb6ff` | `#1e2124` | **7.90:1** | 〃 | ✅ AAA |
| 다크 빨강 `#ff9bad` | `#131416` | **9.25:1** | 〃 | ✅ AAA |
| 다크 빨강 `#ff9bad` | `#1e2124` | **8.12:1** | 〃 | ✅ AAA |
| 마크 내부 빨강↔파랑(라이트) | — | 2.72:1 | 인접 영역 구분 | 3:1 미달이나 명도 차 외에 **형태(S자 곡선)** 로 구분되므로 허용 |
| 마크 내부 빨강↔파랑(다크) | — | **1.03:1** | 〃 | 명도 차 거의 없음 — **색상(hue) 차에만 의존**. 형태 인식은 가능하나 색각 이상 사용자에게는 두 영역이 합쳐 보일 수 있다 (§9.7) |

**해석**
1. **빨강 `W`(텍스트) 는 라이트에서 AA 4.5:1 미달.** `W` 는 14px/800 이라 WCAG '큰 글자'(≥18.66px bold)에 해당하지 않아 4.5:1 이 필요하다. 그러나 `.gnb-logo` 는 `aria-label="KRDS UX Writing 가이드라인 홈"` 을 갖고 워드마크는 **로고(브랜드 마크)** 이므로 WCAG 1.4.3 의 **'로고타입(logotypes) 예외'** 대상이다. 따라서 규정 위반은 아니지만, 본문/링크 텍스트로 `#ed1a3b` 를 쓰는 것은 금지된다. 자동 대비 검사기는 이 항목을 위반으로 보고한다(Playwright 스캔에서 `w` 1건 검출).
2. 마크의 빨강/파랑 영역은 **비텍스트 그래픽**이므로 3:1 기준이며 라이트·다크 모두 충족한다.
3. 다크 값은 모두 7.9:1 이상이라 텍스트로 써도 안전하다.
4. **라이트 로고를 어두운 배경(푸터 `#1e2124`)에 쓰면 안 된다**: `#003964` on `#1e2124` = **1.36:1**, `#ed1a3b` on `#1e2124` = 3.71:1. 현재 `index.html` 푸터는 투명 배경이라 페이지 배경(`--bg`)을 따르므로 안전하지만, `before-after.html` 처럼 `footer{background:var(--color-gray-90)}` 인 페이지에 로고를 이식할 때는 다크 토큰(`#8cb6ff`/`#ff9bad`)을 강제해야 한다.

### 9.4 여백 · 최소 크기

| 항목 | 규칙 | 근거 |
|------|------|------|
| 마크–워드마크 간격 | `gap: 8px` | `.gnb-logo` |
| 로고 주위 클리어 스페이스 | **권장(신규 규칙)**: 마크 지름의 ½ 이상(GNB 28px → 14px). 현재 코드의 실제 값: 좌 `.gnb` `padding:0 20px`, 우 `.gnb-nav` `margin-left:24px` — 모두 14px 이상이라 충족 | 코드에 명시 규칙 없음, 실측 구조에서 도출 |
| 마크 최소 크기 | **20px** (푸터 사용 크기). 20px 미만 금지(favicon 제외) | 코드에 명시 규칙은 없고 실제 사용 최소값을 하한으로 채택. 20px 에서 S자 반원 반지름 = 48/200×20 = 4.8px(지름 9.6px) |
| 워드마크 최소 크기 | **14px / 800** | 현재 GNB. 13px 미만 금지(프로젝트 규칙) |
| favicon | 16×16 렌더 허용(data URI `viewBox 0 0 200 200`) | 탭 아이콘은 UI 제어 한계 |
| 마크 단독 / 워드마크 단독 | 푸터는 마크(20px) + 텍스트 `KRDS UX Writing 가이드라인`(13px, UXW 아님) | 푸터는 워드마크 미사용 |

### 9.5 금지 사례

| ❌ 금지 | 이유 |
|---------|------|
| 마크 비율 변경(가로/세로 늘이기), 회전, 좌우 반전 | 태극 방향(파랑 좌·상, 빨강 우·하)이 정체성 |
| 마크에 `border-radius`·배경색·테두리·그림자 추가 | 원형은 SVG 자체. 이전 'K' 사각 마크(`border-radius:6px; background:var(--accent)`) 방식으로 되돌리지 않는다 |
| `--logo-blue/red` 외 임의 색 지정, `--accent`·`--color-danger-*` 로 대체 | 토큰 분리 원칙(§9.2) |
| 라이트 토큰으로 어두운 배경에 표시 | 파랑 1.36:1 (§9.3-4) |
| 다크 토큰(`#8cb6ff`/`#ff9bad`)으로 흰 배경에 표시 | 2.05:1 / 1.99:1 |
| 워드마크 `X` 를 파랑·빨강으로 칠하기, `U`/`W` 색 바꿔치기 | 색 대응 규칙 |
| 워드마크를 소문자·혼합 표기(`Uxw`, `UXw`), 영문 외 대체 | 고정 표기 `UXW` |
| 마크와 워드마크를 14px 미만으로 축소 | 최소 크기 |
| 로고에 `<img>` 외부 파일 사용 | CSP `img-src 'self' data:` 및 다크모드 토큰 전환 불가 → **인라인 SVG + CSS 변수 필수** |
| 두 SVG 에 같은 `clipPath` id 사용 | 한쪽이 렌더 안 됨 |
| 로고 위에 그라디언트·장식 오버레이 | 의미 없는 장식 |

### 9.6 접근성 마크업

```html
<a href="/krds-ux-writing/" class="gnb-logo" aria-label="KRDS UX Writing 가이드라인 홈">
  <svg class="gnb-logo-mark" aria-hidden="true" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <clipPath id="gnbLogoClip"><circle cx="100" cy="100" r="96"/></clipPath>
    <g clip-path="url(#gnbLogoClip)">
      <circle cx="100" cy="100" r="96" class="logo-fill-red"/>
      <path d="M100,4 A48,48 0 0,1 100,100 A48,48 0 0,0 100,196 A96,96 0 0,1 100,4" class="logo-fill-blue"/>
    </g>
  </svg>
  <span class="gnb-logo-wordmark"><span class="u">U</span>X<span class="w">W</span></span>
</a>
```

- 마크 SVG 는 **장식**이므로 `aria-hidden="true"`. 링크의 접근 가능한 이름은 `aria-label="KRDS UX Writing 가이드라인 홈"` 하나가 책임진다(워드마크 `UXW` 는 `aria-label` 이 덮어씀 → 스크린 리더가 'U X W' 로 낭독하지 않음).
- 클릭 영역: `.gnb-logo` 실측 69.3×28. 44px 미달이나 GNB 높이 60px 안에서 링크 자체가 세로 28px 이므로 **2.5.5 미충족**(§13-7). 해결안: `.gnb-logo` 에 `min-height:44px; padding-block:8px`.
- 포커스: 전역 `:focus-visible` (2px `--accent`, offset 2px) 적용. 로고 링크에도 별도 `outline:none` 금지.
- 푸터 로고 링크: 가시 텍스트 `KRDS UX Writing 가이드라인` 이 이름을 제공하므로 SVG 는 `aria-hidden="true"` 만 두고 `aria-label` 불필요(이미 코드와 일치).
- `prefers-reduced-motion`: 로고에 애니메이션 없음 — 해당 사항 없음.

### 9.7 색각 이상 고려 (참고)

다크 모드 마크는 빨강·파랑의 명도가 거의 같아(대비 1.03:1) 색상 차에만 의존한다. 적록 색각 이상(빨강 인식 약화)이 있는 사용자에게는 `#ff9bad` 와 `#8cb6ff` 의 구분이 약해질 수 있다. 태극의 **S자 경계 곡선 형태** 가 구분을 보조하므로 식별은 가능하나, 정체성 표현이 목적인 장식 요소라 허용한다. 향후 개선 시 다크 파랑을 `#6fa2ff` 이하로 낮춰 명도 대비를 확보하는 방안을 검토할 수 있다(미적용·미결정).

---

## 10. 사용 규칙

### ✅ Do

- 시맨틱 토큰 사용: `var(--text)`, `var(--bg)`, `var(--accent)`, `var(--border)`
- 다크모드는 `[data-theme="dark"]` 가 CSS 변수를 재정의 — JS로 attribute 설정만 (`localStorage['krds-theme']`)
- 새 색상: `:root` 원시값 등록 → 시맨틱 토큰 래핑 → 사용
- **다크 배경 위 채워진 Primary 버튼**: 배경 `--color-primary-60`(#0b50d0) + 흰 글자(6.83:1), 또는 배경 `--accent`(#86aff9) + **어두운 글자 `#1e2124`(7.33:1)** 중 하나. `--accent` 배경에 흰 글자는 금지(2.21:1)
- 버튼/링크 최소 터치 타겟 44×44px
- 기능 텍스트 최소 13px
- 헤딩에 `text-wrap: balance`
- 로고는 인라인 SVG + `--logo-*` 토큰 (§9)

### ❌ Don't

| 잘못된 코드 | 올바른 코드 |
|------------|-----------|
| `color: #1e2124` | `color: var(--text)` |
| `background: #f4f5f6` | `background: var(--bg-subtle)` |
| `border: 1px solid #e6e8ea` | `border: 1px solid var(--border)` |
| `var(--color-primary-30)` 라이트 텍스트 | `var(--accent)` |
| `font-size: 12px` 기능 텍스트 | `font-size: 13px` 이상 |
| `line-height: 1.4` (본문) | `line-height: 1.5` 이상 |
| 다크 채움 버튼 `background: var(--accent); color:#fff` | §10 Do 항목 |
| `outline: none` + 대체 포커스 표시 없음 | `:focus-within` 으로 부모 border/`box-shadow` 대체 |
| `onclick=` 인라인 핸들러 | `addEventListener` + CSP 준수 |
| 로고에 `fill="#ed1a3b"` 하드코딩 | `class="logo-fill-red"` |

---

## 11. 다크모드 패턴

```css
:root {
  color-scheme: light;
  --bg: var(--color-gray-0);
  --accent: var(--color-primary-50);
  --logo-blue: #003964;  --logo-red: #ed1a3b;
}
[data-theme="dark"] {
  color-scheme: dark;
  --bg: var(--color-gray-95);
  --accent: var(--color-primary-30);   /* #86aff9 — 다크에서 더 밝음 */
  --logo-blue: #8cb6ff;  --logo-red: #ff9bad;
}
/* before-after 다크 Primary 버튼 (index 는 아직 미적용 — §13-1) */
[data-theme="dark"] .lint-btn.primary {
  background: var(--color-primary-60);   /* #0b50d0 */
  border-color: var(--color-primary-60);
  color: #fff;                            /* 6.83:1 — 반드시 유지 */
}
```

> 버튼 **배경** `#0b50d0` 와 페이지 `#131416` 의 대비는 2.70:1 이지만, 버튼 안의 흰 글자가 6.83:1 로 읽히므로 컨트롤 식별에는 문제없다. 이전 문서의 '6.8:1 on #131416' 표기는 글자-배경 쌍을 혼동한 오기였다.

---

## 12. 적용 범위: 확장 프로그램 · 오프라인 앱

### 12.1 Chrome 확장 (`krds-extension/`, Manifest V3 v1.0.0)

| 항목 | 값 |
|------|----|
| 토큰 | 자체 `--primary #256ef4`, `--primary-hover #0b50d0`, `--success #228738`, `--error #de3412`, `--text-primary #1e2124`, `--text-muted #8a949e`, `--bg #fff`, `--bg-2 #f4f5f6`, `--border #cdd1d5` |
| 폰트 | `"Pretendard GOV Variable", "Pretendard GOV", Pretendard, -apple-system, sans-serif` — **`@font-face`/CDN 로딩 없음**(popup.html 은 `popup.css` 만 링크) → 사용자 PC 에 설치된 폰트가 없으면 시스템 폴백. MV3 `extension_pages` CSP 는 `script-src 'self'; object-src 'none'` |
| 반경 | `--radius 8px`, `--radius-sm 6px`, `--radius-pill 100px` |
| 팝업 | 폭 380px 고정, 기본 `font-size:13px`, **다크모드 없음** (`prefers-color-scheme`·`data-theme` 0건) |
| 로고 | 아이콘 = `#256ef4` 바탕 흰 'K' PNG(`generate-icons.js` 생성), 팝업 헤더 = 28×28 `--primary` 사각 + 흰 'K' 패스 — **태극 로고 미적용** |
| 인라인 린트 UI (`content.css`) | `.krds-popover-apply` 13px/600, radius 6px, `:focus-visible` 2px 링, `prefers-reduced-motion` 대응 ✅ |

**대비 이슈**: `--text-muted #8a949e` on `#fff` = **3.08:1**, on `--bg-2 #f4f5f6` = **2.82:1** (AA 4.5:1 미달, §13-10). `--error #de3412` on 흰 = 4.56:1 ✅.
**13px 미만**: popup.css 에 11px 6곳·12px 3곳·10px 1곳, 합계 10곳 (칩·보조 라벨·코드 글꼴 포함, §13-10).
**포커스**: `.search-input { outline:none }` 이나 부모 `.search-wrap:focus-within` 로 대체 ✅. 버튼류 전용 `:focus-visible` 규칙은 없고 `.result-item:focus` 만 정의 → 브라우저 기본 링에 의존.
**다크모드**: 없음, `color-scheme` 미선언.

### 12.2 오프라인 앱 (`offline-app/`, Electron 최소 스캐폴드, v0.1.0)

| 항목 | 값 |
|------|----|
| 토큰 | `--accent #256ef4`, `--color-success-50 #228738`, `--color-danger #c62828`, `--color-warning-50 #92580a`, `--color-info-50 #1565c0`, `--bg #fff`, `--bg-subtle #f8f7f5`, `--border #cdd1d5`, `--text #1e2124`, `--text-muted #5a6270`(6.15:1 ✅) |
| 폰트 | `-apple-system, BlinkMacSystemFont, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif` — **의도적 시스템 폰트** (`MANIFEST.md`: 외부 CDN 참조 금지, CSP `connect-src 'none'`) |
| 반경 | 카드 12px · 버튼 8px · 배지 4px (CLAUDE.md 기준과 일치 ✅) |
| 본문 | 15px / line-height 1.5, 최소 폰트 13px (13px 미만 0곳 ✅) |
| 다크모드 | **없음** |
| 로고·favicon | **없음** (텍스트 제목 `h1` 만) |
| 모션 | `transition`/`animation` 0건 → `prefers-reduced-motion` 규칙 불필요 ✅ |
| 포커스 | 전용 `:focus-visible` 규칙 없음 — 브라우저 기본 링 의존 |
| 터치 타겟 | `#lint-btn` 66.2×39.5, `#clear-btn` 78.3×39.5 (44px 미달, §13-8) |

→ 두 산출물 모두 **'정본 4파일' 토큰을 직접 import 하지 않는다**. 값을 복사해 둔 별도 체계이므로, 정본 색상값이 바뀌면 수동 동기화가 필요하다. 오프라인 앱은 외부 폰트·CDN 금지 정책 때문에 Pretendard GOV 를 못 쓰는 것이 **의도된 예외**다.

### 12.3 접근성 체크리스트 (최신)

| 항목 | 기준 | 정본 4파일 현황 | 확인 방법 |
|------|------|----------------|-----------|
| 터치 타겟 | 44×44px | index·before-after 주요 컨트롤 ✅. 미달: lint `.btn`(36), lint·archive `.gnb-nav-link`(32~33), 로고 링크(28) | `getBoundingClientRect()` |
| `prefers-reduced-motion` | 전환·애니메이션 있는 페이지는 필수 | index ✅ · before-after ✅ (전역 `*` 규칙) · lint ✅ · archive ✅ · generator ✅ (요소별). prompt-library 는 `.pl-*` 3개 요소만 부분 적용. **미적용(전환 있음)**: corpus·dictionary/*·case-studies·ontology-query·term-graph·`shared/style.css`(principles/* 전체)·확장 popup | `grep reduced-motion` |
| `:focus-visible` | 2px `--accent` 링 | 정본 4파일 ✅, `shared/style.css` 전역 규칙으로 principles/*·prompt-library ✅, generator ✅. **미적용**: corpus·dictionary/*·case-studies·ontology-query·확장 popup(버튼)·offline-app | 키보드 Tab 순회 |
| `outline:none` 대체 | 반드시 대체 표시 | index `.section-nav-input` ❌ | Playwright 포커스 후 부모 스타일 비교 |
| 색상 대비 | 텍스트 4.5:1 / UI 3:1 | §7 표 참고 | 상대 휘도 계산 |
| 최소 폰트 | 13px | §4 현황 | 정규식 스캔 |
| 스킵 링크 | 본문 바로가기 | index·before-after·lint·archive·generator·corpus·dictionary·case-studies·principles/*·prompt-library ✅. 없음: ontology-query·term-graph·offline-app | DOM |
| 다크모드 `color-scheme` | 선언 | index·before-after·generator 만 ✅ (§2) | grep |
| 로고 | `aria-hidden` + 링크 `aria-label` | index ✅ (§9.6) | DOM |

---

## 13. 코드 수정 필요 목록 (문서가 정답, 이번 작업에서 코드는 수정하지 않음)

| # | 위치 | 문제 | 기준 | 권장 수정 |
|---|------|------|------|-----------|
| 1 | `index.html` 다크 `.btn-primary` `.skip-nav` `.section-filter-chip.active` `.generator-banner-badge/cta` `.dg-agency-badge` | 흰 글자 on `#86aff9` **2.21:1** | WCAG 1.4.3 / §10 | 다크에서 `color: var(--text-on-dark)`(`#1e2124`, 7.33:1) 또는 배경 `--color-primary-60` |
| 2 | `before-after`·`lint`·`archive`·`dictionary/*`·`corpus`·`case-studies`·`principles/*`·`prompt-library`·`index-v2` | GNB 로고가 'K' 사각 마크, favicon 'K' 파랑 원 (`lint`·`ontology-query`·`term-graph`·`offline-app` 은 favicon 자체 없음) | §9 로고 시스템 | 태극 SVG + `UXW` + `--logo-*` 토큰 이식, 루트 `favicon.svg` 는 태극으로 교체 또는 삭제 (현재 미참조) |
| 3 | `before-after.html` `footer{background:gray-90}` 에 로고 이식 시 | 라이트 파랑 1.36:1 | §9.3-4 | 푸터는 다크 토큰 강제 |
| 4 | `lint.html` | 다크 `--accent` 미재정의 → 링크/active nav `#256ef4` on `#1e2124` **3.52:1**, hero-badge 2.95:1, `.footer a` 만 `--color-primary-30` | WCAG 1.4.3 | `[data-theme="dark"] { --accent: #86aff9 }` |
| 5 | `index.html` `.section-nav-input:focus{outline:none}` | 대체 포커스 표시 없음 | WCAG 2.4.7 | `.section-nav-search:focus-within{ border-color:var(--accent); box-shadow:0 0 0 3px ... }` |
| 6 | `index.html` `.btn` `border-radius: pill` | CLAUDE.md '버튼 8px' 와 불일치 | CLAUDE.md | **결정 필요**: 2026-06-24 Mintlify 리디자인의 의도적 선택이면 CLAUDE.md 를 pill 로 개정, 아니면 8px 로 복귀 |
| 7 | `.gnb-logo` (index 69.3×28) | 터치 타겟 28px | 2.5.5 | `min-height:44px` |
| 8 | `lint.html .btn`(36), `.gnb-nav-link`(≈32), `offline-app #lint-btn/#clear-btn`(39.5), `principles/*` `.gnb-actions button`(28) | 터치 44px 미달 | 2.5.5 | `min-height:44px` |
| 9 | `generator/index.html` `--color-border #9ca3af` | 주석 '3.1:1' 과 달리 실측 2.54:1, 동일 파일 `.btn-primary` disabled 2.05:1 | WCAG 1.4.11 | `#8a949e`(3.08) 이하 또는 `#6d7882` |
| 10 | `krds-extension/popup.css` | `--text-muted #8a949e` 3.08:1 / 2.82:1, 10~12px 10곳, 다크모드·버튼 `:focus-visible` 없음 | 4.5:1 / 13px | `--text-muted:#6d7882` 이상, 13px |
| 11 | `shared/style.css` 외 다수 | `shared/style.css`: `.gnb-icon-btn` 28×28, `.gnb-badge`·`.sidebar-label` 10px, `prefers-reduced-motion` 없음. **`color-scheme` 는 index·before-after·generator 외 전 파일 미선언** | 13px / 44px / 다크 폼 컨트롤 | `[data-theme="dark"]{color-scheme:dark}` 일괄 추가 |
| 12 | `lint.html` | Pretendard GOV 스타일시트 `<link>` 없음(`preconnect` 만 존재) → 시스템 폴백 | 폰트 규칙 | `<link rel="stylesheet" href=".../pretendardvariable-gov.min.css" integrity=...>` + CSP `style-src` 확인 |
| 13 | 레포 전체 | 13px 미만 `font-size` 건수 재집계 필요(슬라이드·목업 포함 시 400건대, principles/* 69곳 포함) | 13px | 점진 정리 |
| 14 | `index.html` 색 대비 | 라이트 `.tag`·`.dg-agency-desc`·`.quote-avatar` 등 `#6d7882` on `#f4f5f6` 4.13:1(Playwright 텍스트 노드 스캔에서 16+6+6+3+1 노드, 고유 선택자 5종), `.ba-col-label` 개선 전 `#f48771` on 연핑크 2.30:1, `.ba-tag--level` 4.05:1 | 1.4.3 | `--text-muted` 를 `--color-gray-60`(#58616a, 5.77:1) 로 상향 또는 배경 흰색 사용 |
| 15 | `index.html` 다크 | `.ba-col-label`(개선 후) 3.79:1, `.arc-entry-label` 3.56:1, `.footer-link` 계열 | 1.4.3 | 다크 전용 색 지정 |
| 16 | `before-after.html` 다크 | `.footer-legal #58616a` on `#1e2124` 2.57:1, `.footer-link #6d7882` 3.59:1, `.gnb-badge` 1.97:1, 라이트 `.gnb-nav-link` 4.23:1 | 1.4.3 | 토큰 상향 |
| 17 | 루트 `favicon.svg` | 어디에서도 참조되지 않는 구 'K' 아이콘 | 정리 | 삭제 또는 태극 교체 |

> 위 14~16 의 대비 위반 목록은 Playwright 로 각 페이지 텍스트 노드의 실제 전경/배경(알파 합성 포함)을 계산한 결과이며 **전수가 아니라 대표 항목**이다. 배경 이미지·그라디언트 위 텍스트는 계산에서 제외했다.
