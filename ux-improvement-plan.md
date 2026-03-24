# KRDS UX Writing 서비스 — 타이포그래피·레이아웃 개선 계획

> 기준: KRDS v1.0.0 공식 디자인 시스템 | 작성일: 2026-03-23
> 분석 기반: `/tmp/krds_figma_fonts.md` (KRDS 공식 타이포그래피) + `/tmp/krds_ux_analysis.md` (UX Research)
> 대상 파일: `/Users/7457948/KRDS/index.html`

---

## Executive Summary

현재 서비스는 세 가지 구조적 문제로 "정리정돈 안 된 느낌"을 준다.

1. **CDN 불일치**: `pretendard.min.css`(일반판) 로드 중 → 환경에 따라 다른 폰트 렌더링 위험
2. **Line-height 전면 위반**: 9개 요소 모두 KRDS 공식 1.5 위반 (1.25~1.8 혼재) → 수직 리듬 붕괴
3. **비표준값 난립**: `9.5px` 태그(접근성 위반), `13.5px`·`14px` 소수/비표준, 섹션 padding 6종 혼재

예상 개선 효과: P1 완료 시 타이포그래피 일관성 회복 + WCAG 접근성 기준 충족. P2 완료 시 컴포넌트 간 시각적 통일감 달성. P3 완료 시 KRDS 원칙 완전 준수 및 장기 유지보수성 확보.

---

## P1 — 즉시 수정 (Critical, 1~2일)

### P1-1. Pretendard GOV CDN 교체

**문제**: `pretendard.min.css`(일반 Pretendard)를 로드하면서 CSS에는 `"Pretendard GOV"`를 font-family로 선언한다. CDN이 일반 Pretendard를 제공하므로, 운영체제에 Pretendard GOV가 설치되지 않은 환경에서는 시스템 폰트로 폴백된다. 공공기관 서비스로서 전용 폰트 미적용은 공식성을 훼손한다.

**KRDS 기준**: `pretendard-gov.min.css` (공공기관 전용 CDN)

**수정 위치**: `index.html` 20번째 줄

```html
<!-- Before (line 20) -->
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">

<!-- After -->
<link rel="stylesheet" as="style" crossorigin
  href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-gov.min.css">
```

**font-family 변수 보강** (`index.html` 202번째 줄):

```css
/* Before */
--typo-font-family: 'Pretendard GOV', 'Pretendard', 'Noto Sans KR', sans-serif;

/* After — KRDS 공식 fallback 체인 전체 적용 */
--typo-font-family: "Pretendard GOV Variable", "Pretendard GOV",
  -apple-system, BlinkMacSystemFont, system-ui, Roboto,
  "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo",
  "Noto Sans KR", "Malgun Gothic",
  "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
```

---

### P1-2. body line-height 전체 통일 (1.5)

**문제**: 현재 `body`의 `line-height: 1.6`을 시작으로, 9개 요소 모두 KRDS 공식 150%(1.5)를 벗어난다. 이것이 섹션마다 텍스트 밀도가 달라 보이는 수직 리듬 붕괴의 핵심 원인이다.

**KRDS 기준**: 모든 텍스트 요소 `line-height: 1.5` (150% 고정, WCAG 1.4.12 준수)

**수정 대상 전체 목록**:

| 요소 | 현재 | 수정 후 | 위치 (줄 번호) |
|------|------|---------|--------------|
| `body` | `1.6` | `1.5` | line 368 |
| `.hero-title` | `1.25` | `1.5` | line 816 |
| `.section-title` (미디어쿼리 재선언) | `1.3` | `1.5` | line 2305 |
| `.guideline-title` | `1.3` | `1.5` | line 1383, 2237 |
| `.guideline-desc` | `1.8` | `1.5` | line 1391, 2238 |
| `.section-desc` | `1.7` | `1.5` | line 443 |
| `.rule-text` | `1.75` | `1.5` | line 1522, 2253 |
| `.verdict-text` | `1.75` | `1.5` | line 2248 |
| `.copy-text` (`.copy-example` 내부) | `1.65` | `1.5` | line 1550 |

**일괄 수정 방법** — CSS 최상단 `:root` 또는 `*` 셀렉터에 기본값 추가 후 예외만 개별 수정:

```css
/* :root에 기본값 추가 (line 200 근처) */
:root {
  --line-height-base: 1.5; /* KRDS 표준 150% */
}

/* body 수정 (line 368) */
/* Before */  line-height: 1.6;
/* After  */  line-height: var(--line-height-base);

/* .hero-title 수정 (line 816) */
/* Before */  line-height: 1.25;
/* After  */  line-height: var(--line-height-base);

/* .section-title 수정 (line 2305 미디어쿼리 블록) */
/* Before */  line-height: 1.3;
/* After  */  line-height: var(--line-height-base);

/* .guideline-title 수정 (line 1383) */
/* Before */  line-height: 1.3;
/* After  */  line-height: var(--line-height-base);

/* .guideline-desc 수정 (line 1391) */
/* Before */  line-height: 1.8;
/* After  */  line-height: var(--line-height-base);

/* .section-desc 수정 (line 443) */
/* Before */  line-height: 1.7;
/* After  */  line-height: var(--line-height-base);

/* .rule-text 수정 (line 1522) */
/* Before */  line-height: 1.75;
/* After  */  line-height: var(--line-height-base);

/* .verdict-text 수정 (line 2248) */
/* Before */  line-height: 1.75;
/* After  */  line-height: var(--line-height-base);
```

> 주의: 미디어쿼리 블록(line 2235~2310)에 중복 선언된 `.guideline-title`, `.section-title` 등도 동일하게 수정해야 한다.

---

### P1-3. 비표준 폰트 크기 교정 (접근성 포함)

**문제**: KRDS 타입 스케일 외부의 임의 값이 다수 사용된다. 특히 `9.5px`은 WCAG 최소 기준(13px)에 크게 못 미쳐 접근성 위반이다.

**KRDS 타입 스케일 매핑표**:

| 현재 클래스 | 현재 값 | KRDS 공식 대응 | 수정 후 값 | 위치 |
|-----------|--------|--------------|-----------|------|
| `.guideline-tag` | `9.5px` | `body-xsmall` → label-xsmall | `13px` | line 2235 |
| `.guideline-num` | `10.5px` | `body-xsmall` | `13px` | line 2236 |
| `.section-eyebrow` | `12px` | `body-xsmall` | `13px` | line 2304 |
| `.guideline-desc` | `14px` | `body-small` | `15px` | line 2238 |
| `.rule-text` | `13.5px` | `body-xsmall` | `13px` | line 2253 |
| `.verdict-text` | `13.5px` | `body-xsmall` | `13px` | line 2248 |
| `.guideline-card-badge` | `11px` | `label-xsmall` | `13px` | 별도 확인 |

**수정 코드** (미디어쿼리 블록 line 2235~2253):

```css
/* Before (line 2235) */
.guideline-tag { font-size: 9.5px; font-weight: 700; ... }

/* After */
.guideline-tag { font-size: 13px; font-weight: 700; ... }
```

```css
/* Before (line 2236) */
.guideline-num { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; ... }

/* After */
.guideline-num { font-family: 'JetBrains Mono', monospace; font-size: 13px; ... }
```

```css
/* Before (line 2238) */
.guideline-desc { font-size: 14px; color: var(--text-secondary); ... }

/* After — KRDS body-small */
.guideline-desc { font-size: 15px; color: var(--text-secondary); ... }
```

```css
/* Before (line 2248) */
.verdict-text { font-size: 13.5px; ... }

/* After — KRDS body-xsmall */
.verdict-text { font-size: 13px; ... }
```

```css
/* Before (line 2253) */
.rule-text { font-size: 13.5px; ... }

/* After — KRDS body-xsmall */
.rule-text { font-size: 13px; ... }
```

```css
/* Before (line 2304) */
.section-eyebrow { font-size: 12px; ... }

/* After — KRDS body-xsmall (최소 기준) */
.section-eyebrow { font-size: 13px; ... }
```

---

### P1-4. guideline-title 폰트 교체 (Noto Serif → Pretendard GOV)

**문제**: `guideline-title`이 `var(--font-serif)` = `Noto Serif KR`을 사용한다 (line 2237). KRDS 단일 서체 원칙 위반이며, 정부 서비스의 공식성·신뢰감과 방향이 다르다.

**KRDS 기준**: 국문+영문 모두 `Pretendard GOV` 단일 패밀리

```css
/* Before (line 2237) */
.guideline-title { font-family: var(--font-serif); font-size: clamp(22px, 2.8vw, 30px); ... }

/* After */
.guideline-title { font-family: var(--font-main); font-size: 24px; ... }
```

> `font-size: clamp(22px, 2.8vw, 30px)`도 함께 24px(heading-medium) 고정값으로 교체한다 (아래 P1-5 참고).

---

### P1-5. clamp() 유동 폰트 크기를 KRDS 고정값으로 교체

**문제**: heading 크기를 `clamp()`로 뷰포트 너비에 따라 유동적으로 변경한다. 화면 크기에 따라 타이포그래피 위계가 달라져 일관성이 무너진다. KRDS는 명확한 breakpoint에서 고정 크기 전환 방식을 사용한다.

**수정 대상**:

```css
/* Before (line 269~272) */
--text-hero: clamp(36px, 5vw, 52px);
--text-xl:   clamp(28px, 4vw, 40px);
--text-lg:   clamp(22px, 3.5vw, 32px);
--text-md:   clamp(18px, 2.5vw, 24px);

/* After — KRDS PC 고정값 (모바일은 @media로 별도 처리) */
--text-hero: 3.6rem;  /* 36px = display-small (PC 기본) */
--text-xl:   4rem;    /* 40px = heading-xlarge */
--text-lg:   3.2rem;  /* 32px = heading-large */
--text-md:   2.4rem;  /* 24px = heading-medium */
```

**모바일 반응형 추가** (기존 `@media (max-width: 768px)` 블록 안):

```css
@media (max-width: 768px) {
  :root {
    --text-hero: 2.8rem; /* 28px = display-small mobile */
    --text-xl:   2.8rem; /* 28px = heading-xlarge mobile */
    --text-lg:   2.4rem; /* 24px = heading-large mobile */
    --text-md:   2.2rem; /* 22px = heading-medium mobile */
  }
}
```

---

## P2 — 단기 개선 (Major, 1주일)

### P2-1. 섹션 padding 표준화 (80px 통일)

**문제**: 섹션 padding에 `60px`, `80px`, `96px` 세 가지 값이 혼재한다. 섹션 간 리듬이 불규칙해 콘텐츠 흐름이 어색하다.

**KRDS 기준**: `--space-20: 8rem` (80px) = 섹션 표준 간격

**현재 → 수정 대상 목록**:

| 클래스 | 현재 padding | 수정 후 | 위치 |
|-------|------------|--------|------|
| `.section` | `var(--gap-xl)` = 80px | 유지 ✓ | line 404 |
| `.section-sm` | `60px 0` (하드코딩) | `var(--space-16) 0` = 48px | line 408 |
| `.persona-section` | `96px 0` | `var(--space-20) 0` = 80px | line 1002 |
| `.composition-section` | `96px 0` | `var(--space-20) 0` = 80px | line 1203 |
| `.checklist-section` | `96px 0` | `var(--space-20) 0` = 80px | line 1684 |

```css
/* Before (line 407-409) */
.section-sm {
  padding: 60px 0;
}

/* After */
.section-sm {
  padding: var(--space-16) 0; /* 48px — 소규모 섹션용 */
}

/* Before (line 1001-1003) */
.persona-section {
  padding: 96px 0;
}

/* After */
.persona-section {
  padding: var(--space-20) 0; /* 80px = KRDS --space-20 */
}

/* Before (line 1202-1204) */
.composition-section {
  padding: 96px 0;
}

/* After */
.composition-section {
  padding: var(--space-20) 0;
}

/* Before (line 1683-1685) */
.checklist-section {
  padding: 96px 0;
}

/* After */
.checklist-section {
  padding: var(--space-20) 0;
}
```

---

### P2-2. 카드 padding 표준화

**문제**: 카드류 컴포넌트에 6가지 서로 다른 padding 조합이 사용된다. 콘텐츠 섹션에서 "들쭉날쭉한 느낌"의 주요 원인이다.

**KRDS 기준**: 카드 내부 패딩은 `28px 32px` 기준으로 통일, 소형 카드는 `20px 24px`

| 컴포넌트 | 현재 padding | 수정 후 | 위치 |
|---------|------------|--------|------|
| `.comp-card` | `28px 32px` | 유지 ✓ | line 1225 |
| `.guideline-card` | `28px 32px` | 유지 ✓ | line 1400 |
| `.pattern-card` | `22px 24px` | `20px 24px` | line 1617 |
| `.persona-card` | `16px 20px` | `20px 24px` | line 1147~1151 |
| `.do-box` / `.dont-box` | `20px 22px` / `20px 24px` | `20px 24px` (통일) | line 2243~2244 |
| `.info-box` / `.warn-box` | `16px 20px` | `20px 24px` | line 1592~1617 |
| `.copy-example` | `16px 20px` | `20px 24px` | line 1531 |

```css
/* Before (line 2243) */
.do-box { padding: 20px 22px; ... }
.dont-box { padding: 20px 22px; ... }

/* After — 통일 */
.do-box { padding: 20px 24px; ... }
.dont-box { padding: 20px 24px; ... }
```

```css
/* Before (line 1531) */
.copy-example { padding: 16px 20px; ... }

/* After */
.copy-example { padding: 20px 24px; ... }
```

---

### P2-3. Do/Don't border rgba 구버전 값 수정

**문제**: CSS 변수 `--success`, `--error`는 KRDS 공식값으로 업데이트됐지만, `rgba()` 하드코딩 값은 구버전 색상(`rgba(0,179,125,...)`, `rgba(229,72,77,...)`)이 그대로 남아 있다.

**현재 `--success`**: `var(--color-success-50)` = `#228738`
**현재 `--error`**: `var(--color-danger-50)` = `#de3412`

```css
/* Before (line 1437, 1445) */
.do-box  { border: 1px solid rgba(0,179,125,0.15); }   /* 구 #00B37D */
.dont-box { border: 1px solid rgba(229,72,77,0.15); }  /* 구 #E5484D */

/* After — CSS 변수로 교체 */
.do-box  { border: 1px solid color-mix(in srgb, var(--success) 20%, transparent); }
.dont-box { border: 1px solid color-mix(in srgb, var(--error) 20%, transparent); }
```

> `color-mix()` 미지원 브라우저 대응이 필요하다면 아래 대안 사용:
```css
/* 폴백 대안 */
.do-box  { border: 1px solid rgba(34,135,56,0.2); }   /* #228738 at 20% */
.dont-box { border: 1px solid rgba(222,52,18,0.2); }  /* #de3412 at 20% */
```

동일 패턴으로 수정 필요한 위치:
- line 939, 945 (stat 카드 배경 border)
- line 1754 (체크리스트 border)
- line 2268 (`.checklist-complete` border)

---

### P2-4. 버튼 font-size 통일 (KRDS label-medium 17px)

**문제**: `.btn` 기본은 `var(--text-sm)` = 15px, `.btn-white`·`.btn-outline-white`도 15px 하드코딩. KRDS `label-medium` 기준은 17px. 버튼마다 크기가 다르다.

```css
/* Before (line 2272) */
.btn { ... font-size: var(--text-sm); ... }  /* 15px */

/* After — KRDS label-medium */
.btn { ... font-size: var(--text-base); ... }  /* 17px */
```

```css
/* Before (line 1025, 1027) */
.persona-link-btn {
  font-size: var(--text-sm);  /* 15px */
}

/* After */
.persona-link-btn {
  font-size: var(--text-base);  /* 17px */
}
```

> `.persona-link-btn`의 `font-size: 14px` 하드코딩 인스턴스도 함께 수정 (line 1088 근처 확인).

---

### P2-5. 수직 리듬 통일 (섹션 헤더 margin)

**문제**: `.section-header margin-bottom: 48px`이지만, 내부 `.section-title margin-bottom: 12px`, `.guideline-title margin-bottom: 10px`로 섹션마다 제목~콘텐츠 간격이 다르다.

```css
/* Before (line 2237) */
.guideline-title { ... margin-bottom: 10px; }

/* After — section-title과 통일 */
.guideline-title { ... margin-bottom: 12px; }

/* Before (line 1383) */
.guideline-title {
  ...
  margin-bottom: ...; /* 기존 값 확인 후 */
}

/* After */
.guideline-title {
  margin-bottom: var(--space-7); /* 12px = --space-7 */
}
```

---

## P3 — 장기 개선 (Minor, 1~2주)

### P3-1. Noto Serif KR 완전 제거

**문제**: 히어로 타이틀(`font-family: var(--font-serif)`)과 `.checklist-title`에 Noto Serif KR이 사용된다. KRDS "국문+영문 모두 Pretendard GOV 단일 패밀리" 원칙 위반.

```css
/* Before (line 265) */
--font-serif: 'Noto Serif KR', serif;

/* After — 변수 자체를 Pretendard GOV로 재정의 (또는 삭제) */
/* --font-serif 변수 사용처를 --font-main으로 교체 */
```

수정 위치:
- line 812: `.hero-title { font-family: var(--font-serif); }` → `var(--font-main)`
- line 858: hero 내 stat 숫자 `font-family: var(--font-serif)` → `var(--font-main)`
- line 2259: `.checklist-title { font-family: var(--font-serif); }` → `var(--font-main)`
- `<link>` 태그에서 Noto Serif KR Google Fonts 로드 제거 (있다면)

---

### P3-2. CSS 변수 네이밍을 KRDS 공식 체계로 전환

**문제**: 현재 `--text-hero`, `--text-xl`, `--text-lg`, `--text-md` 등 자체 네이밍 사용. KRDS 공식 변수명과 불일치로 유지보수 혼란.

**마이그레이션 매핑**:

| 현재 변수 | KRDS 공식 변수명 | 값 |
|---------|----------------|-----|
| `--text-hero` | `--font-size-display-small` | `3.6rem` (36px) |
| `--text-xl` | `--font-size-heading-xlarge` | `4rem` (40px) |
| `--text-lg` | `--font-size-heading-large` | `3.2rem` (32px) |
| `--text-md` | `--font-size-heading-medium` | `2.4rem` (24px) |
| `--text-base` | `--font-size-body-medium` | `1.7rem` (17px) |
| `--text-sm` | `--font-size-body-small` | `1.5rem` (15px) |
| `--gap-xl` | `--space-20` | `8rem` (80px) |
| `--gap-lg` | `--space-16` | `4.8rem` (48px) |

**전환 방법** — 기존 변수를 앨리어스로 유지하면서 점진적 교체:

```css
:root {
  /* 1단계: KRDS 공식 변수 추가 */
  --font-size-body-medium: 1.7rem;
  --font-size-body-small: 1.5rem;
  --font-size-heading-xlarge: 4rem;
  /* ... */

  /* 2단계: 기존 변수를 새 변수의 앨리어스로 전환 */
  --text-base: var(--font-size-body-medium);
  --text-sm: var(--font-size-body-small);
  --text-xl: var(--font-size-heading-xlarge);
}
```

---

### P3-3. 커스텀 컬러 KRDS 팔레트로 교체

**문제**: `--gold`, `--navy`, `--navy-mid` 등 KRDS 외부 브랜드 컬러가 사용된다. KRDS 공식 팔레트(`--color-primary-*` 계열)로 교체 필요.

**매핑 예시**:
```css
/* Before */
--navy: #0C1D38;
--navy-mid: #1A2B4A;

/* After — KRDS primary 계열 사용 */
/* --navy → var(--color-primary-70) 또는 var(--color-primary-80) 확인 후 교체 */
```

---

### P3-4. 그리드 gap 통일

**문제**: 그리드 `gap` 값이 16px, 24px, 40px, 48px 4가지 혼재.

**KRDS spacing 기준 매핑**:

| 현재 gap | KRDS 토큰 | 용도 |
|---------|----------|------|
| `16px` | `--space-8` (1.6rem) | 타이트한 그리드 |
| `24px` | `--space-10` (2.4rem) | 표준 그리드 gap |
| `40px` | `--space-14` (4rem) | 넓은 그리드 |
| `48px` | `--space-16` (4.8rem) | 섹션 내 주요 구분 |

하드코딩된 `gap: 24px`을 `gap: var(--space-10)`으로, `gap: 48px`을 `gap: var(--space-16)`으로 전환.

---

## 변경 요약 체크리스트

### P1 (즉시, 1~2일)
- [ ] P1-1: CDN `pretendard.min.css` → `pretendard-gov.min.css` 교체 (line 20)
- [ ] P1-1: `--typo-font-family` fallback 체인 KRDS 공식 적용 (line 202)
- [ ] P1-2: `body` `line-height: 1.6` → `1.5` (line 368)
- [ ] P1-2: `.hero-title` `line-height: 1.25` → `1.5` (line 816)
- [ ] P1-2: `.section-title` `line-height: 1.3` → `1.5` (line 2305)
- [ ] P1-2: `.guideline-title` `line-height: 1.3` → `1.5` (line 1383, 2237)
- [ ] P1-2: `.guideline-desc` `line-height: 1.8` → `1.5` (line 1391, 2238)
- [ ] P1-2: `.section-desc` `line-height: 1.7` → `1.5` (line 443)
- [ ] P1-2: `.rule-text` `line-height: 1.75` → `1.5` (line 1522, 2253)
- [ ] P1-2: `.verdict-text` `line-height: 1.75` → `1.5` (line 2248)
- [ ] P1-3: `.guideline-tag` `9.5px` → `13px` (line 2235)
- [ ] P1-3: `.guideline-num` `10.5px` → `13px` (line 2236)
- [ ] P1-3: `.section-eyebrow` `12px` → `13px` (line 2304)
- [ ] P1-3: `.guideline-desc` `14px` → `15px` (line 2238)
- [ ] P1-3: `.rule-text` `13.5px` → `13px` (line 2253)
- [ ] P1-3: `.verdict-text` `13.5px` → `13px` (line 2248)
- [ ] P1-4: `.guideline-title` `font-family: var(--font-serif)` → `var(--font-main)` (line 2237)
- [ ] P1-5: `--text-hero/xl/lg/md` clamp() 제거, KRDS 고정값으로 교체 (line 269~272)
- [ ] P1-5: 모바일 반응형 `@media` 블록에 KRDS 고정값 추가

### P2 (단기, 1주일)
- [ ] P2-1: `.section-sm` `60px 0` → `var(--space-16) 0` (line 408)
- [ ] P2-1: `.persona-section` `96px 0` → `var(--space-20) 0` (line 1002)
- [ ] P2-1: `.composition-section` `96px 0` → `var(--space-20) 0` (line 1203)
- [ ] P2-1: `.checklist-section` `96px 0` → `var(--space-20) 0` (line 1684)
- [ ] P2-2: `.do-box`/`.dont-box` padding `20px 22px` → `20px 24px` (line 2243~2244)
- [ ] P2-2: `.copy-example` padding `16px 20px` → `20px 24px` (line 1531)
- [ ] P2-2: `.persona-card` padding `16px 20px` → `20px 24px` (line 1147~1151)
- [ ] P2-3: `.do-box`/`.dont-box` border rgba 구버전 값 KRDS 현재 토큰으로 교체 (line 1437, 1445, 2243, 2244)
- [ ] P2-3: 기타 rgba 구버전 border 값 일괄 교체 (line 939, 945, 1754, 2268)
- [ ] P2-4: `.btn` `font-size: var(--text-sm)` → `var(--text-base)` (line 2272)
- [ ] P2-4: `.persona-link-btn` font-size 17px 통일
- [ ] P2-5: `.guideline-title` `margin-bottom: 10px` → `var(--space-7)` (line 2237)

### P3 (장기, 1~2주)
- [ ] P3-1: `.hero-title`, `.checklist-title` `font-family: var(--font-serif)` → `var(--font-main)`
- [ ] P3-1: `--font-serif` 변수 및 Noto Serif KR 관련 로드 제거
- [ ] P3-2: CSS 변수 KRDS 공식 네이밍으로 점진적 전환
- [ ] P3-3: `--gold`, `--navy` 등 커스텀 컬러 KRDS 팔레트로 교체
- [ ] P3-4: 그리드 `gap` 하드코딩 값 KRDS spacing 토큰으로 전환

---

## 예상 Before / After 시각 효과

### 타이포그래피 수직 리듬
- **Before**: 섹션마다 텍스트 행간이 1.25~1.8 사이를 자유롭게 오가 콘텐츠 밀도가 불규칙. 히어로 텍스트는 너무 좁고, 설명 텍스트는 너무 넓어 한 페이지 안에서 다른 서비스를 보는 느낌.
- **After**: 모든 텍스트가 1.5 행간으로 통일. 글자가 어디에 있든 같은 호흡으로 읽히는 안정감. 섹션 간 전환이 자연스럽게 느껴짐.

### 접근성
- **Before**: `guideline-tag` 9.5px — 대부분의 사용자가 읽으려면 집중해야 할 만큼 작음. WCAG 최소 기준 크게 미달.
- **After**: 13px 이상으로 통일. 시각적 부담 없이 읽힘. 전체 페이지의 시각적 품질이 올라가는 효과.

### 폰트 신뢰성
- **Before**: CDN이 일반 Pretendard를 공급. Pretendard GOV 미설치 환경에서는 시스템 폰트로 폴백. 기관마다 다른 폰트가 보일 수 있음.
- **After**: CDN에서 Pretendard GOV를 직접 공급. 어느 환경에서든 공공기관 전용 폰트로 일관 렌더링.

### 섹션 리듬
- **Before**: 80px, 96px, 60px 섹션이 순서대로 나와 페이지를 스크롤할 때 콘텐츠 간격이 들쭉날쭉.
- **After**: 80px 기준으로 통일. 스크롤 시 일정한 템포로 섹션이 등장해 읽는 흐름이 자연스러워짐.

---

*작성: plan-writer (krds-typo-team) | 2026-03-23*
