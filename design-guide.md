# KRDS UX Writing 디자인 가이드

> 작성일: 2026-04-20 | 작성자: CDO (IND-72) | **마지막 갱신: 2026-11-10** (코드 대조 감사)
> 레퍼런스: Montage (Wanted Lab) · WDS 구축 사례
> 적용 대상: 공공기관 웹서비스 디자이너 / 개발자 / UX 라이터
> **토큰 값의 정본은 `DESIGN.md`** 이며, 이 문서는 사람이 읽는 가이드다. 값이 다르면 `DESIGN.md`와 각 HTML의 `:root`를 따른다.

### 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-11-10 | 토큰명·값을 실제 코드 기준으로 교체(§2: `--color-neutral-*`·`--color-border`·`--color-surface-inverse` 등 코드에 없는 토큰 삭제, 시맨틱 토큰으로 대체). 대비율 재계산(§2.2). 컴포넌트 규격을 실측값으로 정정(§4). **로고 시스템 신설(§5)**. 접근성 체크리스트 최신화(§8). 글자 수 기준에 공백 포함/제외 표기(§3.3). 이후 장 번호 +1 |
| 2026-04-20 | 최초 작성 |

---

## 1. 디자인 철학

### 1.1 3대 원칙

**무번역 (No-Translation)**
영어 직수입 없이 한국어로 설계한다.
- 버튼에 `Submit`, `Cancel`, `OK`를 쓰지 않는다
- 메뉴명, 레이블, 알림 모두 한국어가 기본값이다
- 단, 고유명사·약어는 국립국어원 표준을 따른다

**정보핵심화 (Information Distillation)**
사용자가 결정하는 데 필요한 정보만 남긴다.
- 한 화면에 한 가지 주요 행동만
- 결론을 먼저, 근거는 뒤에
- 접기/펼치기로 보조 정보를 관리한다

**심리적안전망 (Psychological Safety)**
실수해도 괜찮다는 신뢰를 설계에 담는다.
- 에러 메시지는 탓하지 않고 안내한다
- 되돌릴 수 없는 행동 전에는 확인을 받는다
- 기다리는 동안 상태를 알려준다

---

## 2. 색상 시스템

### 2.1 핵심 토큰

코드(`index.html` `:root`)에 실제로 존재하는 토큰만 적는다. 전체 목록과 다크 값은 `DESIGN.md` §1–2.

```css
/* Primary */
--color-primary-5:  #ecf2fe;   /* 선택 배경 */
--color-primary-10: #d8e5fd;   /* 호버·태그 배경 */
--color-primary-30: #86aff9;   /* 다크 배경의 accent */
--color-primary-50: #256ef4;   /* CTA, 링크, 포커스 링 */
--color-primary-60: #0b50d0;   /* Hover, 다크 Primary 버튼 배경 */
--color-primary-70: #083891;   /* Active/Pressed */

/* Status */
--color-success-50: #228738;   /* 완료, Do 예시 */
--color-danger-50:  #d9342b;   /* 에러, Don't, 삭제 확인 */
--color-danger-30:  #f48771;   /* 다크 배경의 Don't 강조 */
--color-warning-50: #92580a;   /* 경고 텍스트 (다크에서는 #d08000 으로 재정의) */

/* Gray */
--color-gray-90: #1e2124;      /* 주요 텍스트, 푸터 배경 */
--color-gray-70: #464c53;      /* 소제목 */
--color-gray-50: #6d7882;      /* 보조 텍스트 */
--color-gray-20: #cdd1d5;      /* 강조 경계선 */
--color-gray-10: #e6e8ea;      /* 기본 경계선 */
--color-gray-5:  #f4f5f6;      /* subtle 배경 */
--color-gray-0:  #ffffff;
--color-gray-95: #131416;      /* 다크 페이지 배경 */

/* 시맨틱 (페이지 CSS에서는 이것을 쓴다) */
--bg  --bg-subtle  --text  --text-mid  --text-muted
--border  --border-mid  --accent  --accent-bg
```

> **삭제된 항목**: 이전 판의 `--color-neutral-100/90/70/50/30/10`, `--color-border`, `--color-border-strong`, `--color-surface-inverse`(lint.html 한 곳 제외), `--color-warning-50: #f5a623` 은 현재 코드에 없다. `#f5a623` 은 흰 배경에서 2.03:1 이라 텍스트로 쓸 수 없다.

### 2.2 색상 접근성

대비율은 WCAG 2.1 상대 휘도 공식으로 직접 계산했다(소수 둘째 자리).

| 조합 | 대비율 | 적용 |
|-----|--------|------|
| `--text` #1e2124 on #fff | 16.18:1 | 본문 |
| `--text-mid` #464c53 on #fff | 8.68:1 | 소제목 |
| `--text-muted` #6d7882 on #fff | 4.51:1 (경계) | 보조 텍스트 — **#f4f5f6 위 4.13:1, #f8f7f5 위 4.21:1 로 미달** |
| `--accent` #256ef4 on #fff | 4.55:1 | 링크, 버튼 텍스트 (**#f8f7f5 위 4.25:1 미달**) |
| #fff on `--accent` #256ef4 | 4.55:1 | 라이트 Primary 버튼 라벨 |
| #fff on `--color-primary-60` #0b50d0 | 6.83:1 | 다크 Primary 버튼 라벨 |
| `--accent`(다크) #86aff9 on #131416 | 8.35:1 | 다크 링크 |
| #fff on #86aff9 | **2.21:1 ❌** | 다크 accent 위 흰 글자는 금지 → #1e2124 사용 (7.33:1) |

최소 기준: 텍스트 **4.5:1**, UI 컴포넌트·그래픽 **3:1** (WCAG 2.1 AA). 흰 배경이 아닌 곳(`#f4f5f6`, `#f8f7f5`)에서는 같은 색이라도 대비가 낮아지므로 배경별로 다시 확인한다.

### 2.3 상태별 색상

| 상태 | 테두리 | 배경 |
|-----|--------|------|
| 기본 | `--border-mid` | `--bg` |
| 포커스 | `--accent` (2px outline, offset 2px) | `--bg` |
| 에러 | `--color-danger-50` (lint는 `--krds-color-danger`) | 연한 danger 배경 |
| 성공 | `--color-success-50` | 연한 success 배경 |
| 비활성 | `--border` | `--bg-subtle` |

---

## 3. 타이포그래피

### 3.1 폰트 패밀리

```
주요: 'Pretendard GOV Variable'
폴백: 'Pretendard Variable', system-ui, -apple-system, sans-serif
세리프(index.html 히어로 제목 전용): 'Noto Serif KR', Georgia, serif
```

오프라인 앱(`offline-app/`)은 외부 CDN을 쓰지 않는 정책이라 시스템 폰트 스택(`-apple-system, "Malgun Gothic", "Apple SD Gothic Neo"`)을 쓴다. 이는 의도된 예외다.

CDN:
```html
<link rel="stylesheet"
  href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-gov.min.css">
```

### 3.2 타입 스케일

| 역할 | 크기 | 굵기 | line-height | 용도 |
|-----|------|------|-------------|------|
| display | 40px | 700 | 1.2 | 히어로 제목 |
| h1 | 32px | 700 | 1.3 | 페이지 제목 |
| h2 | 24px | 600 | 1.4 | 섹션 제목 |
| h3 | 20px | 600 | 1.4 | 소제목 |
| body-lg | 16px | 400 | 1.6 | 주요 본문 |
| body-md | 15px | 400 | 1.6 | 기본 본문 |
| body-sm | 14px | 400 | 1.5 | 도움말, 보조 |
| label | 14px | 500 | 1.4 | 폼 레이블, 버튼 |
| caption | 13px | 400 | 1.4 | 최소 크기 |

> ⚠️ 기능 텍스트는 13px 미만 금지. 장식 배지·기호(`.gnb-badge` 11px 등)만 예외이며, 목록은 `DESIGN.md` §4.
> 위 표는 **권장 스케일**이다. 실제 페이지의 크기는 파일마다 다르다(예: `index.html` `.hero-title` `clamp(36px,5vw,60px)`, `before-after.html` `.page-hero-title` `clamp(24px,4vw,36px)`). 본문 `line-height`는 index·archive 1.5, before-after·lint 1.6, 모두 1.5 이상이다.

### 3.3 UX Writing 텍스트 길이 기준

글자 수는 **공백 포함**으로 센다. 아래 예시 문구는 모두 이 기준 안에 들어오는지 확인했다(가장 긴 토스트 "인터넷 연결을 확인해 주세요" = 15자, 모달 제목 "자리를 비운 사이 로그인이 끊겼습니다" = 20자, 에러 메시지 최장 = 38자).

| 컴포넌트 | 최대 글자 수 | 근거 |
|---------|------------|------|
| 버튼 레이블 | 14자 | 모바일 1줄 기준 |
| 툴팁 | 20자 | 팝업 가독성 |
| 토스트 메시지 | 15자 | 자동 닫힘 전 독해 시간 |
| 모달 제목 | 25자 | 2줄 방지 |
| 에러 메시지 | 60자 | 3단 구조 포함 |
| 빈 상태 제목 | 20자 | 중앙 배치 기준 |

> 이 표는 UX 라이팅 가이드의 권장치다. `krds-lint.js` 는 이 길이 기준을 자동 검사하지 않는다(코드에서 해당 규칙을 찾지 못함).

---

## 4. 스페이싱 & 레이아웃

### 4.1 스페이싱 스케일 (4px 그리드)

> `sp-*` 는 **권장 스케일의 이름**이며 CSS 변수로 정의되어 있지 않다(코드에서 `--sp-*` 0건). 실제 CSS는 px 값을 직접 쓰고, 레이아웃 변수는 `--container: 1200px`, `--gutter: clamp(20px, 4vw, 48px)` 뿐이다.

| 토큰 | 값 | 용도 |
|-----|-----|------|
| sp-1 | 4px | 아이콘-텍스트 간격 |
| sp-2 | 8px | 인라인 요소 |
| sp-3 | 12px | 소 컴포넌트 내부 |
| sp-4 | 16px | 기본 패딩 |
| sp-5 | 20px | 컴포넌트 간 기본 |
| sp-6 | 24px | 섹션 내 요소 |
| sp-8 | 32px | 컴포넌트 그룹 |
| sp-10 | 40px | 섹션 구분 |
| sp-12 | 48px | 대형 섹션 |
| sp-16 | 64px | 페이지 섹션 |

### 4.2 컴포넌트 규격

CLAUDE.md 기준(버튼 8px · 카드 12px · 배지 4px)과 페이지별 실제 값을 함께 적는다. **페이지마다 다르므로 새 컴포넌트는 CLAUDE.md 기준을 따른다.**

| 컴포넌트 | 기준 (CLAUDE.md) | index.html | before-after.html | lint.html · offline-app |
|---------|-----------------|-----------|-------------------|------------------------|
| 버튼 | radius 8px, padding `14px 28px` | **pill 9999px**, `13px 24px`, 높이 44 | `.lint-btn` 4px / `.seminar-btn` 8px | 8px, `10px 20px` |
| 카드 | radius 12px, padding `22px 26px ~ 28px 32px` | 12px, 32px | 8px, `20px 24px` | 12px |
| 배지 | radius 4px, padding `4px 12px` | 4px, `3px 10px`, 13px | 칩 100px | 4px |

> index.html 버튼이 pill 인 것은 2026-06-24 Mintlify 리디자인(`31ef00a`)에서 도입된 값이다. CLAUDE.md 기준(8px)과 어긋나며 어느 쪽을 정답으로 할지는 결정이 필요하다(`DESIGN.md` §13-6).
> 이전 판의 "입력 필드 48px", "모달 radius 16px / padding 32px", "버튼 Large/Medium/Small 48/40/32px" 은 코드에 대응하는 값이 없어 삭제했다. 실측 입력 필드 높이는 generator 45px, dictionary 44px.

### 4.3 터치 타겟

모든 인터랙티브 요소: 최소 **44×44px** (WCAG 2.5.5, 프로젝트 기준). 실측 현황과 미달 목록은 `DESIGN.md` §7·§13.

GNB 규격 (1280px 실측): 높이 **60px**(index·before-after·lint·archive, `shared/style.css` 계열은 56px), 아이콘 버튼 44×44, 로고 링크 높이 28px.

---

## 5. 로고 시스템

> 2026-11-10 `index.html` 의 GNB·푸터·favicon 에 처음 적용되었다. **다른 페이지는 아직 이전의 'K' 사각 마크**를 쓰고 있으며, 이식 전까지는 `index.html` 만 이 규격의 대상이다. 상세 근거·전체 표는 `DESIGN.md` §9.

### 5.1 구성

```
[ 태극 마크 ]  [ U X W ]
   28×28        14px / 800
    gap 8px
```

- **마크**: 200×200 viewBox 의 태극 원형(반지름 96). 바탕은 빨강, 그 위에 파랑 S자 패스. 파랑이 좌·상단, 빨강이 우·하단에 놓인다.
- **크기**: GNB **28×28px**, 푸터 **20×20px**. 둘 다 SVG 자체가 원형이므로 `border-radius`·배경·테두리를 주지 않는다.
- **워드마크**: `UXW` = **U**X **W**riting. `U`는 파랑, `X`는 본문색, `W`는 빨강. `font-weight:800`, 14px, `letter-spacing:-0.02em`.
- **푸터**: 마크(20px) + 문구 "KRDS UX Writing 가이드라인"(13px). 푸터에는 UXW 워드마크를 쓰지 않는다.

### 5.2 색상 토큰

| 토큰 | 라이트 | 다크 |
|------|--------|------|
| `--logo-blue` | `#003964` | `#8cb6ff` |
| `--logo-red` | `#ed1a3b` | `#ff9bad` |

로고 색은 `--accent`(#256ef4)·`--color-danger-*`(#d9342b)와 **별개 토큰**이다. 서로 대체해 쓰지 않는다. 칠은 `class="logo-fill-blue"` / `"logo-fill-red"`, 워드마크는 `.gnb-logo-wordmark .u` / `.w` 로만 지정하고 색 코드를 직접 쓰지 않는다.

### 5.3 대비율

WCAG 2.1 공식으로 직접 계산(소수 둘째 자리). 마크는 비텍스트 그래픽이라 3:1, 워드마크는 텍스트라 4.5:1 이 기준이다.

| 전경 | 배경 | 대비율 | 판정 |
|------|------|--------|------|
| 라이트 파랑 #003964 | #ffffff | 11.87:1 | ✅ 텍스트·그래픽 |
| 라이트 파랑 #003964 | #f8f7f5 | 11.09:1 | ✅ |
| 라이트 빨강 #ed1a3b | #ffffff | 4.36:1 | 그래픽 ✅ / 텍스트 4.5 ❌ (0.14 부족) |
| 라이트 빨강 #ed1a3b | #f8f7f5 | 4.08:1 | 그래픽 ✅ / 텍스트 ❌ (0.42 부족) |
| 다크 파랑 #8cb6ff | #131416 | 9.00:1 | ✅ |
| 다크 파랑 #8cb6ff | #1e2124 | 7.90:1 | ✅ |
| 다크 빨강 #ff9bad | #131416 | 9.25:1 | ✅ |
| 다크 빨강 #ff9bad | #1e2124 | 8.12:1 | ✅ |

- 라이트의 빨강 `W` 는 4.5:1 에 못 미치지만, 로고타입은 WCAG 1.4.3 의 **로고 예외** 대상이라 위반은 아니다. 대신 `#ed1a3b` 를 본문·링크 텍스트에 쓰는 것은 금지한다. 자동 대비 검사기는 `W` 를 위반으로 보고할 수 있다.
- 마크 내부의 빨강↔파랑 대비는 라이트 2.72:1, 다크 1.03:1 이다. 다크에서는 두 색의 명도가 거의 같아 색상 차와 S자 곡선 형태로만 구분된다. 장식 요소라 허용하나 색각 이상 사용자에게는 약하게 보일 수 있다.

### 5.4 여백 · 최소 크기

| 항목 | 규칙 |
|------|------|
| 마크–워드마크 간격 | 8px (`.gnb-logo{gap:8px}`) |
| 클리어 스페이스 | 마크 지름의 ½ 이상(GNB 28px 마크 → 14px). 현재 GNB 는 좌 20px · 우 24px 로 충족. *코드에 명시된 규칙이 아니라 실측 구조에서 도출한 권장값이다.* |
| 마크 최소 크기 | 20px (푸터에서 쓰는 크기). favicon 만 예외 |
| 워드마크 최소 크기 | 14px / 800. 13px 미만 금지 |

### 5.5 금지 사례

| ❌ 금지 | 이유 |
|--------|------|
| 마크 가로·세로 비율 변경, 회전, 좌우 반전 | 방향(파랑 좌·상, 빨강 우·하)이 정체성 |
| 마크에 `border-radius`·배경색·테두리·그림자 추가 | 원형은 SVG 자체. 이전 'K' 사각 마크 방식 금지 |
| 정해진 토큰 외 색, 또는 `--accent`·`--color-danger-*` 로 대체 | 토큰 분리 |
| 라이트 토큰을 어두운 배경에 표시 (#003964 on #1e2124 = 1.36:1) | 식별 불가 |
| 다크 토큰을 흰 배경에 표시 (#8cb6ff 2.05:1, #ff9bad 1.99:1) | 식별 불가 |
| `X` 를 색칠하거나 `U`/`W` 색을 맞바꾸기, `Uxw`·`UXw` 등 표기 변경 | 고정 표기 |
| 외부 이미지 파일(`<img src>`)로 삽입 | 다크 토큰 전환 불가. 인라인 SVG + CSS 변수만 사용 |
| 한 문서에 같은 `clipPath` id 중복 (GNB `gnbLogoClip`, 푸터 `footerLogoClip`) | 한쪽이 렌더되지 않음 |

### 5.6 접근성 마크업

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

- 마크 SVG 는 장식이므로 `aria-hidden="true"`. 링크의 이름은 `aria-label` 하나가 맡아 스크린 리더가 "유 엑스 더블유"로 읽지 않는다.
- 푸터는 가시 텍스트가 이름을 제공하므로 SVG 에 `aria-hidden="true"` 만 두고 `aria-label` 은 달지 않는다.
- 포커스는 전역 `:focus-visible` (2px `--accent`, offset 2px). 로고 링크에 `outline:none` 금지.
- 클릭 영역 실측 69.3×28px 로 44px 기준에 미달한다. 개선안: `.gnb-logo{min-height:44px}` (`DESIGN.md` §13-7).
- favicon 은 `index.html` 의 data URI(태극, 200×200 viewBox)를 쓴다. 나머지 페이지는 아직 'K' 파랑 원이다.

---

## 6. 컴포넌트 UX Writing 기준

### 6.1 버튼 (Button)

**원칙**: 행동 유도형 동사로 시작, 14자 이내, 목적어 포함

| 유형 | 작성 원칙 | ✅ 예시 | ❌ 금지 |
|-----|---------|--------|--------|
| Primary | 동사 + 목적어 | "신청서 제출하기", "저장하기" | 확인, OK, Submit |
| Secondary | 이전 행동 동사 | "이전으로", "수정하기" | 뒤로, Back |
| Danger | 행동 동사 명시 | "삭제하기", "탈퇴하기" | 삭제, 확인 |
| Ghost | 방향 + 목적어 | "자세히 보기", "더 보기" | 더보기, 클릭 |

### 6.2 폼 레이블 (Form Label)

**원칙**: 명사형 간결 레이블, 행정어 금지, 필수 표시 명확

| ❌ 행정어 | ✅ KRDS 대체어 |
|---------|-------------|
| 성명 | 이름 |
| 거주지 | 주소 |
| 신청 사유 | 신청 이유 |
| 연락처 | 휴대폰 번호 |
| 접수번호 | 접수 번호 |

- 필수 항목: 레이블 우측 `*`(`aria-hidden="true"`) + 입력에 `required` · `aria-required="true"` (generator 의 실제 패턴). `*` 자체에 `aria-label` 을 달지 않는다
- 선택 항목: 레이블 뒤 `"(선택)"` 표기

### 6.3 플레이스홀더 (Placeholder)

**원칙**: 구체적 예시 텍스트, 레이블 반복 금지

| 레이블 | ✅ 권장 플레이스홀더 | ❌ 금지 |
|-------|-----------------|--------|
| 이름 | `홍길동` | "이름을 입력하세요" |
| 이메일 | `예: user@korea.go.kr` | "이메일 주소" |
| 휴대폰 번호 | `예: 01012345678` | "010-0000-0000" |
| 생년월일 | `예: 19900101` | "생년월일 입력" |
| 주소 | `예: 세종대로 110` | "주소를 입력하세요" |

### 6.4 에러 메시지

**원칙**: 3단 구조 — 상황 → 원인 → 행동, 사용자 탓 금지

```
[상황] 무엇이 안 됐는가
[원인] 왜 안 됐는가 (생략 가능)
[행동] 어떻게 해야 하는가
```

| 에러 유형 | ✅ 권장 메시지 |
|---------|-------------|
| 필수 항목 미입력 | "이름을 입력하지 않았습니다. 이름을 입력해 주세요." |
| 이메일 형식 오류 | "이메일 형식을 확인해 주세요. (예: user@korea.go.kr)" |
| 비밀번호 불일치 | "비밀번호가 일치하지 않습니다. 다시 확인해 주세요." |
| 파일 용량 초과 | "파일을 올리지 못했습니다. 10MB 이하 파일만 올릴 수 있습니다." |
| 서버 오류 | "잠시 오류가 생겼습니다. 잠시 후 다시 시도해 주세요." |

❌ 금지: "잘못 입력했습니다", "오류가 발생했습니다", "알 수 없는 오류"

### 6.5 완료 / 피드백 메시지

| 상황 | ✅ 권장 텍스트 | 글자 수 |
|-----|-----------|--------|
| 저장 완료 | "저장했습니다" | 6자 |
| 제출 완료 | "신청서를 제출했습니다" | 11자 |
| 삭제 완료 | "삭제했습니다" | 6자 |
| 복사 완료 | "복사했습니다" | 6자 |
| 연결 오류 | "인터넷 연결을 확인해 주세요" | 15자 |
| 파일 업로드 | "파일을 올렸습니다" | 9자 |

### 6.6 모달 (Modal)

| 모달 유형 | 제목 (최대 25자) | 본문 | 확인 버튼 |
|---------|--------------|------|---------|
| 확인 모달 | "신청을 완료하시겠습니까?" | "작성한 내용이 저장됩니다." | "신청하기" |
| 삭제 확인 | "이 항목을 삭제하시겠습니까?" | "삭제하면 되돌릴 수 없습니다." | "삭제하기" |
| 세션 만료 | "자리를 비운 사이 로그인이 끊겼습니다" | "보안을 위해 30분 이상 미사용 시 자동 로그아웃됩니다." | "다시 로그인" |

### 6.7 빈 상태 (Empty State)

| 상황 | 제목 (최대 20자) | 부제 (최대 40자) |
|-----|--------------|--------------|
| 검색 결과 없음 | "결과를 찾지 못했습니다" | "단어를 짧게 줄여 다시 검색해 보세요." |
| 목록 없음 | "아직 등록된 내용이 없습니다" | (행동 유도 버튼 제공) |
| 알림 없음 | "새 알림이 없습니다" | — |
| 즐겨찾기 없음 | "즐겨찾기가 없습니다" | "자주 이용하는 서비스를 추가해 보세요." |

---

## 7. 보이스 & 톤

### 7.1 어조 스펙트럼 (5단계)

| 레벨 | 어조 | 적용 맥락 |
|-----|-----|----------|
| 1 | 공식적 · 중립 | 법령 안내, 결정 통보 |
| 2 | 정중 · 명확 | 신청 결과, 처리 현황 |
| 3 | 친절 · 안내 | 폼 도움말, 일반 안내 |
| 4 | 따뜻 · 공감 | 에러 복구, 완료 축하 |
| 5 | 친근 · 격려 | 온보딩, 첫 사용 안내 |

**공공 서비스 기본값**: 레벨 **2–3**

### 7.2 경어체 원칙

| 상황 | ✅ 어미 | ❌ 금지 |
|-----|--------|--------|
| 안내 (일반) | "-해 주세요" | "-하십시오", "-하세요" |
| 오류 안내 | "-해 주세요" | "-하셔야 합니다" |
| 완료 알림 | "-했습니다" | "-되었습니다" (피동) |
| 결정 통보 | "-입니다" | "-입니다요" |

### 7.3 주어 생략 원칙

공공 서비스 UI에서는 사용자 주어를 생략하거나 2인칭 사용을 최소화한다.

| ❌ 주어 과용 | ✅ 주어 생략/최소화 |
|-----------|----------------|
| "귀하의 신청서가 제출되었습니다" | "신청서를 제출했습니다" |
| "고객님의 비밀번호가 틀렸습니다" | "비밀번호가 일치하지 않습니다" |
| "사용자가 입력한 이메일이 잘못됐습니다" | "이메일 형식을 확인해 주세요" |

---

## 8. 접근성 텍스트

### 8.1 필수 ARIA 속성

| 컴포넌트 | 필수 속성 |
|---------|---------|
| 아이콘 전용 버튼 | `aria-label="[동작 설명]"` |
| 폼 필드 | `id` + `<label for>` 연결 |
| 체크박스 (커스텀) | `role="checkbox"`, `aria-checked`, `tabindex="0"` |
| 모달 | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`(또는 `aria-label`) + 포커스 트랩 |
| 에러 알림 | `role="alert"` |
| 상태 알림 | `role="status"`, `aria-live="polite"` |
| 로딩 | `aria-busy="true"`, `aria-live="polite"` |
| 로고 링크 | 링크에 `aria-label`, 장식 SVG 에 `aria-hidden="true"` (§5.6) |
| 필수 입력 | `required` + `aria-required="true"`, 표시용 `*` 는 `aria-hidden="true"` |

### 8.2 스크린 리더 전용 텍스트

```css
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}
```

예시:
```html
<!-- 필수 항목 표시: * 는 장식, 의미는 required/aria-required 가 전달 -->
<label for="name">이름 <span class="required-mark" aria-hidden="true">*</span></label>
<input id="name" required aria-required="true">

<!-- 복사 완료 알림 -->
<span role="status" class="sr-only">복사했습니다</span>
```

---

### 8.3 접근성 체크리스트 (2026-11-10 기준)

각 항목은 코드에서 직접 확인했다. 실측 표와 파일별 미달 목록은 `DESIGN.md` §7·§12.3·§13.

| 항목 | 기준 | 상태 |
|------|------|------|
| 터치 타겟 | 44×44px 이상 | index `.btn`·`.gnb-icon-btn` ✅, before-after ✅(`.lint-btn` 43.5px). 미달: lint `.btn` 36px, 오프라인 앱 버튼 39.5px, 확장 팝업 30px, `shared/style.css` 아이콘 버튼 28px, 로고 링크 28px |
| `prefers-reduced-motion` | 전환·애니메이션이 있는 페이지는 `transition-duration`/`animation` 무력화 | index·before-after(전역 `*` 규칙) ✅, lint·archive·generator·확장 `content.css` ✅(요소별 규칙), prompt-library는 `.pl-*` 3개 요소만 부분 적용. 전환이 있는데 규칙이 없는 곳: corpus, dictionary/*, case-studies, ontology-query, term-graph, `shared/style.css`(principles/* 전체), 확장 popup. 오프라인 앱은 전환 자체가 없어 불필요 |
| `:focus-visible` | `outline: 2px solid var(--accent); outline-offset: 2px` | 정본 4파일 ✅, `shared/style.css` 전역 규칙으로 principles/*·prompt-library ✅, generator ✅. 없음: corpus, dictionary/*, case-studies, 오프라인 앱, 확장 popup 버튼(브라우저 기본 링) |
| `outline:none` 대체 | 포커스를 제거하면 `:focus-within` / `box-shadow` 로 반드시 대체 | index `.section-nav-input` ❌ (부모 변화 없음), dictionary·확장 popup ✅ |
| 스킵 링크 | "본문 바로가기" | index·before-after·lint·archive·generator·corpus·dictionary·case-studies·principles/*·prompt-library ✅, ontology-query·term-graph·오프라인 앱 없음 |
| 색상 대비 | 텍스트 4.5:1, UI·그래픽 3:1 | §2.2·§5.3. 소형 muted 텍스트가 `#f4f5f6` 위에서 4.13:1 인 곳이 index.html 에서만 고유 선택자 5종 |
| 최소 폰트 | 13px | 레포 전체 13px 미만 선언은 장식 요소를 포함해 다수이며 정확한 건수는 재집계 필요 |
| 다크모드 폼 컨트롤 | `color-scheme: dark` | index·before-after·generator 만 선언 |

**적용 범위**

| 산출물 | 디자인 시스템 적용 |
|--------|-------------------|
| 웹 사이트(`index.html` 등) | 이 문서의 전체 규칙 |
| Chrome 확장(`krds-extension/`) | 색상값은 `--primary #256ef4` 등으로 복사. Pretendard GOV 는 로딩하지 않아 설치 폰트 또는 시스템 폰트로 표시. 다크모드 없음. 로고는 'K' 아이콘(태극 미적용). 팝업 폭 380px 고정 |
| 오프라인 앱(`offline-app/`) | 카드 12px·버튼 8px·배지 4px·최소 13px 준수. **시스템 폰트 스택**(외부 CDN 금지 정책). 다크모드·로고 없음 |

두 산출물은 웹 사이트의 CSS 를 import 하지 않고 값을 복사해 쓰므로, 토큰이 바뀌면 수동으로 맞춰야 한다.

---

## 9. 금지 패턴 요약

| 금지 유형 | ❌ 예시 | 대체 |
|---------|--------|------|
| 영어 직수입 | Submit, Cancel, Loading | 제출하기, 취소, 불러오는 중 |
| 관료적 어미 | ~하십시오, ~하라 | ~해 주세요 |
| 탓하는 에러 | "잘못 입력했습니다" | "다시 확인해 주세요" |
| 13px 미만 | font-size: 12px (기능 텍스트) | 최소 13px (장식 배지 예외) |
| 빨간 강조 과용 | 모든 주의사항 빨간색 | 맥락별 색상 분리 |
| 이모지 남용 | 🎉완료되었습니다! | 완료 메시지는 텍스트만 |
| 긴 버튼 | "다음 단계로 이동하여 신청서 작성" | "다음으로" (14자 이내) |
| 피동형 남용 | "저장되었습니다" | "저장했습니다" |
| 로고 변형 | 마크 회전·`border-radius` 추가, `X` 색칠 | §5.5 |
| 다크 accent 위 흰 글자 | `#86aff9` 배경 + `#fff` (2.21:1) | `#1e2124` 글자 (7.33:1) |

---

## 참조

- `principles.md` — KRDS UX Writing 3대 원칙 본문
- `figma-defaults.md` — Figma 컴포넌트 기본값 텍스트
- `krds-site-analysis.md` — KRDS 공식 사이트 분석
- `DESIGN.md` — 디자인 토큰 정본(source of truth), 드리프트 감사, '코드 수정 필요' 목록
- `design-system.md` — CSS 토큰 & 컴포넌트 HTML 구조 (2026-04-20 판, 일부 값이 현재 코드와 다름)
- [Montage (Wanted Lab)](https://montage.wanted.co.kr/) — 디자인 시스템 레퍼런스
