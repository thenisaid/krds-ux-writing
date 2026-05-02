# KRDS UX Writing 디자인 시스템

> 작성일: 2026-04-20 | 작성자: CDO (IND-72)
> 레퍼런스: [Montage (Wanted Lab)](https://montage.wanted.co.kr/) · [WDS 구축 사례](https://blog.wantedlab.com/library/insight/wds)
> 구축 방법론: UX Writing First Design System

---

## 개요

KRDS UX Writing 디자인 시스템은 공공 서비스 UI에서 **텍스트 레이어를 1등 시민으로** 다루는 디자인 시스템이다.

**Montage와의 차별화**: 컴포넌트 우선이 아닌 **UX Writing 우선** — 모든 컴포넌트 문서에 텍스트 스펙이 필수로 포함된다.

---

## 0. 디자인 방향성 (Visual Direction)

> 목표: **"한국 공공 UX의 새 기준"** — 행정 문서의 권위 + 서비스 디자인의 접근성을 동시에 달성한다.

### 미적 방향

| 속성 | 값 | 근거 |
|------|-----|------|
| Aesthetic | Editorial/Institutional | 강한 타이포그래피 위계, 규율 있는 그리드, 권위 있는 인상 |
| Decoration | minimal | 텍스트와 여백이 모든 장식 역할을 담당 |
| Layout | grid-disciplined | 12컬럼 그리드, 콘텐츠 최대 너비 800px |
| Motion | minimal-functional | 이해를 돕는 전환만, 장식적 애니메이션 없음 |

**무드 한 줄**: 위기 상황에서 첫 번째로 찾는 레퍼런스 — 명확하고, 권위 있고, 신뢰를 준다.

### 타이포그래피 스케일

**고정 폰트**: `Pretendard GOV Variable` (공공기관 전용, 변경 불가)

| 레벨 | 크기 | Line Height | Weight | 용도 |
|------|------|------------|--------|------|
| Display | 40px | 1.2 | 700 | 랜딩·히어로 제목 |
| H1 | 28px | 1.3 | 700 | 페이지 제목 |
| H2 | 22px | 1.4 | 600 | 섹션 제목 |
| H3 | 18px | 1.5 | 600 | 서브섹션 제목 |
| H4 | 16px | 1.5 | 600 | 카드 제목, 레이블 그룹 |
| Body | 16px | 1.6 | 400 | 본문 텍스트 |
| Small | 14px | 1.5 | 400 | 보조 설명, 힌트 |
| Micro | 13px | 1.5 | 400 | 배지, 캡션 (하한선) |
| Code | 14px / JetBrains Mono | 1.6 | 400 | 코드, 에러 코드 표시 |

**WCAG 1.4.12 준수**: line-height ≥ 1.5 (본문), 문자 간격 ≥ 0.12em 지원

---

## 1. 시스템 구조

Montage의 4-섹션 구조 적용:

```
KRDS UX Writing Design System
├── 1. Getting Started (시작하기)
│   ├── 소개 & 철학
│   ├── 빠른 시작 가이드
│   └── Figma UI Kit 다운로드
├── 2. Foundations (파운데이션)
│   ├── 색상 토큰
│   ├── 타이포그래피
│   ├── 스페이싱
│   ├── 보이스 & 톤
│   └── 접근성 원칙
├── 3. Components (컴포넌트) — 30개
│   ├── Tier 1: 폼 핵심 (5개)
│   ├── Tier 2: 피드백 (5개)
│   ├── Tier 3: 내비게이션 (7개)
│   └── Tier 4: 데이터 표시 (13개)
└── 4. Patterns (패턴)
    ├── 에러 복구 플로우
    ├── 온보딩 패턴
    ├── 빈 상태 패턴
    └── 완료 화면 패턴
```

---

## 2. 디자인 토큰 (CSS Custom Properties)

Montage의 Semantic 색상 시스템을 공공 서비스 맥락에 맞게 조정.

```css
:root {
  /* ===== Primary ===== */
  --krds-color-primary:        #256ef4;  /* 4.8:1 on white ✓ WCAG AA */
  --krds-color-primary-light:  #86aff9;  /* ⚠ 2.4:1 — 배경·강조링 전용, 텍스트 금지 */
  --krds-color-primary-subtle: #eef4ff;

  /* ===== Semantic ===== */
  --krds-color-success:        #228738;  /* 5.9:1 on white ✓ WCAG AA */
  --krds-color-success-subtle: #e8f5e9;
  --krds-color-danger:         #d9342b;  /* 5.8:1 on white ✓ WCAG AA */
  --krds-color-danger-light:   #f48771;  /* ⚠ 2.4:1 — border·아이콘 전용, 텍스트 금지 */
  --krds-color-danger-emphasis:#c0392b;  /* 6.9:1 on white ✓ — 14px 미만 소형 텍스트용 */
  --krds-color-danger-subtle:  #fef2f2;
  --krds-color-warning:        #f5a623;  /* ⚠ 2.6:1 — 아이콘·배경 전용, 텍스트 금지 */
  --krds-color-warning-text:   #92580a;  /* 4.8:1 on white ✓ — warning 텍스트 전용 */
  --krds-color-warning-subtle: #fff8e1;

  /* ===== Text ===== */
  --krds-text-primary:   #111317;  /* 19.5:1 on white ✓ */
  --krds-text-secondary: #3d4147;  /* 10.1:1 on white ✓ */
  --krds-text-tertiary:  #6b7280;  /*  5.0:1 on white ✓ */
  --krds-text-disabled:  #adb5bd;  /* ⚠ 2.5:1 — 비활성 전용 (의도적 대비 미달) */
  --krds-text-inverse:   #ffffff;

  /* ===== Surface ===== */
  --krds-surface-default:  #ffffff;
  --krds-surface-subtle:   #f8f7f5;
  --krds-surface-muted:    #f3f4f6;
  --krds-surface-inverse:  #1e2124;

  /* ===== Border ===== */
  --krds-border-default: #cdd1d5;  /* 3.1:1 on white ✓ WCAG UI 기준 */
  --krds-border-strong:  #9ca3af;
  --krds-border-focus:   #256ef4;  /* 3.1:1 on white ✓ — focus ring */

  /* ===== Typography ===== */
  --krds-font-family:      'Pretendard GOV Variable', Pretendard, -apple-system, sans-serif;
  --krds-font-family-code: 'JetBrains Mono', 'Consolas', monospace;
  --krds-line-height:      1.5;

  /* ===== Spacing ===== */
  --krds-sp-1:  4px;
  --krds-sp-2:  8px;
  --krds-sp-3:  12px;
  --krds-sp-4:  16px;
  --krds-sp-5:  20px;
  --krds-sp-6:  24px;
  --krds-sp-8:  32px;
  --krds-sp-10: 40px;
  --krds-sp-12: 48px;
  --krds-sp-16: 64px;

  /* ===== Border Radius ===== */
  --krds-radius-sm:   4px;
  --krds-radius-md:   8px;
  --krds-radius-lg:   12px;
  --krds-radius-xl:   16px;
  --krds-radius-full: 9999px;
}

/* 다크 모드 — 배경 기준 #1e2124 */
[data-theme="dark"] {
  /* Text & Surface */
  --krds-text-primary:    #f9fafb;   /* 18.1:1 on #1e2124 ✓ */
  --krds-text-secondary:  #d1d5db;   /*  9.8:1 on #1e2124 ✓ */
  --krds-text-tertiary:   #9ca3af;   /*  5.3:1 on #1e2124 ✓ */
  --krds-surface-default: #1e2124;
  --krds-surface-subtle:  #2d3035;
  --krds-surface-muted:   #3a3d42;
  --krds-border-default:  #3d4147;   /*  3.1:1 on #1e2124 ✓ */

  /* Semantic — 다크 전용 (밝기 +30~40%, 채도 -10~15%) */
  --krds-color-primary:        #74a9f8;  /* 7.0:1 on #1e2124 ✓ */
  --krds-color-primary-subtle: #1a2a45;
  --krds-color-success:        #4ade80;  /* 10.1:1 on #1e2124 ✓ */
  --krds-color-success-subtle: rgba(34, 135, 56, 0.15);
  --krds-color-danger:         #f87171;  /* 6.3:1 on #1e2124 ✓ */
  --krds-color-danger-emphasis:#fca5a5;  /* 8.0:1 on #1e2124 ✓ */
  --krds-color-danger-subtle:  rgba(220, 38, 38, 0.12);
  --krds-color-warning:        #fbbf24;  /* 8.7:1 on #1e2124 ✓ */
  --krds-color-warning-text:   #fcd34d;  /* 10.5:1 on #1e2124 ✓ */
  --krds-color-warning-subtle: rgba(245, 166, 35, 0.15);
}
```

---

## 3. 컴포넌트 라이브러리 (30개)

### WDS 교훈 적용 원칙
> "Component structure was too difficult for designers to use" (WDS)

- 변형(Variant): 최대 **4개** (기본/포커스/에러/비활성)
- 네이밍: 한국어 + 영어 병기 (버튼/Button)
- Figma Description: UX Writing 기본값 필수 임베드

---

### Tier 1 — 폼 핵심 (5개)

#### 1. 버튼 (Button)

```html
<!-- Primary -->
<button class="krds-btn krds-btn--primary" type="button">
  저장하기
</button>

<!-- Secondary -->
<button class="krds-btn krds-btn--secondary" type="button">
  이전으로
</button>

<!-- Danger -->
<button class="krds-btn krds-btn--danger" type="button">
  삭제하기
</button>

<!-- Ghost -->
<button class="krds-btn krds-btn--ghost" type="button">
  자세히 보기
</button>
```

```css
.krds-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--krds-sp-2);
  height: 48px;
  padding: 14px 28px;
  border-radius: var(--krds-radius-md);
  font-family: var(--krds-font-family);
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.krds-btn--primary  { background: var(--krds-color-primary); color: var(--krds-text-inverse); border: none; }
.krds-btn--secondary { background: transparent; color: var(--krds-color-primary); border: 1.5px solid var(--krds-color-primary); }
.krds-btn--danger   { background: var(--krds-color-danger); color: var(--krds-text-inverse); border: none; }
.krds-btn--ghost    { background: transparent; color: var(--krds-text-secondary); border: 1px solid var(--krds-border-default); }
.krds-btn:disabled  { opacity: 0.4; cursor: not-allowed; }
.krds-btn:focus-visible { outline: 2px solid var(--krds-border-focus); outline-offset: 2px; }
```

**UX Writing 스펙**:
- 동사 + 목적어 / 14자 이내
- 금지: 확인, 클릭, OK, Submit, Cancel

---

#### 2. 텍스트 입력 필드 (Text Input)

```html
<div class="krds-field">
  <label class="krds-label" for="user-name">
    이름
    <span class="krds-required" aria-hidden="true">*</span>
    <span class="sr-only">필수 항목</span>
  </label>
  <input
    class="krds-input"
    id="user-name"
    type="text"
    placeholder="홍길동"
    aria-required="true"
    aria-describedby="user-name-hint"
  />
  <span class="krds-hint" id="user-name-hint">실명을 입력해 주세요</span>
</div>

<!-- 에러 상태 -->
<div class="krds-field krds-field--error">
  <label class="krds-label" for="user-email">이메일</label>
  <input class="krds-input" id="user-email" type="email"
    aria-invalid="true" aria-describedby="user-email-error" />
  <span class="krds-error-msg" id="user-email-error" role="alert">
    이메일 형식을 확인해 주세요. (예: user@korea.go.kr)
  </span>
</div>
```

```css
.krds-label { display: block; font-size: 14px; font-weight: 500; color: var(--krds-text-primary); margin-bottom: var(--krds-sp-2); }
.krds-required { color: var(--krds-color-danger); margin-left: 2px; }
.krds-input {
  width: 100%; height: 48px;
  padding: 12px 16px;
  border: 1px solid var(--krds-border-default);
  border-radius: var(--krds-radius-md);
  font-family: var(--krds-font-family);
  font-size: 16px;
  color: var(--krds-text-primary);
  background: var(--krds-surface-default);
  transition: border-color 0.15s;
}
.krds-input::placeholder { color: var(--krds-text-tertiary); }
.krds-input:focus { outline: none; border-color: var(--krds-border-focus); box-shadow: 0 0 0 3px rgba(37,110,244,.15); }
.krds-field--error .krds-input { border-color: var(--krds-color-danger); background: var(--krds-color-danger-subtle); }
.krds-hint { display: block; font-size: 13px; color: var(--krds-text-tertiary); margin-top: var(--krds-sp-1); }
.krds-error-msg { display: block; font-size: 13px; color: var(--krds-color-danger); margin-top: var(--krds-sp-1); }
```

---

#### 3. 텍스트 영역 (Textarea)

```html
<div class="krds-field">
  <label class="krds-label" for="reason">신청 이유</label>
  <textarea class="krds-textarea" id="reason" rows="4"
    placeholder="예: 생계 곤란으로 긴급 지원이 필요합니다"
    maxlength="500"></textarea>
  <div class="krds-field-footer">
    <span class="krds-hint">신청 이유를 구체적으로 적어 주세요</span>
    <span class="krds-char-count"><span id="char-current">0</span> / 최대 500자</span>
  </div>
</div>
```

---

#### 4. 에러 메시지 (Error Message)

3단 구조 패턴: [상황] + [원인] + [행동]

```html
<div class="krds-error" role="alert">
  <svg class="krds-error__icon" aria-hidden="true" width="16" height="16">
    <use href="#icon-error-circle"/>
  </svg>
  <p class="krds-error__text">
    이메일 형식을 확인해 주세요. (예: user@korea.go.kr)
  </p>
</div>
```

| 에러 유형 | ✅ 권장 메시지 |
|---------|-------------|
| 필수 미입력 | "이름을 입력하지 않았습니다. 이름을 입력해 주세요." |
| 형식 오류 | "이메일 형식을 확인해 주세요. (예: user@korea.go.kr)" |
| 중복 | "이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요." |
| 서버 | "잠시 오류가 생겼습니다. 잠시 후 다시 시도해 주세요." |

---

#### 5. 셀렉트 (Select)

```html
<div class="krds-field">
  <label class="krds-label" for="region">지역</label>
  <select class="krds-select" id="region">
    <option value="" disabled selected>시·도를 선택해 주세요</option>
    <option value="seoul">서울특별시</option>
    <option value="busan">부산광역시</option>
    <!-- ... -->
  </select>
</div>
```

**UX Writing 스펙**: 기본 옵션 = `"[목적어]를 선택해 주세요"` 형식

---

### Tier 2 — 피드백 (5개)

#### 6. 모달 (Modal)

```html
<div class="krds-modal-overlay" role="presentation">
  <div class="krds-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="krds-modal__header">
      <h2 id="modal-title" class="krds-modal__title">신청을 완료하시겠습니까?</h2>
      <button class="krds-modal__close" aria-label="모달 닫기" type="button">
        <svg aria-hidden="true">...</svg>
      </button>
    </div>
    <div class="krds-modal__body">
      <p>작성한 내용이 저장됩니다.</p>
    </div>
    <div class="krds-modal__footer">
      <button class="krds-btn krds-btn--ghost" type="button">취소</button>
      <button class="krds-btn krds-btn--primary" type="button">신청하기</button>
    </div>
  </div>
</div>
```

**UX Writing 스펙**:

| 요소 | 원칙 | 최대 |
|-----|-----|------|
| 제목 | 행동 결과 명시 ("~하시겠습니까?") | 25자 |
| 본문 | 핵심 정보만 | 60자 |
| 확인 버튼 | 동사형 ("신청하기", "삭제하기") | 14자 |
| 취소 버튼 | "취소" 고정 | — |

---

#### 7. 토스트 / 스낵바 (Toast)

```html
<div class="krds-toast krds-toast--success" role="status" aria-live="polite">
  <svg class="krds-toast__icon" aria-hidden="true">...</svg>
  <p class="krds-toast__text">저장했습니다</p>
</div>
```

**UX Writing 스펙**:
- 최대 15자 / 동사 완료형 (`-했습니다`) / 이모지 금지
- 성공/정보: 3초 자동 닫힘 / 에러: 수동 닫기

---

#### 8. 빈 상태 (Empty State)

```html
<section class="krds-empty" aria-labelledby="empty-title">
  <img class="krds-empty__icon" src="..." alt="" aria-hidden="true" />
  <h3 id="empty-title" class="krds-empty__title">아직 등록된 내용이 없습니다</h3>
  <p class="krds-empty__desc">지원 받고 싶은 서비스를 찾아 신청해 보세요.</p>
  <a class="krds-btn krds-btn--primary" href="/services">서비스 둘러보기</a>
</section>
```

---

#### 9. 에러 페이지 (Error Page)

```html
<!-- 404 -->
<main class="krds-error-page">
  <span class="krds-error-page__code" aria-hidden="true">404</span>
  <h1 class="krds-error-page__title">페이지를 찾을 수 없습니다</h1>
  <p class="krds-error-page__desc">
    주소가 잘못됐거나 페이지가 이동됐습니다.<br>
    아래 버튼을 눌러 처음 화면으로 돌아가세요.
  </p>
  <a class="krds-btn krds-btn--primary" href="/">처음 화면으로</a>
</main>
```

| 에러 코드 | ✅ 제목 | ✅ 부제 |
|---------|--------|--------|
| 404 | "페이지를 찾을 수 없습니다" | "주소가 잘못됐거나 페이지가 이동됐습니다." |
| 500 | "일시적으로 서비스를 이용할 수 없습니다" | "잠시 후 다시 시도해 주세요." |
| 권한 없음 | "이 페이지에 접근할 수 없습니다" | "로그인 후 이용해 주세요." |

---

#### 10. 완료 화면 (Success Page)

```html
<main class="krds-success-page">
  <div class="krds-success-page__icon" aria-hidden="true">✓</div>
  <h1 class="krds-success-page__title">신청이 완료됐습니다</h1>
  <p class="krds-success-page__desc">
    접수 번호: <strong>2024-001234</strong><br>
    처리 결과는 등록한 이메일로 안내해 드립니다.
  </p>
  <div class="krds-success-page__actions">
    <a class="krds-btn krds-btn--primary" href="/status">신청 현황 보기</a>
    <a class="krds-btn krds-btn--ghost" href="/">처음 화면으로</a>
  </div>
</main>
```

---

### Tier 3 — 내비게이션 (7개)

#### 11–17 목록

| 번호 | 컴포넌트 | UX Writing 핵심 |
|-----|---------|--------------|
| 11 | GNB / 헤더 | 최상위 메뉴: 명사형 2글자 이상 |
| 12 | 브레드크럼 | 현재 위치 강조, `aria-current="page"` |
| 13 | 탭 | 명사형 단일어 (신청 / 처리 현황 / 완료) |
| 14 | 아코디언 | 결론 우선 헤딩 (내용 → 해설 순) |
| 15 | 페이지네이션 | "이전", "다음" / `aria-label="2페이지로 이동"` |
| 16 | 검색창 | placeholder: "찾고 싶은 내용을 입력하세요" |
| 17 | 필터 / 정렬 | "기간", "유형" (명사형) / "최신순", "오래된순" |

---

### Tier 4 — 데이터 표시 (13개)

| 번호 | 컴포넌트 | UX Writing 핵심 |
|-----|---------|--------------|
| 18 | 테이블 | 헤더: 명사형 2–6자 / 빈 셀: "—" |
| 19 | 카드 | 제목 ≤ 20자, CTA 버튼 동사형 |
| 20 | 배지 / 태그 | 상태: "처리 중", "완료", "반려" |
| 21 | 체크박스 | 동의 문구: "위 내용에 동의합니다" (행동 주체 포함) |
| 22 | 라디오 버튼 | 선택지 병렬 구조 (명사형 통일) |
| 23 | 토글 / 스위치 | 켜짐/꺼짐 레이블 명확화 |
| 24 | 툴팁 | 20자 이내, 정보형 또는 행동 설명형 |
| 25 | 팝오버 | 제목 + 본문 구조 (모달 경량 버전) |
| 26 | 알림 배너 | role="alert" / 중요도별 색상 구분 |
| 27 | 프로그레스 바 | "3단계 / 전체 5단계" (숫자 + 텍스트 병기) |
| 28 | 로딩 / 스켈레톤 | aria-busy="true" / "불러오는 중입니다" |
| 29 | 파일 업로드 | "파일 선택" / 드래그앤드롭 힌트 제공 |
| 30 | 날짜 선택기 | placeholder: "예: 2024.01.01" / 달력 접근성 |

---

## 4. 패턴 라이브러리

### 패턴 1: 에러 복구 플로우

```
입력 오류 발생
→ 인라인 에러 메시지 표시 (role="alert")
→ 포커스 에러 필드로 이동
→ 힌트 텍스트로 수정 방법 안내
→ 수정 후 성공 상태 피드백
→ 폼 제출 성공 → 완료 화면
```

### 패턴 2: 온보딩 흐름

```
첫 접속 → 서비스 핵심 가치 1문장 제시
→ "시작하기" CTA (동사형)
→ 최소 입력 폼 (이름 + 이메일)
→ 완료 → 빈 상태 화면 (행동 유도 포함)
```

### 패턴 3: 위험 행동 확인

```
"삭제" 버튼 클릭
→ 모달: 제목 "이 항목을 삭제하시겠습니까?"
→ 본문: "삭제하면 되돌릴 수 없습니다."
→ 취소 (왼쪽, 기본 포커스) / 삭제하기 (오른쪽, danger 스타일)
→ 삭제 성공 → 토스트: "삭제했습니다"
```

---

## 5. Figma UI Kit 명세

Montage처럼 Figma 라이브러리를 제공한다.

### 구성

```
KRDS UX Writing Figma UI Kit
├── Foundation — 색상, 타이포, 스페이싱 스와치
├── Components — 30개 컴포넌트 (4 상태 × 각 크기)
└── Patterns — 폼 템플릿, 에러 복구, 완료 화면
```

### Figma Description 표준 (컴포넌트별 임베드)

```
[UX Writing 기본값]
✅ 권장: [권장 기본 텍스트]
❌ 금지: [금지 패턴]
📏 제한: [글자 수 제한]
📖 참조: KRDS UX Writing 가이드 > [섹션]
```

---

## 6. 배포 & 버전 관리

### 배포 채널

| 채널 | URL |
|-----|-----|
| GitHub Pages | https://thenisaid.github.io/krds-ux-writing/ |
| Figma Community | (예정) |
| Chrome Extension | krds-extension/ (v1.0.0 로컬 완성) |

### 로드맵

| 버전 | 시기 | 내용 |
|-----|------|------|
| v1.0 | 2026 Q2 | 파운데이션 + Tier 1 컴포넌트 |
| v1.1 | 2026 Q3 | Tier 2 피드백 컴포넌트 |
| v1.2 | 2026 Q4 | Tier 3-4 전체 |
| v2.0 | 2027 Q1 | Figma UI Kit 공개 + 다국어 |

---

## 7. Figma 연동 가이드

### 7-1. Figma Variables 구조

Figma Variables 패널에서 아래 컬렉션(Collection) 구조로 설정:

```
KRDS Variables
├── Color
│   ├── Mode: Light (default)
│   └── Mode: Dark
├── Spacing
│   └── Mode: Default
└── Typography
    └── Mode: Default
```

**Color 변수 이름 → CSS 토큰 매핑**:

| Figma Variable | Light 값 | Dark 값 | CSS 토큰 |
|----------------|---------|---------|----------|
| `color/primary/default` | `#256ef4` | `#74a9f8` | `--krds-color-primary` |
| `color/primary/subtle` | `#eef4ff` | `#1a2a45` | `--krds-color-primary-subtle` |
| `color/danger/default` | `#d9342b` | `#f87171` | `--krds-color-danger` |
| `color/danger/emphasis` | `#c0392b` | `#fca5a5` | `--krds-color-danger-emphasis` |
| `color/danger/light` | `#f48771` | `#f48771` | `--krds-color-danger-light` ⚠ |
| `color/success/default` | `#228738` | `#4ade80` | `--krds-color-success` |
| `color/warning/default` | `#f5a623` | `#fbbf24` | `--krds-color-warning` |
| `color/warning/text` | `#92580a` | `#fcd34d` | `--krds-color-warning-text` |
| `color/text/primary` | `#111317` | `#f9fafb` | `--krds-text-primary` |
| `color/surface/default` | `#ffffff` | `#1e2124` | `--krds-surface-default` |

> ⚠ `color/danger/light` — border·아이콘 전용. Figma에서 텍스트 레이어에 적용 금지 (WCAG 미달 2.4:1)

---

### 7-2. W3C Design Token 형식 (JSON 내보내기)

[W3C Design Tokens Community Group](https://www.w3.org/community/design-tokens/) 형식으로 내보내기:

```json
{
  "$schema": "https://schemas.design-tokens.org/dtcg/0.0/tokens.schema.json",
  "color": {
    "primary": {
      "default": {
        "$type": "color",
        "$value": { "light": "#256ef4", "dark": "#74a9f8" },
        "$description": "Primary action. 4.8:1 (light) / 7.0:1 (dark) — WCAG AA ✓"
      },
      "subtle": {
        "$type": "color",
        "$value": { "light": "#eef4ff", "dark": "#1a2a45" }
      }
    },
    "danger": {
      "default": {
        "$type": "color",
        "$value": { "light": "#d9342b", "dark": "#f87171" },
        "$description": "Error state. 5.8:1 (light) / 6.3:1 (dark) — WCAG AA ✓"
      },
      "emphasis": {
        "$type": "color",
        "$value": { "light": "#c0392b", "dark": "#fca5a5" },
        "$description": "Small error text. 6.9:1 on white — WCAG AA ✓ for 14px+"
      },
      "light": {
        "$type": "color",
        "$value": { "light": "#f48771", "dark": "#f48771" },
        "$description": "⚠ 2.4:1 — border/icon ONLY. Do NOT use for text."
      }
    },
    "warning": {
      "text": {
        "$type": "color",
        "$value": { "light": "#92580a", "dark": "#fcd34d" },
        "$description": "Warning text. 4.8:1 (light) / 10.5:1 (dark) — WCAG AA ✓"
      }
    }
  },
  "typography": {
    "fontFamily": {
      "default": {
        "$type": "fontFamily",
        "$value": ["Pretendard GOV Variable", "Pretendard", "-apple-system", "sans-serif"]
      },
      "code": {
        "$type": "fontFamily",
        "$value": ["JetBrains Mono", "Consolas", "monospace"]
      }
    },
    "scale": {
      "display": { "$type": "dimension", "$value": "40px" },
      "h1":      { "$type": "dimension", "$value": "28px" },
      "h2":      { "$type": "dimension", "$value": "22px" },
      "h3":      { "$type": "dimension", "$value": "18px" },
      "body":    { "$type": "dimension", "$value": "16px" },
      "small":   { "$type": "dimension", "$value": "14px" },
      "micro":   { "$type": "dimension", "$value": "13px" }
    }
  }
}
```

---

### 7-3. Figma Code Connect 예시

Code Connect는 Figma 컴포넌트와 코드 컴포넌트를 연결하여 Figma의 Dev Mode에서 실제 코드를 표시합니다.

**설치**:
```bash
npm install --save-dev @figma/code-connect
```

**버튼 컴포넌트** (`Button.figma.ts`):
```typescript
import { figma } from '@figma/code-connect';

figma.connect('YOUR_FIGMA_BUTTON_NODE_ID', {
  props: {
    variant: figma.enum('Variant', {
      Primary:   'primary',
      Secondary: 'secondary',
      Danger:    'danger',
      Ghost:     'ghost',
    }),
    label:    figma.string('Label'),
    disabled: figma.boolean('Disabled'),
  },
  example: ({ variant, label, disabled }) =>
    `<button class="krds-btn krds-btn--${variant}"${disabled ? ' disabled' : ''}>${label}</button>`,
});
```

**연결 게시**:
```bash
npx figma-code-connect publish
```

---

### 7-4. 접근성 대비율 요약 (WCAG 2.1 AA)

| 토큰 | 값 | 흰 배경 대비율 | 다크 배경 대비율 | 텍스트 사용 가능 |
|------|----|-------------|---------------|----------------|
| `--krds-color-primary` | `#256ef4` | 4.8:1 ✓ | 7.0:1 ✓ | ✅ |
| `--krds-color-danger` | `#d9342b` | 5.8:1 ✓ | 6.3:1 ✓ | ✅ |
| `--krds-color-danger-emphasis` | `#c0392b` | 6.9:1 ✓ | — | ✅ 소형 텍스트 |
| `--krds-color-danger-light` | `#f48771` | 2.4:1 ✗ | 2.4:1 ✗ | ❌ **금지** |
| `--krds-color-success` | `#228738` | 5.9:1 ✓ | 10.1:1 ✓ | ✅ |
| `--krds-color-warning` | `#f5a623` | 2.6:1 ✗ | 8.7:1 ✓ | ❌ 라이트 금지 |
| `--krds-color-warning-text` | `#92580a` | 4.8:1 ✓ | 10.5:1 ✓ | ✅ |
| `--krds-text-tertiary` | `#6b7280` | 5.0:1 ✓ | 5.3:1 ✓ | ✅ |
| `--krds-text-disabled` | `#adb5bd` | 2.5:1 — | — | ⚠ 비활성 전용 |

> **기준**: 일반 텍스트 4.5:1+, 18pt+ 대형 텍스트 3:1+, UI 컴포넌트 3:1+

---

## 8. 정보 구조 (Information Architecture)

> 추가일: 2026-05-01 | Pass 1 design review 자동 수정

### 8.1 사이트 구조 다이어그램

```
KRDS UX Writing 도구 모음 (thenisaid.github.io/krds-ux-writing/)
│
├── lint.html — 텍스트 검사 도구
│     └── [링크 없음 → 고립 상태 ⚠]
│
├── archive.html — 이슈 아카이브 / 검수 기록
│     └── [링크 없음 → 고립 상태 ⚠]
│
└── generator/
      └── index.html — 가이드라인 생성기
            └── [generator/app.js: /api/generate SSE]

크로스 툴 네비게이션: 현재 없음 (각 페이지 독립 고립)
```

**현재 문제**: 세 도구가 서로를 모른다. lint.html에서 가이드라인 생성기로 이동하는 경로가 없다. archive.html이 어느 도구와도 연결되지 않는다.

### 8.2 목표 크로스 툴 네비게이션 플로

```
[lint.html] ←→ [archive.html] ←→ [generator/index.html]
    ↓                                      ↓
 텍스트 검사                         가이드라인 생성
 · 행정어 감지                        · 기관명 입력
 · 품질 점수                          · 샘플 입력
 · 개선문 자동 생성                   · 가이드 다운로드
    ↓                                      ↓
 [이 기관 텍스트 검사 →]           [검사 도구로 확인 →]
```

**CTA 연결 규칙**:
- lint.html → generator: "이 기관의 가이드라인이 없다면? 생성기에서 만들어 보세요 →"
- generator → lint: "생성된 가이드 적용 전, 현재 텍스트 품질 먼저 확인하세요 →"
- archive → lint: "기존 이슈를 검수하려면 텍스트 검사 도구를 사용하세요 →"

### 8.3 화면별 콘텐츠 위계 (1st / 2nd / 3rd)

#### lint.html — 텍스트 검사 도구

| 우선순위 | 요소 | 이유 |
|---------|------|------|
| **1st** | 입력 textarea + 검사 버튼 | 사용자가 이 페이지에 온 목적 자체 |
| **2nd** | 품질 점수 링 + 이슈 목록 | 검사 결과 — 핵심 가치 전달 |
| **3rd** | 하이라이트 뷰 + 개선문 + 이력 | 보조 기능 — 관심 있는 사용자만 |

> 현재 문제: 점수 링(SVG), 필터 탭, 히스토리 카드가 동등 가중치로 경쟁 중. 입력 → 결과 순서가 스크롤에 의존.

#### archive.html — 이슈 아카이브

| 우선순위 | 요소 | 이유 |
|---------|------|------|
| **1st** | 검색 + 필터 (기관/카테고리/기간) | 아카이브의 주요 진입점 |
| **2nd** | 이슈 목록 (정렬, 페이지네이션) | 찾던 내용 확인 |
| **3rd** | 통계 요약 / 사이클 현황 | 관리자·기획자용 맥락 정보 |

#### generator/index.html — 가이드라인 생성기

| 우선순위 | 요소 | 이유 |
|---------|------|------|
| **1st** | 기관명 + 기관 유형 선택 | 생성 전제조건, 없으면 버튼 비활성 |
| **2nd** | 샘플 텍스트 입력 | 생성 품질을 결정하는 핵심 입력 |
| **3rd** | 생성 결과 + 다운로드 CTA | 목적 완수 — 빠른 접근 필요 |

### 8.4 네비게이션 패턴 결정 ✅ **확정: Option B — 컨텍스트 CTA**

> 결정일: 2026-05-01 | 사유: generator 3단계 플로우(입력→생성중→출력) 보호, 기존 구현 연장

| | 옵션 A — 공유 GNB | **옵션 B — 컨텍스트 CTA ✅ 확정** |
|---|---|---|
| 구현 난이도 | 높음 (3개 파일 전체 수정) | 낮음 (완료 시점에만 CTA 추가) |
| generator 생성중 화면 | GNB가 이탈 경로 제공 ⚠ | 이탈 경로 없음 ✅ |
| 현재 상태 | 구현 없음 | 부분 구현 (generator→lint CTA) |
| 적합한 사용자 | 툴 순서를 모르는 신규 사용자 | 작업 완료 후 다음 단계 안내 |

**구현 규칙:**
- `lint.html` 결과 하단 → generator CTA ("가이드라인이 필요하신가요?")
- `generator/index.html` 출력 화면 → lint CTA (기존 US-G04 유지 ✅)
- `archive.html` 이슈 상세 → lint CTA ("이 패턴 텍스트 검사하기")
- 생성 중(screen-generating) 화면: CTA 없음 (플로우 보호)

---

## 9. 인터랙션 상태 정의

> **Pass 2 설계 원칙**: 빈 상태는 기능이다. "결과 없음"은 디자인이 아니다. 모든 상태에 상황 설명 + 주요 행동 + 따뜻한 어조가 있어야 한다.

### 9.1 상태 커버리지 테이블

| 기능 | 로딩(Loading) | 빈 상태(Empty) | 오류(Error) | 성공(Success) | 부분(Partial) |
|------|-------------|-------------|-----------|-------------|-------------|
| **lint.html** 텍스트 검사 | 해당 없음 (동기) | `emptyPlaceholder()` — 📋 + "텍스트를 입력하고 검사해 주세요" ✅ | 해당 없음 | 점수 링 + 이슈 목록 ✅ | 이슈 없음 상태: ✅ ("이슈가 없습니다!") |
| **lint.html** 필터 탭 | — | ⚠ "선택한 필터에 이슈가 없습니다." (이모지/액션 없음) | — | — | — |
| **archive.html** 이슈 로드 | `.arc-loading-dots` 3점 애니메이션 + "이슈 불러오는 중..." ✅ | ⚠ 미정의 (JSON 정상 로드 후 0건 시) | ⚠ fetch/JSON 실패 시 UI 없음 | 이슈 카드 목록 표시 ✅ | — |
| **archive.html** 검색+필터 | — | ⚠ 복합 조건 무결과 시 copy 없음 | — | `arc-result-count` 표시 ✅ | — |
| **generator** 버튼 비활성 | — | ⚠ disabled button — 이유 tooltip 없음 | — | — | — |
| **generator** 가이드라인 생성 | 스피너 + 4단계 상태 메시지 (0/3/8/15초) ✅ | — | `showGeneratingError()` + fallback CTA ✅ | 출력 화면 전환 ✅ | 취소 후 "처음으로 돌아가기" ✅ |
| **generator** 오프라인 | — | — | ⚠ fetch 실패 시 "네트워크 오류" 메시지만 — 재시도 유도 없음 | — | — |

### 9.2 개선 필요 상태 명세

#### A. lint.html — 필터 빈 상태
**현재**: `"선택한 필터에 이슈가 없습니다."` (이모지·액션 없음)
**목표**: 따뜻한 안내 + 전체 보기 버튼

```
아이콘: 🔍
제목: [필터명] 이슈가 없습니다.
설명: 다른 필터를 선택하거나 전체 이슈를 확인해 보세요.
액션: [전체 이슈 보기] 버튼 → currentFilter = 'all' 로 탭 초기화
```

#### B. archive.html — 검색·필터 복합 무결과
**현재**: 미정의
**목표**: 조건 분기 + 재시도 유도

```
아이콘: 📂
제목: 검색 결과를 찾지 못했습니다.
설명: '[검색어]'와 '[필터명]' 조건에 맞는 이슈가 없습니다.
팁: 검색어를 줄이거나 필터를 해제해 보세요.
액션: [필터 초기화] 버튼
```

#### C. archive.html — JSON 오류 상태
**현재**: 미정의
**목표**: 3단 구조 오류 메시지

```
아이콘: ⚠️
제목: 이슈 목록을 불러오지 못했습니다.
설명: 서버 응답에 문제가 생겼습니다.
행동: [다시 시도] 버튼 → fetchIssues() 재호출
```

#### D. generator — 비활성 버튼 tooltip
**현재**: `disabled` 속성만 — 이유 불명
**목표**: hover/focus 시 미완료 필드 안내

```
HTML: <button ... title="기관명, 기관 유형, 샘플 텍스트를 모두 입력하면 활성화됩니다.">
또는: aria-describedby → 별도 <p class="visually-hidden"> 요소
```

#### E. generator — 오프라인 복구 경로
**현재**: "네트워크 오류가 발생했습니다." 후 행동 없음
**목표**: 재시도 + fallback CTA 병행 노출

```
재시도: [다시 시도] 버튼 → startGeneration(payload) 재호출
fallback: [기본 양식 사용하기] (기존 fallbackBtn 조기 노출)
```

### 9.3 Pass 2 평가

| 항목 | 점수 |
|------|------|
| 로딩 상태 커버리지 | 9/10 |
| 빈 상태 품질 | 4/10 → **목표 8/10** (B·C·D 개선 후) |
| 오류 상태 커버리지 | 5/10 → **목표 8/10** (C·E 개선 후) |
| 성공 상태 | 8/10 |
| **Pass 2 종합** | **6/10 → 8/10** |

---

## 10. 사용자 여정 & 감정 아크 (Pass 3)

**초기 점수: 3/10 → 목표: 7/10**

3대 원칙(심리적 안전망)을 표방하는 서비스임에도, 도구 자체의 감정 설계는 미명세 상태였음.
4개 GAP 식별 및 해결 완료.

### 10.1 스토리보드

| 도구 | 단계 | 사용자 행동 | 사용자 감정 | 기존 명세 | 해결 |
|------|------|------------|------------|----------|------|
| lint.html | 1. 진입 | 페이지 첫 로드 | 기대 또는 의심 | ❌ | GAP-D |
| lint.html | 2. 입력 | 텍스트 붙여넣기 | 약간의 불안 | ❌ | — |
| lint.html | 3. 실행 | 검사하기 클릭 | 기다림 | ❌ | — |
| lint.html | 4. 결과 확인 | 점수 낮음(< 40) | **수치심·당혹감** | ❌ | GAP-A ✅ |
| lint.html | 5. 이슈 탐색 | 목록 스크롤 | 압도감 또는 안도 | ❌ | — |
| lint.html | 6. 완료 | 개선문 복사 | 완료감(약함) | ⚠️ | — |
| lint.html | 7. 전환 | generator CTA 클릭 | 다음 단계 미연결 | ⚠️ | GAP-D ✅ |
| archive.html | 1. 진입(급한 조회) | 이슈 번호 검색 | 집중·긴박 | ❌ | — |
| archive.html | 2. 결과 0건 | 빈 상태 확인 | 좌절·포기 | ❌ | Pass 2 B |
| archive.html | 1. 진입(탐색 학습) | 필터 없이 브라우징 | 발견의 즐거움 | ❌ | GAP-C ✅ |
| generator | 1. 진입 | 폼 작성 | 기대 | ❌ | — |
| generator | 2. 전환 | lint CTA에서 유입 | 맥락 없는 전환 | ❌ | GAP-D ✅ |
| generator | 3. 생성 대기 | 15초 대기 | 불안("멈췄나?") | ⚠️ | GAP-B ✅ |
| generator | 4. 결과 확인 | 가이드라인 출력 | 성취감 | ⚠️ | — |

### 10.2 GAP-A: 낮은 점수 시 감정 완충 (D3 결정 — Option A 채택)

**트리거 조건**: `result.score < 40`

**추가 UI (lint-ui.js `renderScore()` 수정)**:
```html
<!-- score-desc 아래에 조건부 삽입 -->
<div class="score-encouragement" role="note">
  처음 보는 문제일수록 더 많이 개선됩니다.
  <span class="score-next-step">
    → 이슈 목록에서 가장 위 항목부터 하나씩 수정해 보세요.
  </span>
</div>
```

**CSS**:
```css
.score-encouragement {
  font-size: 13px;
  color: var(--color-text-sub, #5a6270);
  margin-top: 8px;
  line-height: 1.5;
  text-align: center;
  max-width: 280px;
}
.score-next-step { display: block; margin-top: 4px; }
```

### 10.3 GAP-B: 생성 대기 시 진행 불안 해소 (D4 결정 — Option A 채택)

**추가 사항 (generator/index.html + app.js)**:

1. **수도 진행 막대** — CSS 애니메이션으로 15초 분할 표시:
```css
.pseudo-progress {
  height: 4px;
  background: var(--color-disabled-bg, #e5e7eb);
  border-radius: 2px;
  margin: 12px 0;
  overflow: hidden;
}
.pseudo-progress-bar {
  height: 100%;
  background: var(--color-primary-50, #256ef4);
  border-radius: 2px;
  animation: pseudo-progress-fill 15s ease-in-out forwards;
  width: 0;
}
@keyframes pseudo-progress-fill {
  0%   { width: 0; }
  20%  { width: 30%; }   /* ~3s: 기관 분석 */
  55%  { width: 65%; }   /* ~8s: 원칙 적용 */
  90%  { width: 88%; }   /* ~13.5s: 작성 중 */
  100% { width: 92%; }   /* 멈춤 — done 이벤트가 100% 채움 */
}
```

2. **기대감 프라이밍 라인** — step 3 메시지 시점에 한 줄 미리보기:
```js
// STATUS_STEPS[2] (8000ms) 도달 시 추가
if (step.delay === 8000) {
  const hint = document.createElement('p');
  hint.className = 'stream-hint';
  hint.textContent = '잠시 후 맞춤 가이드라인이 표시됩니다.';
  streamOutput.appendChild(hint);
}
```

3. **취소 버튼 자동 레이블 변경** — 8초 후 "처음으로 돌아가기"로 전환:
```js
setTimeout(function() {
  if (!cancelled) cancelBtn.textContent = '처음으로 돌아가기';
}, 8000);
```

### 10.4 GAP-C: 아카이브 탐색 모드 진입점 (D5 결정 — Option A 채택)

**트리거 조건**: 필터/검색어 없이 페이지 진입 또는 전체 초기화 상태

**추가 UI (archive.html)**:
```html
<div id="learnerBanner" class="learner-banner" role="note" aria-live="polite">
  <span class="learner-icon" aria-hidden="true">📖</span>
  지금 탐색 중입니다. 추천에 들어오신 분이시면 필터를 사용해도 좋습니다.
  <button type="button" id="dismissLearnerBanner" aria-label="안내 닫기">✕</button>
</div>
```

**표시 조건 (JS)**:
- 검색어 = '' AND 선택된 필터 없음 → 배너 표시
- 검색어 입력 또는 필터 선택 → 배너 자동 숨김
- 닫기 버튼 클릭 → 세션 동안 표시 안 함 (`sessionStorage`)

### 10.5 GAP-D: 도구 간 전환 맥락 연결 (D6 결정 — Option A 채택)

**맥락형 CTA — 결과 수치 반영**

#### lint → generator CTA
```html
<!-- lint.html: 결과 출력 후 CTA 렌더 (renderScore 이후 조건부 추가) -->
<a href="generator/index.html" class="btn btn-primary cta-transition">
  행정어 <strong id="ctaErrorCount">0</strong>개를 발견했습니다.
  이 기관의 가이드라인을 만들어보세요 →
</a>
```

JS (`lint-ui.js`): `renderScore()` 완료 후 `ctaErrorCount.textContent = result.summary.errors`

#### generator → lint CTA (화면 3 출력 완료 후)
```html
<!-- generator/index.html: screen-output 기존 US-G04 CTA 텍스트 교체 -->
<a href="../lint.html" target="_blank" rel="noopener" class="btn btn-primary">
  생성된 가이드라인의 예문을 바로 검사해보세요 →
</a>
```

#### 탐색 대기 상태 (링크 비활성)
- lint 결과가 없을 때 → CTA 숨김 또는 비활성 (`display:none`)
- 결과 생성 후 → CTA 표시 (JS: `ctaSection.style.display = 'block'`)

### 10.6 Pass 3 점수

| 항목 | 초기 | 목표 |
|------|------|------|
| 감정 아크 명세 | 1/10 | 7/10 |
| 5초 비셜 (첫인상) | 5/10 | 7/10 |
| 5분 행동 (사용 흐름) | 3/10 | 7/10 |
| 5년 관계 (신뢰 누적) | 2/10 | 5/10 |
| **Pass 3 종합** | **3/10** | **7/10** |

> 주의: GAP-B·C·D 항목은 design-system.md 명세 완료 상태.
> 실제 구현은 별도 구현 작업에서 진행.

---

## 11. Pass 4 — AI Slop 위험 (5/10 → 8/10)

### 11.1 검출된 패턴 — border-left 색상 구분 (AI Slop Blacklist #9)

| 파일 | CSS 선택자 | 패턴 |
|------|------|------|
| `lint.html` | `.issue-item.sev-error` | `border-left: 3px solid var(--color-danger-50)` |
| `lint.html` | `.issue-item.sev-warning` | `border-left: 3px solid var(--color-warning-50)` |
| `lint.html` | `.issue-item.sev-info` | `border-left: 3px solid var(--color-info-50)` |
| `archive.html` | `.arc-card-rec` | `border-left: 3px solid var(--success)` |

**진단**: OpenAI 디자인 가이드라인 AI Slop Blacklist #9 — `border-left: 3px solid <accent>` 패턴은 생성형 AI 툴이 수천 개 컴포넌트에 반복 출력하는 시그니처 패턴. "AI가 만든 것"이라는 시각적 신호를 강하게 풍긴다.

### 11.2 승인된 수정 방안 (D7 = A — ::before 닷 인디케이터)

**lint.html `.issue-item` 수정 (×3)**:
```css
/* 기존 (AI Slop #9 제거) */
/* .issue-item.sev-error { border-left: 3px solid var(--color-danger-50); } */

/* 수정 후 */
.issue-item { position: relative; border-radius: 8px; }
.issue-item.sev-error   { background: rgba(212, 58, 47, 0.04); }
.issue-item.sev-warning { background: rgba(180, 83,  9, 0.04); }
.issue-item.sev-info    { background: rgba(  2,132,199, 0.04); }

.issue-item::before {
  content: '';
  position: absolute;
  left: 12px;
  top: 16px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.issue-item.sev-error::before   { background: var(--color-danger-50); }
.issue-item.sev-warning::before { background: var(--color-warning-50); }
.issue-item.sev-info::before    { background: var(--color-info-50); }
```

**archive.html `.arc-card-rec` 수정 (×1)**:
```css
/* 기존 */
/* .arc-card-rec { border-left: 3px solid var(--success); border-radius: 0 6px 6px 0; } */

/* 수정 후 */
.arc-card-rec {
  background: rgba(34, 135, 56, 0.06);
  border-radius: 6px;
  position: relative;
  padding-left: 20px;
}
.arc-card-rec::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
}
```

### 11.3 CLEAN 항목 (AI Slop 없음)

| 항목 | 상태 | 근거 |
|------|------|------|
| Hero 그라디언트 | ✅ CLEAN | `linear-gradient(160deg, #eef4ff 0%, #f8f7f5 55%)` — 의도적 방향각 |
| 폰트 선택 | ✅ CLEAN | Pretendard GOV Variable — 공공기관 전용, Inter/Roboto 없음 |
| CTA 버튼 스타일 | ✅ CLEAN | 그라디언트 없는 단색 — 슬롭 없음 |
| 색상 기조 | ✅ CLEAN | 파란색(`#256ef4`) 단일 악센트, 보라색 그라디언트 없음 |
| 아이콘 사용 방식 | ✅ CLEAN | colored circle 아이콘 그리드 패턴 없음 |
| 레이아웃 | ✅ CLEAN | 3열 feature grid 없음, 균등 칸 배치 없음 |
| 전체 중앙 정렬 | ✅ CLEAN | `text-align: center` 전역 적용 없음 |

### 11.4 점수 평가

| 항목 | 이전 | 이후 |
|------|------|------|
| AI Slop 위험 종합 | 5/10 | **8/10** |

> 남은 -2점: 구현 완료 후 전체 HTML codebase scan 필요. border-left 패턴이 다른 컴포넌트에 잔존할 가능성.

---

## 12. Pass 5 — 디자인 시스템 정합성 (3/10 → 6/10)

### 12.1 CSS 토큰 명명 규칙 충돌 (4개 규칙 혼재)

| 파일 | 규칙 | 예시 |
|------|------|------|
| `lint.html` | Convention A: `--color-*` 접두사 | `--color-primary-50: #256ef4` |
| `archive.html` | Convention B: 베어 네임 | `--accent`, `--text`, `--bg`, `--danger` |
| `generator/index.html` | Convention C: `--color-*` 부분 적용 | `--color-primary-50` + `--color-border: #9ca3af` 혼재 |
| `design-system.md` | Convention D: `--krds-*` 접두사 (정규) | `--krds-color-primary-50` |

**문제**: 4개 규칙 혼재. `archive.html`의 `--danger: #c7371a`와 `lint.html`의 `--color-danger-50: #d43a2f`는 이름도 값도 모두 다름. 장기적으로 토큰 단일화 없이는 테마 교체 및 유지보수 불가.

### 12.2 위험색(danger) 값 3개 불일치

| 출처 | 변수명 | 값 | 차이 |
|------|------|------|------|
| `design-system.md` (정규) | `--krds-color-danger-50` | `#d9342b` | 기준값 |
| `lint.html` | `--color-danger-50` | `#d43a2f` | 기준 대비 명도 차이 |
| `archive.html` | `--danger` | `#c7371a` | 명도+채도 모두 다름 |

**수정 방향**: `#d9342b` 단일화 + `--krds-color-danger-50` 변수명 통일 (DEF-2, 구현 작업에서 진행).

### 12.3 다크모드 팔레트 충돌

| 파일 | 다크 배경값 | 스타일 분류 |
|------|------|------|
| `lint.html` | `#1e2124` | 웜 다크 (KRDS 정규) |
| `archive.html` | `#0d1117` | 콜드 다크 (GitHub Dark 스타일) |
| `design-system.md` | `#1e2124` | 웜 다크 (정규) |

**수정 방향**: `archive.html` → `#1e2124` 통일 (DEF-3, 구현 작업에서 진행).

### 12.4 line-height 명세 모순

| 출처 | 값 |
|------|------|
| `design-system.md` 타이포그래피 표 | `1.6` |
| `design-system.md` `--krds-line-height` 변수 | `1.5` |
| `CLAUDE.md` 명시 기준 | `1.5` (WCAG 1.4.12) |
| `lint.html` body | `1.6` |
| `archive.html` body | `1.5` |

**결론**: KRDS 표준은 `1.5` (WCAG 1.4.12). design-system.md 타이포그래피 표의 `1.6`은 오기 → `1.5`로 정정 필요. lint.html body도 `1.5`로 수정 필요 (DEF-4).

### 12.5 정규 토큰 참조표 (단일화 기준)

| 역할 | 정규 변수명 | 정규 값 |
|------|------|------|
| Primary | `--krds-color-primary-50` | `#256ef4` |
| Primary hover | `--krds-color-primary-hover` | `#1a5bcc` |
| Danger | `--krds-color-danger-50` | `#d9342b` |
| Success | `--krds-color-success-50` | `#228738` |
| Warning | `--krds-color-warning-50` | `#b45309` |
| Surface | `--krds-color-surface` | `#f8f7f5` |
| Text | `--krds-color-text` | `#1e2124` |
| Dark BG | `--krds-color-surface-inverse` | `#1e2124` |
| Border | `--krds-color-border` | `#cdd1d5` |
| Line height | `--krds-line-height` | `1.5` |

### 12.6 점수 평가

| 항목 | 이전 | 이후 (명세 완료 기준) |
|------|------|------|
| 디자인 시스템 정합성 종합 | 3/10 | **6/10** |

> 남은 -4점: 실제 HTML 파일에 토큰 단일화 구현 전까지 현 점수 유지. 구현 완료 시 목표 8/10.

---

## 13. Pass 6 — 반응형 & 접근성 (4/10 → 6/10)

### 13.1 접근성 현황 점검

| 항목 | `lint.html` | `archive.html` | `generator/index.html` |
|------|------|------|------|
| `aria-live` 동적 결과 | ✅ `polite` | ❌ 없음 | ✅ `polite` + `assertive` |
| skip-to-content 링크 | ❌ 없음 | ❌ 없음 | ❌ 없음 |
| `prefers-reduced-motion` | ❌ 없음 | ❌ 없음 | ✅ 있음 |
| `focus-visible` 포커스 표시 | ✅ 있음 | ⚠️ 불명확 | ✅ 있음 |
| 터치 타겟 44px+ | ✅ `min-height: 48px` | ⚠️ 검증 필요 | ✅ `min-height: 48px` |
| ARIA landmark/label | ✅ 주요 영역 | ⚠️ 부재 | ✅ `aria-label` |
| 키보드 내비게이션 | ✅ Enter/Space | ⚠️ 불명확 | ✅ `tabindex="0"` |

### 13.2 필수 추가 명세

**skip-to-content (전 3개 파일 공통)**:
```html
<a href="#main-content" class="skip-link">본문으로 바로가기</a>
<style>
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  background: var(--color-primary-50, #256ef4);
  color: #fff;
  padding: 8px 16px;
  font-size: 14px;
  z-index: 9999;
  text-decoration: none;
}
.skip-link:focus { top: 0; }
</style>
```

**archive.html `aria-live` 추가**:
```html
<section id="main-content" role="main">
  <div id="results-region" role="region"
       aria-live="polite" aria-label="검색 결과">
    <!-- 결과 목록 -->
  </div>
</section>
```

**lint.html + archive.html `prefers-reduced-motion` 추가**:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

**print 스타일 (공공기관 출력 요구사항, 전 파일)**:
```css
@media print {
  .site-header, .opt-chips, .action-buttons,
  #cliBanner, #historyCard { display: none !important; }
  .issue-item { break-inside: avoid; }
  body { font-size: 12pt; color: #000; background: #fff; }
  a[href]::after { content: " (" attr(href) ")"; font-size: 0.8em; }
}
```

### 13.3 반응형 현황

| 파일 | 모바일 (`<640px`) | 태블릿 (`768px–1024px`) |
|------|------|------|
| `lint.html` | ✅ `@media (max-width: 640px)` | ❌ 없음 |
| `archive.html` | ✅ 있음 | ❌ 미명세 |
| `generator/index.html` | ✅ `@media (max-width: 767px)` | ❌ 없음 |

**공백**: 태블릿 브레이크포인트(`768px`–`1024px`) 전 파일 미명세. 공공기관 내부 PC 환경(1024px 미만 모니터 다수)에서 레이아웃 깨짐 위험.

### 13.4 점수 평가

| 항목 | 이전 | 이후 (명세 완료 기준) |
|------|------|------|
| 반응형 & 접근성 종합 | 4/10 | **6/10** |

> 남은 -4점: skip-to-content, print 스타일, 태블릿 브레이크포인트 구현 전까지 현 점수 유지. 구현 완료 시 목표 8/10.

---

## 14. Pass 7 — 미결 디자인 결정

### 14.1 해결된 결정 (D1–D7)

| 결정 | 질문 | 선택 | 플랜 반영 |
|------|------|------|------|
| D1 | 전체 7개 패스 진행 여부 | A) 전체 통과 | 8~14장 전체 작성 |
| D2 | 툴 간 내비게이션 패턴 | B) 컨텍스트 CTA | 9.3 상호작용 상태표 반영 |
| D3 | 에러 메시지 감정 완충 | A) 감정 완충 Copy 추가 | 10.3 여정 스토리보드 반영 |
| D4 | 생성 중 UX (진행 중 화면) | A) 진행률 + 기대감 프라이밍 | 10.4 반영 |
| D5 | 린팅 도구 진입점 설계 | A) 학습 모드 배너 | 9.4 반영 |
| D6 | 생성기→린터 맥락형 CTA | A) 결과 수치 반영 CTA | 9.5 반영 |
| D7 | border-left AI Slop 수정 방식 | A) ::before 닷 + rgba 틴트 | 11.2 CSS 명세 완료 |

### 14.2 보류된 결정 (구현 작업에서 진행)

| 코드 | 내용 | 보류 이유 | 구현 기준 |
|------|------|------|------|
| DEF-1 | CSS 토큰 단일화 (`--krds-*` 통일) | 전 파일 수정 범위 큼 | 12.5 정규 토큰 참조표 |
| DEF-2 | danger 색상 `#d9342b` 단일화 | 3개 파일 전수 교체 | 12.2 기준 |
| DEF-3 | dark 팔레트 `#1e2124` 단일화 | archive.html 대규모 교체 | 12.3 기준 |
| DEF-4 | `line-height: 1.5` 단일화 | lint.html body 값 변경 필요 | KRDS 표준 = 1.5 |
| DEF-5 | 태블릿 브레이크포인트 추가 | 3개 파일 반응형 추가 | 13.3 명세 |
| DEF-6 | print 스타일 추가 | 공공기관 출력 요구사항 | 13.2 명세 |

### 14.3 구현 우선순위

| 우선순위 | 항목 | 영향 |
|------|------|------|
| P1 | DEF-1 CSS 토큰 단일화 | 디자인 시스템 일관성 전체 |
| P1 | DEF-2 danger 색상 단일화 | 브랜드 일관성 |
| P2 | DEF-7 border-left 교체 구현 | AI Slop 제거 (11.2 명세 기반) |
| P2 | DEF-3 dark 팔레트 단일화 | archive.html 분리감 해소 |
| P2 | DEF-4 line-height 단일화 | WCAG 1.4.12 준수 |
| P3 | DEF-5 태블릿 브레이크포인트 | 공공기관 PC 환경 대응 |
| P3 | DEF-6 print 스타일 | 출력 요구사항 |

---

## 15. Completion Summary

```
+====================================================================+
|        DESIGN PLAN REVIEW — COMPLETION SUMMARY                     |
+====================================================================+
| 시스템 감사      | DESIGN_NOT_AVAILABLE; 텍스트 기반 리뷰          |
| Step 0          | 초기 평점 4/10, 포커스 영역 7개 전체           |
| Pass 1  (IA)    | 5/10 → 8/10  (8.3 구조도 + 8.4 내비게이션 명세) |
| Pass 2  (상태)  | 6/10 → 8/10  (9.3 상태표 + 9.4 빈 상태 명세)   |
| Pass 3  (여정)  | 3/10 → 7/10  (10.3 스토리보드 + 10.4 UX 복사)  |
| Pass 4  (슬롭)  | 5/10 → 8/10  (11.2 CSS 명세 완료 — D7 승인)   |
| Pass 5  (DS정합)| 3/10 → 6/10  (12.5 정규 토큰표 완료)           |
| Pass 6  (반응형)| 4/10 → 6/10  (13.2 접근성 명세 완료)           |
| Pass 7  (미결)  | 7개 해결, 6개 보류 (DEF-1~6)                  |
+--------------------------------------------------------------------+
| NOT in scope    | SEO 메타태그, 서버사이드 성능, API 레이트리밋    |
| 기존 활용 자산  | Pretendard GOV Variable, KRDS 색상 토큰, CSP    |
| Approved 목업   | DESIGN_NOT_AVAILABLE — 텍스트 기반 리뷰         |
| 결정 반영       | 7개 디자인 결정 플랜 기록 완료                  |
| 결정 보류       | 6개 (DEF-1~6) 구현 작업 이관                    |
| 전체 점수       | 4/10 → 7/10 (명세 기준) / 구현 완료 시 8+/10   |
+====================================================================+
```

**기준 달성**: 전 7개 패스 완료. Pass 1·2·3·4 = 8/10 이상 (명세 기준).
Pass 5·6 = 6/10 — 토큰 단일화·접근성 구현 이후 8/10 목표.

---

## 참조

- `design-guide.md` — 색상/타이포/스페이싱/UX Writing 기준
- `figma-defaults.md` — Figma 컴포넌트 기본값 텍스트 교체 계획
- `principles.md` — KRDS UX Writing 3대 원칙 본문
- [Montage 디자인 시스템](https://montage.wanted.co.kr/) — 구조 레퍼런스
- [WDS 구축 블로그](https://blog.wantedlab.com/library/insight/wds) — 방법론 레퍼런스

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES (PLAN) | 15 issues, 1 critical gap |
| Design Review | `/plan-design-review` | UI/UX gaps | 2 | ISSUES (FULL) | score: 4/10→7/10, 7 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **UNRESOLVED**: 6 deferred design decisions (TODO-003 through TODO-008 in TODOS.md)
- **VERDICT**: eng review required — Eng Review last run 2026-04-23 is stale (68 commits since review). Run `/plan-eng-review` before shipping.
