# KRDS UX Writing 린터 — 기술 요구사항 문서 (TRD)

> 문서 버전: 0.1 (초안) | 작성일: 2026-11-10 | 대상 저장소: `thenisaid/krds-ux-writing`
> 기준 커밋: `5bb7cac`
> 상태: **초안.** 이 문서가 적는 "현재 상태"는 2026-11-10 기준 코드 열람과 `npm test`(50 파일 / 1373 테스트 통과) 실행 결과이며, `krds-extension/scripts/verify-real-chrome.py`(실제 Chromium E2E)는 이번 작성에서 재실행하지 않았다.
> 공개 범위: 이 파일은 저장소 루트의 **공개 문서**다. 비공개 성격의 근거(PRD 검토 상세, 외부 리서치, 경쟁·정책 해석)는 내부 검토 문서(비공개, 저장소 미포함)에 두며 본문에 옮기지 않는다.

---

## 0. 읽는 법

### 0.1 표기 규칙

| 표기 | 의미 |
|---|---|
| `파일:줄` | 이 워크트리 기준 근거 위치 |
| **확정** | 코드·표준·1차 자료로 확인되어 설계로 확정한 항목 |
| **OPEN** | 미결정. 두 선택지를 병기하고 어느 쪽도 단정하지 않음 (§4.4.5, §4.5.4, §10) |
| **검증 필요** | 외부 자료가 `[검색요약]`·`[2차]` 등급이거나 미확인 항목이어서, 확정 사실로 쓰지 않고 구현 전 재확인이 필요한 사실 |
| P1 / P2 / P3 | 구현 우선순위 (§11) |

### 0.2 요구사항 ID

원 PRD(로컬 설계 문서, 비공개)에서 추출한 R1~R17과, 구현 품질·거버넌스 성격의 R18~R20을 내부 검토 문서(비공개, 저장소 미포함)의 부여 방식 그대로 쓴다. 본 TRD의 요구사항 추적표(§3)는 R1~R17 전부를 다루고, R18~R20은 부록 A에 한 줄씩 둔다.

### 0.3 관련 문서

| 문서 | 용도 |
|---|---|
| `DESIGN.md` | 디자인 토큰·컴포넌트 규격 (팝오버 섹션은 현재 없음 — §6.4) |
| `TESTING.md` | 테스트 철학·계층 |
| `SECURITY.md` | 취약점 신고 경로 |
| `release-manifest.json` | 배포 번들별 허용·금지 경로의 단일 근거 |
| 내부 검토 문서 | PRD ↔ 구현 대조 상세, 외부 표준·정책·도구 조사 (비공개, 저장소 미포함) |

---

## 1. 개요 · 범위 · 용어

### 1.1 목적

공공기관 UX 문구가 KRDS UX Writing 3대 원칙(무번역·정보핵심화·심리적 안전망)을 지키는지 **작성 중에** 점검하고, 사람이 승인한 기관별 예외를 일관되게 적용하며, 승인된 규칙이 원칙 문서와 사전에 되먹임되는 구조를 기술적으로 정의한다.

### 1.2 범위

| 구분 | 내용 |
|---|---|
| 범위 안 | 규칙 엔진, 웹 린터, Chrome 확장 인라인 지적, 오프라인 앱, CLI, Rule Pack, 이벤트 수집·학습 루프 설계, 보안·접근성·배포·테스트 요구 |
| 범위 밖 | 타 기관 CMS 실배포, Chrome Web Store 등록, 맞춤법 교정 엔진, 모바일 반응형(확장), 법률·조달·보안 심사의 결론 |
| 조건부 | AI 판단 경로 — 호스팅 주체가 정해지기 전까지 **설계만** 한다 (§4.4.5 OPEN-1) |

### 1.3 용어

| 용어 | 정의 |
|---|---|
| 규칙 엔진 | `krds-lint.js`의 행정어 사전(런타임 290개 = JSON 283 + 인라인 7)과 패턴 규칙(20개)으로 문구를 판정하는 순수 함수 `KRDSLint.lint()` |
| 인라인 지적 | 입력창 위에 밑줄(mark)을 그리고 클릭 시 팝오버로 문제·근거·대안을 보여주는 UI |
| mirror overlay | `<textarea>` 뒤에 같은 글꼴·크기·패딩의 `div`를 겹쳐 밑줄을 그리는 기법. textarea의 `value`·DOM을 바꾸지 않아 네이티브 undo가 보존됨 (`krds-extension/content.js:47-53,198`) |
| Rule Pack | 기관이 승인한 예외 용어 목록(JSON). 현재 스키마는 `rulepack-schema.js`, 검증은 `rulepack-validator.js` |
| 승인 소비측 | 이미 승인된 Rule Pack을 읽어 린트 결과에 반영하는 쪽 (웹 `lint-ui.js`, 오프라인 `offline-app/app.js`) |
| 학습 루프 | 사용자의 수락/거절/수정 이벤트를 후보 규칙으로 집계 → 사람 검토 → Rule Pack·사전 반영으로 이어지는 파이프라인 (현재 미구현) |
| 4채널 | 웹 린터(`lint.html`), Chrome 확장(`krds-extension/`), 오프라인 앱(`offline-app/`), CLI(`bin/krds-lint`) |

### 1.4 설계 원칙

1. **규칙 엔진이 유일한 기준 판정기다.** AI 판단은 규칙이 못 잡는 항목에 대한 *추가 레이어*이며, 규칙 결과를 대체하지 않는다.
2. **하나의 소스, 여러 채널.** 규칙·사전·Rule Pack 검증기의 원본은 저장소 루트이고 확장·오프라인 앱은 복사본이다. 복사본이 어긋나면 CI가 실패해야 한다 (§8.3).
3. **오프라인판은 기능 자체를 만들지 않는다.** "끄는" 것이 아니라 코드가 없는 것이 제품 경계다 (`offline-app/MANIFEST.md`).
4. **원문은 기본적으로 밖으로 나가지 않는다.** 외부 전송은 사용자 동의 + 최소 범위 + 마스킹을 모두 통과해야 한다.
5. **승인되지 않은 규칙은 적용하지 않는다.** 학습 루프의 출력은 항상 "후보"이며 사람이 승인해야 Rule Pack·사전에 들어간다.

---

## 2. 시스템 구성과 제품 경계

### 2.1 구성 요소

| 구성 요소 | 위치 | 역할 | 규칙 엔진 | Rule Pack | AI | 네트워크 | 이력 저장 | URL 공유 |
|---|---|---|---|---|---|---|---|---|
| 웹 린터 | `lint.html`, `lint-ui.js` | 공개 데모·점검 UI | ✅ | ✅ (`lint-ui.js:887-1018`) | 선택(동의 후). 정적 Pages 배포본에는 `/api`가 없어 로컬 `server.js` 등에서만 동작 — §4.4.5 | 있음 | ✅ 30일 TTL (`lint-ui.js:772`) | ✅ (동의 확인, `lint-ui.js:577`) |
| Chrome 확장 | `krds-extension/` | `lint.html#inputText` 인라인 지적 | ✅ (복사본) | ❌ | ❌ (`permissions: []`) | 없음 | ❌ | ❌ |
| 오프라인 앱 | `offline-app/` | 기관 PC용 데스크톱 점검기 (Electron 셸) | ✅ (`dist/` 복사본) | ✅ (`offline-app/app.js:197-230`) | **없음** | **없음** (`connect-src 'none'`) | **없음** | **없음** |
| CLI | `bin/krds-lint` | CI·일괄 점검 | ✅ (`bin/krds-lint:17`) | ❌ (§4.5.5 갭) | ❌ | 없음 | ❌ | ❌ |
| API | `api/generate.js`, `functions/api/generate.js`, `server.js` | 초안 생성(SSE) | — | — | ✅ | 있음 | — | — |
| Rule Pack | `rulepack-schema.js`, `rulepack-validator.js` | 승인 예외 데이터 모델·검증 | — | — | — | — | — | — |

### 2.2 제품 경계 (확정)

| 경계 | 요구 | 근거 |
|---|---|---|
| 오프라인판 = AI·네트워크·이력·URL 공유 **코드 없음** | 오프라인 앱 번들에 `fetch`/`XMLHttpRequest`/`WebSocket`/`localStorage`/`sessionStorage`/쿼리 공유 코드가 존재하면 안 된다 (현재 부재 확인, 자동 고정은 OFF-1) | `offline-app/MANIFEST.md`, `offline-app/index.html:6-7` |
| 웹 데모와 오프라인판은 **물리적으로 분리 배포** | 오프라인판은 Pages·Vercel 번들에 포함되지 않는다 | `.vercelignore`, `_config.yml`의 `offline-app/` 제외, `release-manifest.json` |
| 확장은 **좁은 호스트 권한** | `host_permissions`는 `lint.html` 3개 URL로 한정, `permissions: []` 유지 | `krds-extension/manifest.json:20-25` |
| AI 호출은 **웹/확장 한정**, 규칙 결과가 항상 1차 | AI 응답이 없거나 실패해도 규칙 결과는 그대로 표시 | §4.4 |

### 2.3 데이터 흐름 (현재)

```
              ┌────────────────────────── 원본(저장소 루트) ──────────────────────────┐
              │ krds-lint.js · jargon-dictionary.js(.json) · rulepack-schema.js · rulepack-validator.js │
              └───────────────┬───────────────────────────────┬──────────────────────┘
        직접 참조             │ 복사 (cmp 동일, 동기화 장치 없음 — §8.3)       │ scripts/build-offline-app.js
   ┌───────────┴───────┐    ┌─┴──────────────────────┐        ┌─────┴─────────────────┐
   │ lint.html (웹)    │    │ krds-extension/lib/    │        │ offline-app/dist/     │
   │ bin/krds-lint(CLI)│    │ (확장 content script)   │        │ (Electron 셸이 로드)   │
   └───────────────────┘    └────────────────────────┘        └───────────────────────┘
```

---

## 3. 요구사항 추적표 (PRD R1~R17 → TRD → 현재 상태 → 테스트)

### 3.1 상태 정의

내부 검토 문서와 동일한 정의: **DONE**(근거 file:line 제시 가능) / **PARTIAL** / **MISSING** / **SUPERSEDED**(후속 결정으로 대상 소멸).

### 3.2 추적표

| ID | 요구사항 | TRD 섹션 | 현재 상태 | 근거 (file:line) | 테스트 현황 → 목표 |
|---|---|---|---|---|---|
| R1 | 기존 확장을 확장(새 에디터 금지) | §4.2 | **DONE** | `krds-extension/manifest.json:20-47` (content_scripts 2개) | 팝업만 자동 테스트(`tests/extension-popup.test.js`) → `content.js` 순수 로직 분리 후 vitest (§8.4) |
| R2 | 기존 자산 재사용 | §2.3, §8.3 | **PARTIAL** | 규칙·사전은 복사본 재사용(`cmp` 동일). `api/generate.js`는 재사용 불가(`api/generate.js:194-196`의 `agencyName/samples` 계약). | 동기화 검증 테스트 없음 → NEW-C (§8.3) |
| R3 | AI 기반 지적(문장 단위 span·근거·대안·신뢰도) | §4.4 | **MISSING** | 확장에 네트워크 호출 0건, `krds-extension/content.js:11-14` 주석("규칙 엔진만 사용") | 없음 → 계약 스파이크의 고정 코퍼스 (§8.5) |
| R4 | 입력창 감지 + 인라인 밑줄 + 팝오버 | §4.2 | **DONE** (textarea 한정) | `content.js:47-53`(overlay), `:158-199`(render), `:201-284`(팝오버), 대상은 `TARGET_SELECTOR = '#inputText'`(`:19`) | 수동 E2E(`krds-extension/scripts/verify-real-chrome.py`)만 → CI 편입 (§8.5) |
| R5 | IME 조합 중 오검사 방지 | §4.2.2 | **MISSING** | `content.js`에 `isComposing`/`compositionstart` 없음, `input`마다 `scheduleLint`(`:85`) | 없음 → P1 구현 + 조합 시나리오 E2E |
| R6 | 수락 시 undo 보존 치환 | §4.2.4 | **DONE** (규칙 alt 한정) | `content.js:252-254`(`setSelectionRange` + `execCommand('insertText')`), 적용 가능 판별 `krds-lint.js:489-505`, 사전 290개 중 **183개**만 적용 가능 | 판별 함수는 `tests/krds-lint.test.js`, 치환 동작은 수동 → 자동화 필요 |
| R7 | 검사 중 미세 로딩 표시 | §4.2.3 | **DONE** | `content.js:55-58,80,136`, `content.css:51-68,124-127` | 없음 |
| R8 | 노출 지적 수 제한 | §4.2.3 | **PARTIAL** | `MAX_MARKS_PER_LINE = 2`(`content.js:21`) — PRD는 "문장당", 구현은 "줄당" | 없음 → 문장 경계 정의 후 단위 테스트 (P3) |
| R9 | 접근성(키보드·live region·비색상 신호·trapFocus) | §4.2.5, §6 | **PARTIAL** | 키보드 `content.js:190,302-310`, live region `:60-64`, 비색상 밑줄 `content.css:35-42`. `aria-modal`·포커스 이동·복귀 없음 | 없음 → 키보드 전용 Playwright 시나리오 |
| R10 | 다크모드 + DESIGN.md 팝오버 섹션 | §6.4 | **PARTIAL** | 확장 CSS가 페이지 토큰을 `var(--x, fallback)`로 소비(`content.css:77-100`). `DESIGN.md`에 팝오버 섹션 없음 | `tests/css-token-contracts.test.js`는 HTML만 대상 → 확장 CSS 대비비 점검 추가 |
| R11 | 팝오버 → `principles` 딥링크 | §4.2.6 | **MISSING** | `content.js`에 `principles`/`href` 참조 없음 | 없음 → 카테고리→URL 매핑 테스트 (앵커 목록 선행 필요) |
| R12 | 폴백 + 실패 모드 4종 | §4.4.4 | **SUPERSEDED / N-A** (확장) | AI 호출이 없어 폴백 대상 없음. 웹 린터의 AI 제안은 별도 경로: 15초 타임아웃·AbortController·429 문구(`lint-ui.js:1069,1081,1102`) | 웹 경로는 `tests/lint-ui.test.js`, 확장은 계약 확정 후 |
| R13 | 확장 → AI 네트워크 경로 | §4.4.5 | **MISSING** (**OPEN-1 의존**) | `manifest.json:20-25`(권한 없음), `api/generate.js:27-33`(확장 origin 미허용), `:168-169`(403) | 없음 → 계약 모의 서버 |
| R14 | 프롬프트 인젝션 격리·UTF-16 오프셋·stale 응답 방지 | §4.4.3 | **MISSING** (**OPEN-1 의존**) | 확장 경로 없음. 웹 경로는 사용자 문구를 구분자 없이 프롬프트에 이어붙임(`api/shared/generate-shared.js:168`) | 없음 → 인젝션 회귀 코퍼스 |
| R15 | 이벤트 스키마(신호 가중·감사·버전) | §4.5.1 | **MISSING** | 스키마·코드 없음. 필드 민감도 분류만 비공개 문서에 있음 | 없음 → 스키마 검증기 + 마스킹 함수 단위 테스트 |
| R16 | 수집처 결정 + dedup | §4.5.2 | **PARTIAL** (결정만, 코드 0) | `chrome.storage` 사용 없음, export UI 없음. 수집처 결정이 문서마다 달라 단일화 필요(§4.5.2) | 없음 → 카운터 dedup 단위 테스트 |
| R17 | 룰 후보 → 사람 검토 → 반영 | §4.5.3, §4.5.4 | **PARTIAL** | MCST 3단계 파이프라인 실존(`scripts/fetch-mcst-terms.js` → `score-mcst-candidates.js` → `apply-mcst-approved.js:30`), 입력은 국립국어원 데이터. 기관 예외는 Rule Pack으로 별도 구현(`rulepack-schema.js:18-34`, `rulepack-validator.js:86-160`) — 두 시스템 사이 연결 없음 | `tests/rulepack-validator.test.js`(검증기만) → 후보 산출·승격 테스트 (**OPEN-2 의존**) |

### 3.3 상태별 집계 (R1~R17)

| 상태 | 개수 | 요구사항 |
|---|---|---|
| DONE | 4 | R1, R4, R6, R7 (R4·R6은 범위 한정) |
| PARTIAL | 6 | R2, R8, R9, R10, R16, R17 |
| MISSING | 6 | R3, R5, R11, R13, R14, R15 |
| SUPERSEDED / N-A | 1 | R12 |
| **합계** | **17** | |

AI 경로 의존 여부: R3·R13·R14는 **OPEN-1**에 의존, R17(출력 타깃)은 **OPEN-2**에 의존한다. 나머지 13개는 두 결정을 기다릴 이유가 없다 (§11).

### 3.4 성공 지표 대응

| 지표 | 현재 | TRD 대응 |
|---|---|---|
| SC-1 인라인 위반 표시 | PARTIAL — 규칙 위반, `lint.html#inputText` 1곳 한정 | 대상 페이지를 `lint.html#inputText`로 명시 정정(§4.2.1). E2E를 CI/릴리스 게이트로 편입(§8.5) |
| SC-2 이벤트의 공유 저장소 수집 | MISSING | 수집처 단일화 후 구현(§4.5.2) |
| SC-3 후보 1건 end-to-end 반영 | MISSING | §4.5.3 후보 산출 → 사람 승인 → `rulepack-validator` 통과 entry 생성까지를 합격 기준으로 둠 |

---

## 4. 모듈별 기술 설계

### 4.1 규칙 엔진 (`krds-lint.js`)

#### 4.1.1 현재 구조 (확정)

| 항목 | 값 | 근거 |
|---|---|---|
| 모듈 형식 | UMD (브라우저 + Node), 외부 의존 없음 | `krds-lint.js` |
| 공개 API | `lint(text, options)`, `formatCLI`, `ADMIN_JARGON`, `PATTERN_RULES`, `isSimpleReplacement`, `version` | `krds-lint.js:605,822-823` |
| 사전 규모 | JSON 283 + 인라인 7 = **런타임 290**, 패턴 규칙 **20** | 직접 실행 확인 (`jargon-dictionary.json` entries 283, `ADMIN_JARGON.length` 290) |
| 적용 가능 판별 | `isSimpleReplacement(alt)`: 20자 이하, `/ + — ( ) ,` 및 개행 없음 → 290개 중 **183개** 통과, 패턴 20개는 전부 불가 | `krds-lint.js:489-505,702` |
| 비산문 마스킹 | 코드·URL 등 비산문 영역을 같은 길이 마스크로 치환해 오프셋 보존 | `krds-lint.js:528` (`maskNonProseRegions`) |
| 이슈 필드 | `line`, `col`, `match`, `severity`, `category/type`, `message`, `suggestion`, `applyable`, `applyText` | `krds-lint.js:643-644,672-673` |

#### 4.1.2 요구사항

| ID | 요구 | 우선순위 |
|---|---|---|
| ENG-1 | 이슈 오프셋은 **UTF-16 코드 유닛** 기준(JS 문자열 인덱스)이며, 이후 AI 응답의 오프셋도 같은 단위로 맞춘다 (R14 선결) | P1 |
| ENG-2 | `lint()`는 순수 함수로 유지한다 — 전역 상태·I/O·시간 의존을 추가하지 않는다 (확장·오프라인·CLI 공유 전제) | 확정 |
| ENG-3 | 모든 이슈에 안정적 `rule_id`를 부여한다 (현재 `category/type`은 표시용 문자열). 학습 루프의 신호 집계와 Rule Pack 예외 범위 지정의 전제 | P2 |
| ENG-4 | 사전 항목에 출처 메타데이터(`source`, `retrievedAt`, `license`)를 둘 수 있는 확장 지점을 마련한다. 국립국어원 용어 데이터는 공공누리 제1유형(출처표시)이므로 `NOTICE`에 출처표시를 유지한다 | P2 |
| ENG-5 | "비공공용어"를 일괄 금지어로 취급하지 않는다. 법정·고유 용어는 Rule Pack 예외로 처리한다 (오탐 방어) | 확정 |

**설계 근거**: 용어 사전 일치 검사는 범용 기능이므로, 엔진의 가치는 사전 크기가 아니라 *컴포넌트 맥락 판정 + 예외 체계 + 오프라인 동작*에 둔다. 따라서 ENG-3(안정 ID)과 ENG-5(오탐 방어)를 사전 확장보다 앞세운다 (배경: 내부 검토 문서, 비공개).

### 4.2 인라인 하이라이트 (Chrome 확장)

#### 4.2.1 범위와 대상 (확정)

- 대상은 `lint.html`의 `#inputText` **1개**다 (`content.js:19`, `manifest.json:28-32`). PRD가 말한 "게시판/입력 폼"은 저장소에 존재하지 않으므로 성공 기준 SC-1은 이 대상을 명시한다.
- contenteditable·리치 에디터는 **미지원**이다 (암묵 결정이었으므로 여기서 명문화). 대상을 넓힐 때는 `host_permissions` 확대가 수반되므로 §5.5의 심사·권한 요구를 먼저 충족해야 한다.
- 렌더링 방식은 textarea **mirror overlay**다. CSS Custom Highlight API는 `<textarea>`의 `value`에 직접 적용할 수 없어 채택하지 않는다 (PRD의 초기 가정은 폐기).

#### 4.2.2 입력 이벤트와 IME (R5 — **확정 설계, P1**)

현재 `input` 이벤트마다 `scheduleLint`가 400ms 디바운스로 검사한다 (`content.js:20,82,85`). 한글 조합 중에는 불완전한 음절이 `value`에 들어오므로 오검사가 생길 수 있다. 실제 발화 양상은 **미실측**(검증 필요).

설계:

```
compositionstart  → composing = true; 진행 중인 디바운스 타이머 취소; 팝오버 닫기
input             → if (event.isComposing || composing) return;   // 조합 중에는 검사 예약 안 함
compositionend    → composing = false; scheduleLint();            // 확정 후 1회 검사
```

- `compositionend`는 브라우저에 따라 마지막 `input` 이전/이후에 오므로 **둘 다 방어**한다 (`isComposing` 플래그 + 자체 플래그).
- 조합 중에는 기존 밑줄을 *유지*한다(지우면 깜빡임). 단, 팝오버 "적용" 버튼은 조합 중 비활성화한다 (stale offset 방지).
- `krds:value-changed`(프로그램적 대입) 이벤트는 조합과 무관하므로 그대로 즉시 `scheduleLint`.

수용 기준: 실제 Chromium에서 한글 조합 중 `mark`가 생성되지 않고, 조합 확정 후 1회만 검사되며, 영문 입력 경로는 회귀하지 않는다 (`verify-real-chrome.py`에 케이스 추가).

#### 4.2.3 렌더링 정확도와 노출 제한

| 항목 | 요구 | 상태 |
|---|---|---|
| 줄바꿈 일치 | mirror와 textarea의 콘텐츠 박스 폭이 같아야 한다. textarea에만 스크롤바가 생기면 줄바꿈이 어긋난다 | **미보정** — `content.css:14`가 `overflow:hidden`이며 `scrollbar-gutter`/폭 보정 없음 |
| 스크롤바 보정 | ① 두 요소에 `scrollbar-gutter: stable` 시도, ② 폴백으로 `offsetWidth - clientWidth - 테두리`를 측정해 mirror 우측 패딩에 반영, ③ `ResizeObserver`로 재측정 | P2 설계 확정. `scrollbar-gutter`는 `overflow:hidden` 박스에서 무시되므로 폴백 ②를 주 경로로 한다 |
| 글꼴·크기 변경 | `document.fonts.ready` 및 글자 크기 설정 변경 후 `syncStyles()` 재호출 | 현재 `resize`·`ResizeObserver`만 구독 (`content.js:87-90`) |
| 끝 줄바꿈 | 하이라이트 레이어가 textarea보다 한 줄 짧아지는 문제 | **처리됨** — `escapeHtml` + 끝 `'\n'` 보정 (`content.js:198`) |
| 노출 제한 | 줄당 2개 (`MAX_MARKS_PER_LINE`) + 겹침 제거 (`content.js:21,178-179`) | 줄 단위는 긴 단락에서 무력 → "문장당" 전환은 문장 경계 정의가 필요하여 **P3** |
| 로딩 표시 | 검사 예약 시 `krds-checking` 표시 (`content.js:80,136`), `prefers-reduced-motion` 대응 (`content.css:124-127`) | **DONE**. 규칙 엔진은 동기 실행이라 현재는 디바운스 구간만 표시 — AI 경로 도입 시 의미 확대 |
| 후속 기술 | `HTMLTextAreaElement.prototype.createValueRange`(OpaqueRange, Chromium 152+) 기능 탐지 시 밑줄 렌더링만 전환 | **검증 필요** (Firefox·Safari 지원, hover/클릭 이벤트 부재 — 클릭 팝오버는 기존 오버레이 유지). P3, 당장 대체하지 않음 |

#### 4.2.4 수락(적용) — undo 보존 치환 (R6, 확정)

- 치환은 `textarea.setSelectionRange(start, end)` 후 `document.execCommand('insertText', false, applyText)`로 수행한다 (`content.js:252-254`). `value` 직접 대입은 undo 스택을 깨므로 **금지**한다.
- 치환 직전 `textarea.value.slice(start, end) === issue.match` 재검증으로 stale offset을 막는다 (`content.js:248-251`). 텍스트가 바뀌면 `scheduleLint`가 팝오버를 즉시 닫는다 (`:79`).
- `execCommand`는 deprecated이므로 대체 경로를 **추적**한다: 지원 중단 징후가 있으면 `InputEvent('beforeinput')` 합성은 undo를 보장하지 않으므로 후보에서 제외하고, 확장 E2E(Ctrl+Z/Ctrl+Shift+Z)를 회귀 게이트로 둔다.
- 적용 가능 항목은 `isSimpleReplacement` 통과분(183/290)으로 제한한다. 패턴 규칙은 구조상 예시 나열형이라 적용 버튼을 제공하지 않는다.
- 적용 후 `execCommand`가 `input`을 발생시켜 재검사가 일어나는 것은 의도된 동작이다. 단 **학습 신호(§4.5)를 수집하기 시작하는 시점에는** 자기 유발 이벤트에 `source: "self-apply"` 플래그를 달아 신호 오염을 막는다 (TODO-021).

#### 4.2.5 팝오버 접근성 (R9, P2)

현재 `role="dialog"`(`content.js:204`)만 있고 `aria-modal`·포커스 이동·복귀가 없다. 요구:

1. 팝오버를 열면 첫 상호작용 요소(없으면 팝오버 컨테이너, `tabindex="-1"`)로 포커스를 옮긴다.
2. `Tab`/`Shift+Tab`은 팝오버 안에서 순환하고, `Esc`·바깥 클릭·적용 후 닫을 때 **원래 mark로 포커스를 복귀**한다. 웹 사이트의 모달 `trapFocus/releaseFocus` 패턴을 재사용한다.
3. mark는 `tabindex="0" role="button"`(`content.js:190`), `Enter`/`Space`로 열린다 (`:302-310`). 유지.
4. 포커스된 mark가 sticky 요소나 팝오버에 **완전히 가려지지 않아야** 한다(WCAG 2.2 2.4.11 AA). 점검 시나리오를 E2E에 추가한다.
5. 색에만 의존하지 않는다 — error=wavy, warning=dotted 밑줄 (`content.css:35-42`) 유지.

#### 4.2.6 원칙 딥링크 (R11, P2)

팝오버에 `principles/` 해당 섹션으로의 링크를 둔다. 선행 조건: **카테고리 → 앵커 URL 매핑 목록**을 먼저 만들고 앵커 존재를 테스트로 고정한다 (`principles.md` 앵커 존재 여부는 이번 작성에서 미조사). 링크는 `target="_blank" rel="noopener"`, 확장 내부에서 `fetch`하지 않는다.

#### 4.2.7 검증 가능한 결합 지점 분리 (R18 일부)

`content.js`는 IIFE라 vitest가 접근할 수 없다. `computeLineOffsets`, 마크 후보 산출·겹침 제거·줄당 제한(`content.js:27-35,163-182`)을 **순수 모듈**(예: `krds-extension/lib/inline-marks.js`, UMD)로 분리해 단위 테스트한다 (NEW-D, P2).

### 4.3 MAIN world 브리지 (`page-hook.js`)

`lint.html`의 샘플·초기화·기록 복원 버튼은 `textarea.value`를 직접 대입하고 `input`을 발생시키지 않는다. MAIN world의 `page-hook.js`가 프로토타입 세터를 감싸 `krds:value-changed`를 쏜다 (`page-hook.js:25-33`).

| 요구 | 내용 |
|---|---|
| 신뢰 경계 | 페이지 스크립트가 같은 이벤트를 위조할 수 있다. 현 범위(자기 소유 페이지)에서는 무해하나 **대상 사이트를 넓히면 재설계**한다 — 대안은 `lint.html` 쪽에서 커스텀 이벤트를 직접 dispatch하는 것 |
| 부수효과 | 이벤트 위조로 얻는 것은 "재검사 1회"뿐이어야 한다. 이 이벤트로 데이터를 읽거나 쓰는 경로를 만들지 않는다 |
| 필요성 재검토 | Web Store 등록을 추진하게 되면 MAIN world 사용 사유 설명 부담이 있으므로 필요성을 재검토 (P3) |

### 4.4 AI 판단 경로

> 이 절의 대부분은 **계약 설계**이며 호스팅 결정(OPEN-1) 이전에도 확정할 수 있다. 호스팅·비용·키 관리만 OPEN이다.

#### 4.4.1 위치 (확정)

AI 판단은 규칙 엔진 **위에** 얹는 추가 레이어다.

```
입력 → [규칙 엔진, 동기, 오프라인 가능] ─▶ 즉시 밑줄 표시
        └─ (선택, 동의 시) 규칙이 못 잡는 3종 판정 후보 ─▶ AI 요청 ─▶ 검증 통과분만 병합
```

AI가 담당하는 판정은 현재 근거로 **3종**으로 한정한다: ① 3단 구조(상황·이유·다음 행동) 완결성, ② 이중부정 의미 모호성, ③ 결론 배치 순서 (`TODOS.md` TODO-024 1차 검증 결과). 이 외 판정은 규칙 엔진이 담당한다.

#### 4.4.2 요청·응답 계약 (스파이크 산출물, P1 설계)

요청:

```json
{
  "contract": "inline-lint/1",
  "text": "<검사 대상 문장 — 최대 N자>",
  "revision": 17,
  "offsets_unit": "utf16",
  "rule_hits": [ { "rule_id": "…", "start": 0, "end": 3 } ],
  "dictionary_version": "…"
}
```

응답:

```json
{
  "contract": "inline-lint/1",
  "revision": 17,
  "findings": [
    { "start": 10, "end": 24, "rationale": "…", "alt": "…",
      "confidence": 0.82, "rule_ref": "principles#…" }
  ]
}
```

- 오프셋은 UTF-16 코드 유닛, 반개구간 `[start, end)`이며 클라이언트가 **재검증**한다 (§4.4.3).
- `confidence`는 표시 정렬·노출 임계에만 쓰고 자동 적용 근거로 쓰지 않는다. AI 제안에는 `applyable`을 부여하지 않는다 (자동 치환 금지 — undo-safe 단일 치환은 규칙 사전의 고정 `alt`에 한정).
- 합격 기준(스파이크가 채울 값): 3종 판정 정답률, 허용 지연(p95), 1회 호출 비용 상한. **수치는 지금 정하지 않는다** — 고정 코퍼스(≥20건)로 측정한 뒤 확정한다.

#### 4.4.3 안전 조건 (확정, R14)

| ID | 요구 |
|---|---|
| AI-1 | **stale 응답 폐기**: 응답의 `revision`이 현재와 다르면 버린다. 요청은 새 입력 시 `AbortController`로 취소한다 |
| AI-2 | **앵커 재검증**: 응답 `[start,end)`가 현재 텍스트 범위를 벗어나거나 `slice`가 요청 시점 스니펫과 다르면 해당 finding을 버린다 |
| AI-3 | **프롬프트 인젝션 격리**: 사용자 문구는 시스템 지시와 *구조적으로 분리된 데이터 영역*에 넣고(구분자·역할 분리), 모델 출력은 JSON 스키마 검증을 통과해야만 UI에 반영한다. 출력의 HTML·URL·지시문은 **텍스트로만** 렌더(`textContent`) |
| AI-4 | **응답 제한**: finding 수 상한, 문자열 길이 상한, 알 수 없는 필드 무시 |
| AI-5 | **전송 최소화**: 문장 단위 최대 길이, 문서 전체 전송 금지, 전송 전 PII 마스킹(§5.4)과 사용자 동의(세션 1회 이상) |
| AI-6 | **Rule Pack 예외 선적용**: 승인 예외 용어는 AI 전송 대상·결과에서 제외한다 (웹 `getEffectiveIssues`, `lint-ui.js:912-916,1057-1059`와 동일 원칙) |

현재 웹 경로는 사용자 문구를 `'샘플 텍스트 N: ' + sample.trim()`으로 구분자 없이 프롬프트에 이어붙인다 (`api/shared/generate-shared.js:168`). AI-3은 신규 경로뿐 아니라 이 기존 경로에도 **소급 적용할 개선 항목**이다 (P2).

#### 4.4.4 실패 모드 (R12, 확정 설계)

| 실패 | 표시 | 규칙 결과 |
|---|---|---|
| 타임아웃(웹 기준 15초, `lint-ui.js:1081`) | "AI 제안을 가져오지 못했습니다" 1줄, 재시도 버튼 | 유지 |
| 429/한도 초과 (`lint-ui.js:1102-1103`) | 한도 안내 | 유지 |
| 응답 JSON 스키마 위반 / 빈 응답 | **조용히 삼키지 않는다** — 현재 웹 경로는 SSE `JSON.parse` 실패를 빈 `catch`로 삼키고(`lint-ui.js:1136`) 스트림이 빈 누적으로 끝나면 아무것도 표시하지 않는다(`:1117-1118`). 신규 경로는 "AI 응답을 해석하지 못했습니다"를 live region으로 알린다 | 유지 |
| 네트워크 불가 | 규칙 결과만 표시, AI 레이어 비활성 상태 표시 | 유지 |

#### 4.4.5 호스팅 — **미결정 (OPEN-1 / PRD U-4)**

> 현재 미결정(두 안 병기)이다. 아래 두 선택지를 병기하며 어느 쪽도 권고하지 않는다. 사실관계: 공개 채널인 GitHub Pages는 정적이라 `/api/generate`가 없고(`_config.yml`), `api/generate.js`의 `ALLOWED_ORIGINS`는 웹 도메인·로컬 5개뿐이며 확장 origin은 없다(`api/generate.js:27-33,168-169`). 운영 중인 공개 엔드포인트는 현재 없다(`api/generate.js:20-26` 주석). 월 한도 설정(TODO-011)은 외부에서 접근 가능한 호스팅이 없어 보류 상태다(`TODOS.md`).

**OPEN-1: AI 호출을 누가 어디서 호스팅하고 비용을 내는가**

| 구분 | 선택지 A — 저장소 운영자가 자체 프록시를 운영 | 선택지 B — 호출자가 직접 부담(로컬 `server.js` 한정 + 사용자 제공 키, BYOK) |
|---|---|---|
| 요약 | 저장소 운영자가 서버리스 프록시(예: 기존 `api/generate.js`·`functions/api/generate.js` 계열)를 공개 배포하고 키·비용을 부담 | 공개 서버 없이, 개발자 모드에서 로컬 서버(`server.js`) 또는 사용자 본인 키로만 AI 레이어를 켬 |
| 아키텍처 | 확장 → background service worker → 프록시. 신규 `inline-lint/1` 엔드포인트, 확장 origin 허용·인증 설계 필요. `manifest.json`에 `background`·`host_permissions` 추가 | 확장 권한 변화 최소(로컬 호스트만). 호출 경로는 개발자 설정. 공개 배포본에서 AI 레이어는 기본 비활성 |
| 보안 | 공개 엔드포인트 = 남용 표면. Origin 검증·레이트리밋 영속화(TODO-002)·키 보호·로그 정책 필요. 확장 origin을 허용하면 CORS 표면 확대 | 키가 사용자 환경에 머무름(저장 방식·유출 설계는 사용자 책임으로 안내 필요). 공개 서버 남용 표면 없음 |
| 비용 | 운영자 상시 비용 + 한도 설정(TODO-011, 현재 보류) + 폭주 방어 필수 | 운영자 비용 0. 호출자별 비용 |
| 테스트 | 계약·인증·레이트리밋·CORS를 포함한 서버측 통합 테스트 추가, E2E는 모의 서버 | 계약 테스트는 모의 서버로 충분. BYOK 입력·저장 경로 단위 테스트 추가 |
| 사용자 경험 | 설치 후 즉시 사용 가능(동의 시) | 설정 장벽. 시연·내부 검증용에 적합 |
| 제품 경계 영향 | 웹/확장 한정이므로 오프라인판 경계는 불변 | 동일 |
| 되돌림 비용 | 높음(공개 서비스 철회·사용자 영향) | 낮음 |

**공통(결정과 무관하게 확정)**: 계약 `inline-lint/1`, §4.4.3 안전 조건, §4.4.4 실패 모드, 오프라인판에는 AI 코드를 넣지 않는다.
**결정 전에 *할 수 없는* 것**: 확장 manifest의 `background`/`host_permissions` 변경, 공개 엔드포인트 배포, 비용 한도 설정. **결정 전에도 *할 수 있는* 것**: 계약 문서·모의 서버·고정 코퍼스 정확도 측정(스파이크 NEW-B)은 모의 서버만으로 진행 가능하다.

### 4.5 이벤트 수집 · 학습 루프

#### 4.5.1 이벤트 스키마 (R15 — **필드 구조는 확정, 가중치 수치는 스파이크 후**)

규칙 `rule_id`와 `rule_ref`가 AI 응답에서 어떻게 오는지에 의존하므로(§4.4.2), 스키마는 **계약 스파이크 결과에 맞춰 최종화**한다. 확정 가능한 골격:

| 필드 | 값 | 비고 |
|---|---|---|
| `schema_version` | 정수 | 필수. 알 수 없는 버전은 격리 |
| `event_id`, `timestamp` | 시스템 생성 | |
| `action` | `accept` \| `reject` \| `edit` \| `ignore` | `edit` 수집은 아래 제한 |
| `source` | `user` \| `self-apply` | 자기 유발 재검사 구분 (§4.2.4) |
| `rule_id`, `category` | 엔진 고정 ID (ENG-3) | |
| `rule_version`, `dictionary_version` | 문자열 | 감사용 |
| `suggested_alt` | 사전의 고정 문자열 | 사용자 입력에서 파생되지 않아 낮은 민감도 |
| `original_snippet` | 매치 구간만, ≤20자, **PII 마스킹 후** | 높은 민감도 (§5.4) |

수집하지 않는 것: `edited_text`(자유 형식 수정문 — 필요성이 입증되기 전까지 수집 범위 제외), 주변 문맥(영구 제외).

#### 4.5.2 수집처 (R16) — 단일화 요구

수집처 결정이 문서마다 달라(GitHub Issue / 서버 릴레이 / 로컬 export) 단일 기준이 없다. TRD는 다음으로 **단일화**한다 (OPEN-2와 독립, 데이터가 저장소 밖 서버로 나가지 않는 안전한 쪽):

1. 이벤트는 로컬(`chrome.storage.local`)에만 저장한다. 네트워크 전송 코드 경로를 만들지 않는다.
2. 외부 공유는 사용자가 **내보내기 파일**을 직접 전달하는 방식뿐이다. 내보내기 전에 확인 게이트(마스킹 결과 미리보기 + 확인)를 거친다.
3. 보존기간 30일 자동 정리 + 즉시 삭제 버튼. 정리는 *저장 함수 내장*(호출부 선택 불가).
4. dedup: 정규화한 `(rule_id, action, 마스킹된 스니펫 해시)` 키별 **발생 횟수 카운터**로 접는다 (TODO-023을 "GitHub Issue"가 아니라 "로컬 카운터"로 재정의).
5. 데이터 거버넌스 정책은 별도 비공개 문서에서 관리하며, 승인 전에는 수집 기능을 활성화하지 않는다 (feature flag 기본 off).

#### 4.5.3 후보 산출과 승격 기준 (R17, OQ-6)

- 후보 산출: 내보내기 파일들을 입력으로 `(rule_id, 마스킹 스니펫)`별 집계 → 후보 목록(체크박스 마크다운, MCST `score-mcst-candidates.js`와 동일 패턴) → 사람 체크 → 반영 스크립트. **기존 `apply-mcst-approved.js`는 `principles.md` 카테고리 3 표 1곳에만 삽입하는 구조라 그대로 재사용할 수 없다** — 구조(3단계·체크박스·멱등)만 재사용한다.
- 신호 해석 원칙: 수락/거절은 *정답 신호가 아니라 약한 증거*다. 단일 사용자의 반복 거절을 곧바로 규칙 변경으로 보지 않는다.
- 승격 최소 기준(안): 최소 반복 횟수, 서로 다른 출처(내보내기 파일) 수, 신호별 가중, 승인 전 증거 샘플 수. **구체 수치는 정하지 않는다** — 파일럿 데이터로 정한 뒤 승인 절차를 거쳐 확정한다 (미결, §10).
- 승인 기록(승인자·근거·날짜)은 Rule Pack 필드(§4.6)에 남긴다.

#### 4.5.4 학습 루프의 출력 타깃 — **미결정 (OPEN-2 / PRD U-6)**

> 사실관계: 이미 구현된 Rule Pack은 *수동 작성·승인형 예외 목록*(소비측)이며 이미 승인자·근거·재검토일 필드를 갖는다 (`rulepack-schema.js:18-34`). PRD가 "신규 설계 필요"라 한 룰팩 데이터 모델과 이름은 같으나 개념이 다르다(PRD: 학습 결과 후보 / 구현: 승인된 예외). 현 스키마는 `term` 문자열 일치만 지원하고 `rule_id`·적용 범위·만료가 없다.

**OPEN-2: Rule Pack(승인 소비측)을 학습 루프의 출력 타깃으로 편입할지**

| 구분 | 선택지 A — Rule Pack 스키마(v2)를 출력 타깃으로 편입 | 선택지 B — 학습 루프를 Rule Pack과 분리(별도 후보/사전 반영 경로) |
|---|---|---|
| 요약 | 이벤트 → 후보 → 사람 승인 → `rulepack-validator`를 통과하는 Rule Pack entry 생성 | 후보는 기존 MCST 방식으로 `principles.md`/`jargon-dictionary.json` 갱신 경로로만 반영. Rule Pack은 기관 수동 관리 유지 |
| 아키텍처 | 스키마 v2(§4.6)가 *필수 선행*. 후보 산출 스크립트가 entry를 직접 생성하므로 데이터 모델 단일화. 4채널 일관 적용 쉬움(§4.5.5와 결합) | 데이터 모델 2벌 유지(기관 예외 / 공통 규칙). 신규 설계 범위가 작음. 기관 예외가 학습 결과를 받지 못함 |
| 보안 | 외부(이벤트 파생) 데이터가 Rule Pack 경로로 들어오므로 검증기·서명·만료 강제의 중요도 상승. 서명 없는 후보 entry의 자동 병합 금지 필요 | 외부 파생 데이터가 코드/사전 반영 경로로만 들어가고 Rule Pack 검증 경계는 현상 유지 |
| 비용 | 스키마 v2·검증기·서명 설계/구현 비용이 선행으로 듦. 이후 후보→반영 자동화 비용은 낮음 | 선행 비용 낮음. 장기적으로 두 경로 유지·동기화 비용 |
| 테스트 | 스키마 v2 호환성(구버전 읽기)·후보→entry 변환·`rulepack-validator` 통과를 end-to-end로 검증. 신규 테스트 다수 | 기존 MCST 스크립트 테스트 패턴 재사용. 신규 테스트 적음 |
| SC-3 달성 | "Rule Pack entry 생성 + 검증기 통과"로 합격 정의 가능 | "`jargon-dictionary.json` 또는 `principles.md` 실제 반영"으로 합격 정의 |
| 위험 | 스키마 확장을 서두르면 소비측 4채널 호환이 깨질 수 있음 | 기관 예외가 학습 결과와 계속 분리되어 PRD의 "기관별 헌법" 서사와 어긋남 |

**공통(결정과 무관하게 확정)**: 스키마 v2의 *수명주기·무결성 필드*(§4.6)는 학습 루프와 무관하게 Rule Pack 자체의 품질 요구이므로 진행한다. 후보 산출 스크립트(NEW-I)만 결정 이후로 미룬다.

#### 4.5.5 채널 간 예외 일관성 (NEW-J, 확정 요구)

승인된 예외는 **같은 용어에 대해 4채널이 같은 결과**를 내야 한다. 현재는 웹·오프라인에만 적용되고(`lint-ui.js:887-1018`, `offline-app/app.js:197-230`) CLI·확장은 Rule Pack을 모르므로, CI(`bin/krds-lint`)가 승인 예외 용어를 계속 오류로 실패시킨다. 요구:

| ID | 요구 | 우선순위 |
|---|---|---|
| EXC-1 | CLI에 `--rulepack <file>` 옵션 추가. 검증은 `rulepack-validator`를 재사용하고, 예외 적용 후 `errors`를 재계산해 종료 코드에 반영 | P2 |
| EXC-2 | 예외 적용 로직(`issue.match` 기반 필터, 집계 재계산)을 UI에서 분리한 **순수 함수**로 추출해 웹·오프라인·CLI가 공유 | P2 |
| EXC-3 | 확장은 Rule Pack 적용 여부를 **결정 항목**으로 둔다 — 확장은 저장소가 없고 `permissions: []`이므로 도입 시 파일 선택 UI/저장 권한 설계가 필요 | P3 |
| EXC-4 | `tests/cli.test.js`에 "예외 용어는 종료 코드 0" 케이스 추가, 4채널 동일 입력·동일 결과 비교 테스트 | P2 |

### 4.6 Rule Pack 스키마 v2 (서명 · 만료 · 예외 레지스트리)

> 이 절은 **OPEN-2와 무관하게 확정**하는 Rule Pack 자체의 품질 요구다.

#### 4.6.1 현재 스키마 (확정)

최상위 `{agencyName, version, entries[]}`. 항목 `{term, agencyName, rationale, approver, approvedDate, reviewDate}`. 제한: 파일 100KB, 항목 500개, 문자열 길이 상한 (`rulepack-schema.js:18-34`). 검증은 `JSON.parse`만 사용하며 `eval`/`new Function` 금지, 중복 `term` 거부 (`rulepack-validator.js:102,136-150`). **`schemaVersion`·`expiresAt`·서명·deprecated 개념은 없다.** 현재 `reviewDate`는 형식·순서 검증만 하고 "재검토일 경과" 경고에는 쓰이지 않는다.

#### 4.6.2 v2 필드 (설계)

| 위치 | 필드 | 규칙 |
|---|---|---|
| 최상위 | `schemaVersion` | 정수, 누락 시 v1로 간주(읽기 호환) |
| | `packId` | 기관 Rule Pack 식별자 |
| | `revision` | 단조 증가 정수. 낮은 revision으로의 교체는 경고(롤백 방지) |
| | `issuedAt`, `expiresAt` | `YYYY-MM-DD`. 만료 시 정책에 따라 **경고 또는 차단**(설정) |
| | `krdsVersion` | 참조한 KRDS 버전 문자열 (현재 확인된 최신 공식 릴리스: v1.1.0, 2026-01-12 — 근거: 내부 검토 문서, 비공개) |
| 항목 | `status` | `active` \| `deprecated` |
| | `deprecatedUntil` | deprecated 제거 기한 |
| | `exceptionRef` | 예외 레지스트리 항목 참조 |
| | `ruleId` (선택) | ENG-3 도입 후 패턴 규칙 예외 지정용 (현재 `term` 문자열 일치만 가능) |

#### 4.6.3 예외 레지스트리와 CI 게이트

- 규칙 본문과 예외를 분리하고 각 예외에 **승인자·근거·만료일**을 둔다.
- CI 검사: 만료된 예외, `deprecatedUntil`이 지난 항목이 있으면 `npm test` 실패 (저장소에 커밋된 Rule Pack 샘플/템플릿 대상).
- `reviewDate` 경과 시 UI에 "재검토 필요" 경고를 표시한다 (웹·오프라인 공통).
- 호환성: v1 파일은 계속 읽는다(경고 표시). v2 필수 필드 누락은 v2 선언 파일에서만 오류.

#### 4.6.4 무결성·서명 (검증 필요)

| 단계 | 내용 | 비고 |
|---|---|---|
| 최소안 | Rule Pack과 함께 `SHA256SUMS`(manifest)를 배포하고 확인 명령을 안내 | 오프라인·기관 PC에서 운용 부담 최소 |
| 확장안 | detached 서명 + 기관/제작자 **공개키 고정**, 서명 필수 모드 | 서명 방식(Ed25519 detached / JWT / SHA-256 manifest) 비교는 **검증 필요** — 기관 PC 운용 부담은 미확인 |
| 필수 테스트 | "서명 필수 모드에서 서명 부재 = **거부**" 회귀 테스트. 서명 제거 시 통과하는 취약 사례(OPA 번들 관련 보고)를 반면교사로 삼되, 해당 사례의 구체 버전·세부는 **검증 필요**(`[검색요약]` 등급) | |
| 로드 순서 | 크기 → JSON.parse → 스키마 → 서명/해시 → 만료 → 적용. 하나라도 실패하면 **기존 적용본 유지**하고 오류 보고 (부분 적용 금지) | OPA 번들 문서의 "검증 성공 시에만 활성화" 원칙에 대응 |

### 4.7 주요 설계 결정의 대안과 기각 사유

| 결정 | 채택 | 검토한 대안 | 기각/보류 사유 |
|---|---|---|---|
| 인라인 렌더링 | textarea mirror overlay | ① CSS Custom Highlight API ② 텍스트를 `contenteditable`로 교체 ③ 별도 에디터 제공 | ① `<textarea>`의 `value`는 노드가 아니라 적용 불가 ② 대상 페이지의 입력 동작·폼 제출·undo를 바꿈 ③ PRD 제약(새 에디터 금지, R1) 위반 |
| IME 처리 | `compositionstart/end` + `isComposing` 이중 방어, 조합 중 검사 보류 | ① 디바운스만 늘림 ② 조합 중에도 검사하고 결과를 버림 ③ `beforeinput`의 `inputType`으로 판별 | ① 느린 입력에서 여전히 불완전 음절 검사 ② 불필요한 연산·깜빡임 ③ 브라우저·OS별 발화 순서가 달라 단독 의존 불가(V-1) |
| 수락(치환) | `setSelectionRange` + `execCommand('insertText')` | ① `textarea.value` 직접 대입 ② `setRangeText` ③ `beforeinput` 합성 | ① undo 스택 파괴 ② undo 보존 여부가 브라우저별로 불확실(검증 필요) ③ undo 보장 없음. `execCommand` 중단 징후 시 E2E가 먼저 잡는다 |
| AI 위치 | 규칙 엔진 위의 추가 레이어 | ① AI 단독 판정 ② 규칙 결과를 AI가 재정렬/필터 | ① 오프라인·지연·비용·재현성 손실, 결정적 기준 판정기 상실 ② 승인 예외·재현 가능한 결과 보장이 흐려짐 |
| 이벤트 저장 | 로컬 저장 + 사용자 내보내기 파일 | ① 서버 릴레이(수집 서버) ② GitHub Issue 직접 생성 | ① 공개 서버·인증·보존 정책이 전제(OPEN-1과 결합) ② 사용자 문구 일부가 공개 저장소로 노출될 위험, 볼륨 관리 불가. 서버 수집은 거버넌스 승인 후 별도 설계 |
| Rule Pack 무결성 | 단계적: SHA-256 manifest → detached 서명 | ① 처음부터 서명 필수 ② 무결성 없음 | ① 기관 PC 운용 부담 미확인(V-9) ② 변조·롤백을 탐지할 수 없음 |
| Electron 로드 | `file://` 유지 → 커스텀 프로토콜 전환(ELE-3) | ① 로컬 HTTP 서버 ② `file://` 유지 + 퓨즈만 | ① 로컬 포트 개방은 제품 약속(서버 미기동)과 충돌 ② 공식 가이드가 권고하지 않는 상태가 남음 |
| 예외 적용 위치 | 공유 순수 함수(EXC-2) | ① 채널별 개별 구현(현재) ② `krds-lint.js` 내부에 Rule Pack 내장 | ① 채널 간 불일치가 이미 발생(CLI) ② 엔진을 순수·무상태로 유지하려는 ENG-2와 충돌, 엔진 변경이 4채널 사본 동기화로 파급 |

---

## 5. 보안

### 5.1 CSP 규칙 (확정)

| 대상 | 현재 정책 | 요구 |
|---|---|---|
| `offline-app/index.html` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'` (`index.html:6-7`) | 유지. `style-src 'unsafe-inline'`은 인라인 `<style>` 때문 — 외부 CSS 분리로 제거 (P3) |
| `lint.html` | `connect-src 'self'` + jsDelivr 스크립트/스타일 허용 (`lint.html:8-9`) | AI 경로가 외부 호스트를 호출하게 되면 `connect-src`에 *해당 호스트만* 추가 (OPEN-1 결정 후) |
| `index.html` | 인라인 스크립트는 SHA-256 해시로 등록 | CLAUDE.md의 CSP 준수 규칙 유지: `onclick=` 금지, 동적 `innerHTML` 금지(`createElement`/`textContent`), 새 인라인 스크립트는 해시 재계산 |
| 확장 | `extension_pages: script-src 'self'; object-src 'none'` (`manifest.json`) | 유지. 원격 코드 로드·`eval` 금지 (Chrome MV3 정책, 일부 세부는 **검증 필요**) |

CSP 변경 시 이웃 페이지 동작(예: `term-graph.html`의 노드 클릭)을 깨지 않는지 확인한다 (최근 커밋 `8bc70df` 선례).

### 5.2 오프라인 앱 — Electron 하드닝

#### 5.2.1 현재 상태 (확정)

`offline-app/electron/main.js`: `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`(`:25-27`), `loadFile`(`:32`), `will-navigate` 제한(`:38`), `setWindowOpenHandler` deny(`:44`), 메뉴 제거(`:48`). `preload.js`는 빈 상태. `autoUpdater` 미사용. `electron ^44.0.0`. **패키징 도구(electron-builder/forge)와 퓨즈 설정은 아직 없다** (`offline-app/electron/README.md`) — 따라서 아래 항목은 "결함"이 아니라 **패키징 설계 시 반드시 넣을 출시 차단 조건**이다.

#### 5.2.2 출시 차단 조건 (P1, 패키징 도입 시)

| ID | 요구 | 검증 방법 |
|---|---|---|
| ELE-1 | **퓨즈**: 패키징 후·**코드서명 이전**에 `RunAsNode=false`, `EnableNodeCliInspectArguments=false`, `EnableNodeOptionsEnvironmentVariable=false`, `EnableEmbeddedAsarIntegrityValidation=true`, `OnlyLoadAppFromAsar=true`, `GrantFileProtocolExtraPrivileges=false`(또는 ELE-3으로 대체) | `scripts/verify-offline-app-bundle.js`에 `@electron/fuses` read 결과 검증 단계 추가. 패키징 도구는 *퓨즈 지원 여부*를 선정 기준에 포함 |
| ELE-2 | **버전 게이트**: 출시 직전 "Electron 최신 3개 stable 이내 + 해당 라인 최신 패치"를 검사. 현재 `^44.0.0`(lock 44.0.0)이므로 상향 검토 필요 | 릴리스 체크리스트의 `npm view electron dist-tags` 확인. 상향 시 sandbox·네비게이션 테스트 재실행. 지원 종료일은 공식 일정상 **잠정** 날짜이므로 *검증 필요*(출시 시점에 재확인) |
| ELE-3 | **`file://` 탈피**: 커스텀 프로토콜(`protocol.handle`)로 로드. `file://` 페이지는 기본 퓨즈에서 추가 권한을 받으므로 공식 가이드는 커스텀 프로토콜을 권고 | 전환 시 `GrantFileProtocolExtraPrivileges=false`에서 앱이 깨지지 않는지 **먼저 검증**(검증 전 단정 금지). 실제 악용 가능성은 **미검증** |
| ELE-4 | **권한 deny-all**: `session.setPermissionRequestHandler(() => false)` 및 권한 체크 핸들러. `webSecurity` 기본값 유지 | 권한 요청이 거부되는 단위/E2E 테스트 |
| ELE-5 | **preload 빈 상태 고정**: `contextBridge`로 노출하는 API 0개를 회귀 테스트로 고정. IPC 추가 시 `sender` 검증 필수 | `preload.js` 내용 검사 테스트 |
| ELE-6 | **자동 업데이트 금지(기본)**: `autoUpdater`·`update.electronjs.org` 호출 코드 부재를 테스트로 고정. 업데이트가 필요해지면 별도 설계(오프라인 경계 재검토) | 소스 grep 테스트 |
| ELE-7 | `shell.openExternal` 사용 금지(현재 미사용) 유지 | grep 테스트 |

### 5.3 공급망 — SBOM · 서명

| ID | 요구 | 우선순위 / 비고 |
|---|---|---|
| SUP-1 | release 워크플로에서 **CycloneDX JSON SBOM**, **SHA-256**을 생성해 산출물과 함께 게시 | P1. SBOM 의무화는 일괄 적용이 아니라 2027년부터 단계 적용 예정이라는 보도가 있으나 **2차 자료 — 검증 필요**. 선제 대응 성격 |
| SUP-2 | SBOM 도구 버전은 **발행 2주 이상 경과한 안정판을 고정**한다 (신규 메이저는 하루 전 발행이므로 직전 계열 검토) | 고정 버전은 구현 시점 레지스트리 재확인 |
| SUP-3 | SBOM이 Electron에 내장된 Chromium/Node 구성요소를 포함하는지 확인 | **검증 필요** (npm 의존성만으로는 누락될 수 있음) |
| SUP-4 | **코드서명 + RFC 3161 타임스탬프 필수**, 인증서 만료 *갱신 캘린더*를 릴리스 절차에 포함 (신규 발급분 유효기간 상한 460일이라는 CA/B Forum 기준 — 구현 시점 재확인) | P2. 기관이 요구하는 CA 종류는 **미확인** → 파일럿 질의 |
| SUP-5 | CI 워크플로의 외부 액션·CLI는 **SHA/정확한 버전 고정** (이미 `deploy-vercel.yml`·`test.yml`에서 적용 중) — 신규 워크플로도 동일 | 확정 |
| SUP-6 | 서명·퓨즈 순서: **퓨즈 변경 → 서명** (서명 후 변경하면 서명이 깨짐) | 확정 (공식 문서) |
| SUP-7 | 대외 표현 금지: 취득 전 "인증"·"검증필"·"KWCAG 100% 준수"·"나라장터 규격 준수" 등 문구를 산출물·문서에 쓰지 않는다 (`offline-app/MANIFEST.md`의 기존 원칙) | 확정 |

### 5.4 입력 데이터 등급과 PII

- **입력 대상 등급**: 본 도구는 *공개된 화면 문구 또는 비식별 테스트 문구*만 입력 대상으로 한다. 개인정보·민감정보·민원 원문·비공개 정책/보안/인증 정보는 **입력 금지**로 UI·설치 안내·릴리스 검증 문서에 고지한다.
- **PII 마스킹(이벤트·AI 전송 공통)**: 저장/전송 직전 *함수 내장* 단계로 전화번호·이메일·주민등록번호 형식을 `[마스킹됨]`으로 치환한다 (정규식 3종: 전화번호·이메일·주민등록번호 형식). 마스킹은 **완전하지 않다** — 이름·주소 등 비정형 PII는 걸러지지 않으므로 export·AI 전송 전 사람 확인 게이트가 최후 방어선이다.
- **외부 AI 전송**: 사용자 동의 필수, 최대 3개 문구, Rule Pack 승인 예외는 제외 (`lint-ui.js:1057-1071`). 동의는 세션 1회(`:1060-1066`).
- **저장**: 웹 이력은 30일 TTL (`lint-ui.js:772`). 오프라인판은 저장 자체가 없다.
- **금지되는 서술**: "AI 보안성 검토 비대상" 등 *법적 결론*을 쓰지 않는다. 대신 **검증 가능한 사실**만 쓴다 — 오프라인 앱의 CSP `connect-src 'none'`(`offline-app/index.html:7`), `app.js`·`electron/*.js`·`index.html`에 `fetch`/`XMLHttpRequest`/`WebSocket`/`localStorage`/`sessionStorage`/`sendBeacon`/`EventSource` 호출이 없음(2026-11-10 grep 확인). 단 이 부재는 **현재 자동 테스트로 고정되어 있지 않다** — `scripts/verify-offline-app-bundle.js`는 배포 파일 목록과 `MANIFEST.md` 드리프트만 검사한다. 위 grep을 vitest로 고정하는 것을 신규 요건 OFF-1(P1)로 둔다.

### 5.5 확장 권한

- `permissions: []`, `host_permissions` 3개 URL 고정 (`manifest.json:20-25`). 변경은 §4.4.5 OPEN-1 결정 이후이며, 변경 시 이 TRD의 해당 절과 함께 갱신한다.
- 원격 코드 로드·`eval` 금지. 개인정보 처리방침에 "원격 코드 없음"을 명시 (Web Store 등록 시 — 현재 미등록).
- 호스트 권한 확대는 심사·재동의 부담을 부르므로 *최소 유지*를 원칙으로 한다 (세부 정책 영향은 **검증 필요**).

---

## 6. 접근성 수치

> 3개 층을 **분리해서** 적는다. 층이 섞이면 "법적 최소선"과 "프로젝트 목표"를 혼동한다. 근거 상세는 내부 검토 문서(비공개, 저장소 미포함)에 있다.

### 6.1 3층 기준

| 층 | 항목 | 값 | 성격 |
|---|---|---|---|
| ① 법·인증 기준 (KWCAG 2.2) | 텍스트 명도 대비 | 4.5:1 이상 (확대 가능 시 3:1까지 허용) | 기준 |
| | 비텍스트(UI 컴포넌트) 대비 | 3:1 이상 | 기준 |
| | 터치 대상 | "충분한 크기" — 대각선 6.0mm 이상이 **바람직**(권고 수준) | 권고 |
| ② 국제 기준 (WCAG 2.2) | 대상 크기 최소 | **24×24 CSS px** (2.5.8, AA) | **최소선** |
| | 포커스 가림 | 완전히 가려지지 않아야 함 (2.4.11, AA) | AA |
| ③ 프로젝트 정책 | 터치 대상 | **44×44 px** — KWCAG 2.2 부록·WCAG 2.5.5(AAA) *지향* 목표 | 정책(AAA 지향) |
| | 최소 폰트 | **13px** — 내부 가독성 정책값. 어떤 표준도 픽셀 최소 폰트를 규정하지 않음 | 내부 정책 |
| | `prefers-reduced-motion` | 움직임이 있는 곳에 적용 — 법정 필수 아님 (2.3.3은 AAA) | 내부 정책 |
| | 줄 간격 | `line-height: 1.5` | 내부 정책 |

**요구**: 문서·UI·대외 문구에서 "44px"를 "법적 최소"로 쓰지 않는다. "44px = AAA 지향 목표 / 24px = AA 최소 / 13px = 내부 정책"으로 층을 명기한다. 단, KWCAG ↔ WCAG 2.2 신규 항목의 **1:1 대응표는 미작성**이므로 "KWCAG에 대응 항목이 없다"고 단정하지 않는다 (검증 필요).

### 6.2 현재 상태와 갭

| 대상 | 현재 | 요구 |
|---|---|---|
| `DESIGN.md` | 버튼·링크 44×44, 기능 텍스트 13px 규정 (`DESIGN.md:145,215,308,336-337`) | 3층 표기로 갱신 (문서 변경 — 별도 작업) |
| 웹 `lint.html`/`index.html` | `prefers-reduced-motion` 각각 3건/1건 | 유지 |
| 확장 `content.css` | `prefers-reduced-motion` 1건 (`:124`) | 유지 |
| 오프라인 앱 `index.html` | `prefers-reduced-motion` **0건**, `transition/animation` 0건 | 움직임이 없으면 불필요하다는 주석을 넣거나 일관성을 위해 최소 규칙 추가. "reduced-motion 적용" 주장을 오프라인판에는 쓰지 않는다 (P1) |
| 오프라인 앱 대상 크기 | 버튼 약 39.5px 실측(44px 미달, `DESIGN.md` §13-8), `min-height:44px` 규칙 없음. 버튼 외 체크·입력은 미측정 | Playwright로 모든 버튼·체크·입력의 `getBoundingClientRect()` 측정 → 44×44 미만 목록 산출 → 회귀 테스트로 고정 (P1) |
| 확장 포커스 가림 | **미점검** | §4.2.5의 2.4.11 시나리오 |
| 확대 | 미테스트 | 200% 확대 시 가로 스크롤 없이 사용 가능한지 테스트 추가 (P2) |

### 6.3 대외 표현

"KWCAG 100% 준수"·"KRDS 인증" 류 주장을 금지한다. "KWCAG 2.2·WCAG 2.2 기준을 참고한 자체 점검"으로 표기한다 (§5.3 SUP-7과 동일 원칙).

### 6.4 팝오버 디자인 문서 (R10)

`DESIGN.md`에 팝오버 섹션이 없다 (`grep` 확인). 팝오버의 토큰(배경·테두리·그림자), 다크 모드 대비비(밑줄 포함), 위치 규칙(아래 우선·뷰포트 클리핑 시 위쪽, `content.js:268-282`), 최대 폭, 포커스 링을 추가한다 (P2).

---

## 7. 배포 · 릴리스

### 7.1 배포 채널

| 채널 | 방식 | 버전 출처 |
|---|---|---|
| 웹 데모 | GitHub Pages `legacy` Jekyll 빌드, `main` 루트 (`_config.yml`) — `git push origin main` | `VERSION` + `CHANGELOG.md` |
| npm CLI | `package.json#files` allowlist | `package.json#version` |
| Chrome 확장 | 로컬 설치(개발자 모드). Web Store 미등록 | `krds-extension/manifest.json#version` |
| 오프라인 앱 | `release-manifest.json#bundles.offlineApp` 의 `releaseFiles`만 | `offline-app/electron/package.json#version` |
| (선택) Vercel | `deploy-vercel.yml`이 `main` push마다 Production 배포 시도 | 운영 상태 확인 필요 — 아래 7.4 |

### 7.2 Pages 노출 제어 (확정)

- Pages 빌드에는 **`_config.yml`의 `exclude`만** 효력이 있다. `.vercelignore`/`.gitignore`는 영향이 없다.
- Jekyll `exclude`를 디렉터리 단위로 걸면 안의 파일을 `include`로 되살릴 수 없다. 그래서 `research/`는 디렉터리를 제외하지 않고 **비공개 파일을 하나씩** 나열한다 (`_config.yml` 주석).
- **fail-open 주의**: `research/`에 새 파일을 추가하면 기본값이 "공개"다. 비공개 문서를 추가할 때는 *같은 커밋*에서 `_config.yml` exclude에 추가한다. 공개 유지 대상은 `research/public-service-corpus.md`, `research/public-service-survey-expanded.md` 2개뿐이다(`corpus/index.html`, `dictionary/full.html`이 링크).
- 병합 시 `_config.yml` exclude 충돌은 **양쪽 항목을 모두 유지**한다.
- 이 TRD(`TRD.md`)는 **공개 파일**이다. 비공개 내용을 본문에 넣지 않는다.

### 7.3 `.vercelignore` · `release-manifest.json` 정합

- `.vercelignore`는 `offline-app/`, `research/*`(공개 코퍼스 2개만 `!`로 예외), `b2g-service-package/`를 제외한다. Vercel은 `.gitignore`와 같은 negation 문법을 지원하므로 `research/*` + `!파일` 방식이 통한다 (Jekyll과 동작이 다르다).
- `release-manifest.json`의 `forbidden.prefixes`(`research/`, `tests/`, `api/`, `krds-extension/`, `.github/` 등)는 **어떤 번들에도** 포함 금지다. `scripts/verify-release-manifest.js`가 `npm pack --dry-run` 결과·`offline-app/` 디렉터리와 대조한다.
- 요구 REL-1: **배포 경계 정의는 한 곳(`release-manifest.json`)이 단일 근거**이고, `_config.yml`·`.vercelignore`·`package.json#files`가 그와 어긋나지 않음을 검증 스크립트가 잡아야 한다. 현재 검증은 npm·offline-app 중심이며 `_config.yml` exclude ↔ `research/` 비공개 목록의 일치는 *자동 검증이 없다* — `research/`의 비공개 파일이 exclude 목록에 모두 있는지 확인하는 테스트를 추가한다 (P2).
- 요구 REL-2: 새 번들 파일은 `release-manifest.json`을 **먼저** 수정한다(리뷰 없이 번들이 커지는 것을 방지).
- 요구 REL-3: `offline-app/dist/*`는 루트 원본의 복사본이며 직접 편집 금지, `node scripts/build-offline-app.js`로 재생성한다 (현재 4개 파일 `cmp` 동일 확인).

### 7.4 CI 워크플로

| 워크플로 | 역할 | 비고 |
|---|---|---|
| `test.yml` | PR/main에서 `npm ci` + `npm test` | 확장 E2E는 포함되지 않음 (§8.5) |
| `krds-lint.yml` | PR의 `md/txt/html` 변경에 대해 CLI 린트, 오류 1건 이상이면 실패 | Rule Pack 미적용 갭 → EXC-1 |
| `deploy-vercel.yml` | `main` push마다 Production 배포 시도 | 실제 Vercel 운영 여부 확인 필요(`api/generate.js:20-26` 주석은 "배포해 쓰고 있지 않음"). **OPEN-1과 함께 정리** — 사용하지 않으면 비활성화/제거 검토 |
| `sync-prompts.yml`, `ux-lint.yml` | 프롬프트 동기화, UX 린트 | 현행 유지 |

### 7.5 릴리스 게이트 (오프라인 앱, 패키징 도입 시)

1. `npm test` 통과, `node scripts/verify-release-manifest.js` · `scripts/verify-offline-app-bundle.js` 통과
2. Electron 버전 게이트(ELE-2), 퓨즈 읽기 검증(ELE-1)
3. SBOM 생성·게시(SUP-1), SHA-256 게시
4. 서명 + 타임스탬프(SUP-4) — **퓨즈 이후**(SUP-6)
5. 설치 안내에 입력 데이터 등급·금지 정보(§5.4) 포함, 금지 표현 점검(SUP-7)

---

## 8. 테스트 전략

### 8.1 프레임워크와 현황

- vitest(`npm test` = `vitest run`, `tests/**/*.test.js`), Node `^20.19.0 || >=22.12.0`. CI는 `npm ci && npm test`.
- 현재: **50 파일 / 1373 테스트 통과** (2026-11-10 직접 실행; `node_modules`는 메인 체크아웃 심볼릭 링크, 커밋 제외).
- `npm run lint`는 인자 없이 실행하면 exit 1이 정상이다(입력 없음 오탐). CI 린트는 `krds-lint.yml`이 파일 인자로 호출한다.

### 8.2 계층

| 계층 | 대상 | 방식 |
|---|---|---|
| 단위 | `krds-lint.js`, `rulepack-validator.js`, 순수 모듈 | vitest, `tests/{module}.test.js` |
| 통합 | `bin/krds-lint`(자식 프로세스), `api/generate.js`(mock `fetch`), `server.js` | vitest |
| DOM 하니스 | `archive.js`, `script.js`, `lint-ui.js`, `shared/nav.js` | `vm.runInNewContext` 기반 모의 DOM |
| 계약/정합 | CSS 토큰, 카운트, 링크, 번들 allowlist | vitest |
| E2E | 확장 인라인 지적(`verify-real-chrome.py`), 오프라인 앱 | Playwright/실제 Chromium — **현재 CI 밖** |

### 8.3 신규 요건 — 동기화 장치 (NEW-C, P2)

확장 `lib/`와 오프라인 `dist/`는 루트 원본의 **복사본**인데 어긋남을 잡는 테스트가 없다 (현재는 `cmp` 동일을 수동 확인).

- `tests/` 에 "`krds-extension/lib/krds-lint.js` == `krds-lint.js`", "`krds-extension/lib/jargon-dictionary.js` == `jargon-dictionary.js`", "`offline-app/dist/*` == 루트 4개"를 검사하는 vitest를 추가한다.
- 갱신 절차를 명문화한다 (`npm run sync:extension` 등 — 스크립트 이름은 구현 시 확정).
- 이 동기화는 학습 루프의 "승인된 규칙 반영" **마지막 홉**이므로, 수작업 복사를 허용하지 않는다.

### 8.4 신규 테스트 요건

| 영역 | 필요한 테스트 |
|---|---|
| IME (R5) | 조합 중 mark 미생성, 확정 후 1회 검사, `isComposing` 플래그 — 순수 상태기계 단위 + 실제 Chromium E2E |
| mirror (4.2.3) | 스크롤바 유무·긴 텍스트·글꼴 변경 시 mark 위치 오차 허용치 이내 (E2E) |
| 마크 계산 (NEW-D) | 줄 오프셋, 겹침 제거, 줄당 제한 — 분리한 순수 모듈 |
| 팝오버 접근성 | 키보드 전용 시나리오: 열기→포커스 이동→Tab 순환→Esc→mark 복귀 |
| 적용 치환 (R6) | 적용 후 Ctrl+Z/Ctrl+Shift+Z, stale offset 거부 |
| 딥링크 (R11) | 카테고리→URL 매핑 완전성, 앵커 존재 |
| Rule Pack v2 | v1 읽기 호환, 만료/deprecated 게이트, revision 롤백 경고, 서명 필수 모드에서 서명 부재 거부, 부분 적용 금지 |
| CLI 예외 (EXC) | 예외 용어는 종료 코드 0, 4채널 동일 결과 |
| 오프라인 경계 (OFF-1) | `offline-app/` 소스에 `fetch`/`XMLHttpRequest`/`WebSocket`/`localStorage`/`sessionStorage`/`sendBeacon`/`EventSource` 부재, CSP `connect-src 'none'` 유지 |
| Electron | 퓨즈 값 읽기 검증, preload 비노출, 권한 deny-all, autoUpdater/openExternal 부재 grep |
| AI 계약 | 모의 서버로 정상/타임아웃/스키마 위반/빈 응답/stale revision/범위 이탈/인젝션 코퍼스 |
| 이벤트 | 마스킹 함수(정규식 3종 + 20자 절단), 보존기간 정리, dedup 카운터, 스키마 버전 격리 |
| 릴리스 정합 | `_config.yml` exclude ↔ `research/` 비공개 파일 일치 |

규약(`CLAUDE.md` Testing): 신규 함수는 대응 테스트를 쓰고, 버그 수정은 회귀 테스트를 먼저 쓰며, 조건 분기는 **양쪽 경로**를 테스트하고, 기존 테스트를 깨는 커밋은 하지 않는다.

### 8.5 E2E 편입 (NEW-G, P2)

`verify-real-chrome.py`는 헤드풀 Chromium + 확장 로드가 필요해 CI(`test.yml`)에 없다. 두 안 중 하나로 *명시*한다: ① `xvfb` 기반 CI 잡, ② **수동 릴리스 게이트**(릴리스 체크리스트에 실행·결과 기록 의무화). 어느 쪽이든 `npm run verify:extension` 진입점을 둔다. 어느 쪽인지는 구현 시 정한다.

---

## 9. 성능 · 비용

| 항목 | 현재 | 요구 |
|---|---|---|
| 검사 지연 | 규칙 엔진 동기 실행, 확장 디바운스 400ms (`content.js:20`) | 입력 체감 지연 없음 유지. 긴 텍스트에서의 `lint()` 시간 상한을 벤치로 기록(구체 수치는 측정 후 확정) |
| mirror 재렌더 | 매 검사마다 `innerHTML` 전체 재생성 (`content.js:198`) | 현 규모에서 충분. 문서가 매우 길면 가시 영역 한정 렌더를 검토(P3, 측정 후) |
| AI 호출 | 확장 경로 없음 | 디바운스(문장 확정 후)·`AbortController`·문장 단위 캐시. 캐시 키는 `(문장 해시, 사전/원칙 버전)` — 버전이 바뀌면 무효화 (TODO-016, **계약 스파이크 이후**) |
| 서버 한도 | `api/generate.js` 5회/시간/IP (`:15`), KV 미설정 시 in-memory | 인라인 검사와 구조적으로 비양립 — 인라인 AI 경로는 별도 한도 설계 필요. 영속 저장 필요(TODO-002) |
| 비용 | 공개 엔드포인트 없음 | **OPEN-1 결정에 종속**. 토큰·요청 빈도의 정량 추정은 스파이크 산출물에 포함 (이 TRD는 수치를 정하지 않음) |
| 번들 크기 | 오프라인 앱: `releaseFiles` 9개 | `release-manifest.json` allowlist가 조용한 증가를 막음 |
| 이벤트 저장 | 없음 | 로컬 30일 보존·카운터 dedup으로 상한 유지, 용량 상한 설정 |

---

## 10. 위험 · 미결정

### 10.1 미결정 (OPEN)

| ID | 질문 | 위치 | 이 결정이 막는 것 | 안 막는 것 |
|---|---|---|---|---|
| **OPEN-1** | AI 호출을 누가 어디서 호스팅하고 비용을 부담하는가 (PRD U-4) | §4.4.5 | R3·R13·R14의 코드, 확장 manifest 변경, 공개 엔드포인트, 월 한도 | 계약 문서, 모의 서버 스파이크, 안전 조건·실패 모드 설계, 나머지 13개 요구사항 |
| **OPEN-2** | Rule Pack을 학습 루프의 출력 타깃으로 편입할지 (PRD U-6) | §4.5.4 | 후보 산출 스크립트(NEW-I), SC-3 합격 정의, R17의 최종 형태 | Rule Pack 스키마 v2의 수명주기·무결성 필드, 채널 간 예외 일관성(EXC) |

### 10.2 그 밖의 미결정·위험

| ID | 내용 | 영향 | 완화 |
|---|---|---|---|
| RISK-1 | **AI 효용 미검증** — 규칙의 한계는 입증(합성 8샘플), "LLM이 3종 판정을 충분히 한다"는 *미검증* | 핵심 가설의 절반 | 고정 코퍼스(≥20) 스파이크로 합격 기준 정의 후 진행. 합격 못 하면 AI 레이어 범위 축소/중단 |
| RISK-4 | 확장 `lib/`·`dist/` 복사본 드리프트 | 승인된 규칙이 채널에 전파되지 않음 | §8.3 동기화 테스트 |
| RISK-5 | 채널별 예외 불일치(CLI 미적용) | CI가 승인 예외를 실패 처리 | EXC-1~4 |
| RISK-6 | Electron 지원 종료·`file://` 권한 | 장기 설치 앱의 보안 패치 공백 | ELE-1~3, 출시 직전 버전 게이트 |
| RISK-7 | `execCommand` 지원 중단 가능성 | 적용 버튼 undo 보존 깨짐 | E2E 회귀 게이트, 대체 경로 추적 |
| RISK-8 | IME 실제 거동 미실측 | 한글 입력 UX 결함 | P1로 실측·수정 |
| RISK-9 | 정책·표준 정보 일부가 2차/검색요약 등급 | 대외 문서의 오기 | §10.3 목록은 확정 사실로 쓰지 않음 |
| RISK-10 | `deploy-vercel.yml`이 `main` push마다 배포를 시도하나 운영 여부 확인 필요 | 실패 알림 노이즈/의도치 않은 노출 | OPEN-1과 함께 유지/제거 검토 |
| RISK-11 | `research/` 신규 파일은 기본 공개(fail-open) | 비공개 문서 노출 | §7.3 REL-1 검증 테스트 |

위험 번호 일부는 결번이다.

### 10.3 검증 필요 항목 (확정 사실로 쓰지 않음)

본문에서 "검증 필요"로 표기한 항목의 목록이다. 외부 리서치의 `[검색요약]`·`[2차]` 라벨 또는 §9 미확인 항목에 근거한다.

| # | 항목 | 본문 위치 | 근거 등급 |
|---|---|---|---|
| V-1 | 한글 IME 조합 중 `input` 이벤트 발화 양상(브라우저·OS별) | §4.2.2, RISK-8 | 미확인(미실측) |
| V-2 | OpaqueRange의 Firefox/Safari 지원·안정화, hover/클릭 부재 | §4.2.3 | 2차/검색요약 |
| V-3 | Chrome MV3 정책의 세부(호스트 권한 심사·재동의 영향) | §5.1, §5.5 | 검색요약 |
| V-4 | Electron 지원 종료일(공식 일정상 잠정 날짜) | §5.2.2 ELE-2 | 1차이나 잠정 표기 |
| V-5 | `file://` + 기본 퓨즈 조합의 실제 악용 가능성, `GrantFileProtocolExtraPrivileges=false` 적용 시 현 앱 영향 | ELE-1, ELE-3 | 미검증 |
| V-6 | SBOM 단계 적용 시점(2027~)과 범위 | §5.3 SUP-1 | 2차 |
| V-7 | SBOM이 Electron 내장 Chromium/Node를 포함하는지 | SUP-3 | 미검증 |
| V-8 | 코드서명 인증서 유효기간 상한 및 기관 요구 CA 종류 | SUP-4 | 1차(상한) + 미확인(CA) |
| V-9 | Rule Pack 서명 방식별 기관 PC 운용 부담 | §4.6.4 | 미확인 |
| V-10 | OPA 번들 서명 제거 취약 사례의 구체 버전 | §4.6.4 | 검색요약 |
| V-11 | KWCAG ↔ WCAG 2.2 신규 항목 1:1 대응 | §6.1 | 미확인(전수 대조 미실시) |
| V-12 | 오프라인 앱·확장의 실제 터치 대상 크기·포커스 가림 | §6.2 | 미측정 |
| V-13 | 본 도구가 보안적합성 검증·보안기능 시험 등 기관 심사 대상인지 | §5.4 | 미확인 (법적 결론 서술 금지) |
| V-14 | `principles.md` 앵커 존재 여부 | §4.2.6 | 미조사 |
| V-15 | 인라인 AI 경로의 정확도·지연·단가 | §4.4.2 | 스파이크 대기 |

---

## 11. 구현 로드맵

### 11.1 원칙

- **AI 경로에 의존하지 않는 항목은 OPEN-1을 기다릴 이유가 없다.** 먼저 진행한다.
- 스키마(R15)와 후보 산출(NEW-I)은 계약 스파이크 결과(`rule_ref` 형태)에 의존하므로 스파이크 뒤에 둔다. 먼저 착수하면 "순서 거꾸로" 패턴을 반복한다.
- 각 항목은 검증 방법을 갖는다.

### 11.2 의존 관계

```
[P1 — 결정 불필요, 즉시 병행]
  NEW-A IME 보호 ─────────────┐
  ELE-1/2/4/5 퓨즈·게이트 설계(패키징 도입 시) │
  접근성 3층 문서화 + 오프라인 타겟 크기 실측 ├─▶ 릴리스 게이트 정비
  NEW-B 계약 스파이크(모의 서버, 코퍼스) ─────┘   (OPEN-1 없이 가능)

[P2 — 결정 불필요, 병행]
  NEW-C 사본 동기화 테스트 ─▶ NEW-D 마크 순수 모듈 ─▶ 스크롤바/폰트 보정
  NEW-E 포커스 관리 + DESIGN.md 팝오버 ─▶ NEW-F 딥링크(앵커 목록 선행)
  Rule Pack v2(수명주기·무결성) ─▶ EXC-1~4 채널 일관성
  SBOM·서명 파이프라인 · REL-1 exclude 정합 테스트 · NEW-G E2E 편입

[결정 단계]
  OPEN-1 (AI 호스팅) ───────────────▶ R13/R14 코드, manifest 변경, 한도 설정
  OPEN-2 (Rule Pack 편입) ──────────▶ NEW-I 후보 산출, SC-3 합격 정의
  데이터 거버넌스 정책 확정 ─────────▶ 이벤트 수집 활성화 (feature flag)

[P3 — 후속]
  문장당 노출 제한(NEW-H) · OpaqueRange 점진 도입 · 캐싱(TODO-016)
  EXC-3 확장 Rule Pack · MAIN world 필요성 재검토 · CSP unsafe-inline 제거
```

### 11.3 우선순위별 항목

#### P1 — 이대로 두면 사용자 결함·잘못된 전제로 이어지는 항목

| 항목 | 요구사항 | 의존 | 검증 방법 |
|---|---|---|---|
| NEW-A IME 조합 보호 | R5 | 없음 | 실제 Chromium에서 조합 중 mark 미생성·확정 후 1회 검사 (`verify-real-chrome.py` 케이스) |
| NEW-B AI 계약 스파이크 | R3·R14 (설계) | 없음(모의 서버) | 계약 문서 + 모의 서버 + 고정 코퍼스 ≥20건 정답률 → 합격 기준 확정 |
| 접근성 수치 3층 문서화, 오프라인 타겟 크기 실측 | R9·R10 | 없음 | 44×44 미만 목록 산출 후 회귀 테스트 |
| 퓨즈·버전 게이트·권한 deny-all·preload 고정 (패키징 도입 시) | — | 패키징 도구 선정 | `@electron/fuses` read 검증 스크립트, 단위 테스트 |
| SBOM + SHA-256 게시 | — | release 워크플로 | 산출물 존재 검증, 도구 버전 고정 확인 |
| ENG-1 UTF-16 오프셋 규약 명문화 | R14 | 없음 | 오프셋 단위 테스트 |
| OFF-1 오프라인 경계 자동 고정 | — | 없음 | `offline-app/` 소스 금지 API grep + CSP 검사 vitest |

#### P2 — 구조 건전성·추적성

| 항목 | 요구사항 | 의존 | 검증 방법 |
|---|---|---|---|
| NEW-C 사본 동기화 테스트 | R2 | 없음 | vitest(바이트 동일) |
| NEW-D 마크 계산 순수 모듈 | R1·R18 | 없음 | 줄 오프셋·겹침·줄당 제한 단위 테스트 |
| NEW-E 팝오버 포커스 관리 + DESIGN.md 팝오버 섹션 | R9·R10 | 없음 | 키보드 전용 E2E |
| NEW-F 원칙 딥링크 | R11 | 앵커 목록 | 매핑 완전성 테스트 |
| NEW-G 확장 E2E 편입 | R4 | 없음 | `npm run verify:extension` + CI 또는 수동 게이트 명시 |
| 스크롤바·글꼴 변경 보정 | R4 | NEW-D | 긴 텍스트·스크롤바 유무 E2E |
| Rule Pack v2 + CI 게이트 | R17 | 없음 | v1 호환·만료/deprecated 테스트 |
| EXC-1~4 CLI 예외 일관성 | R17 | EXC-2 순수 함수 추출 | `tests/cli.test.js` |
| ENG-3 안정 `rule_id`, ENG-4 사전 출처 메타 | R15 | 없음 | 스냅샷/스키마 테스트 |
| REL-1 exclude 정합 테스트 | — | 없음 | `research/` ↔ `_config.yml` 대조 |
| 코드서명 파이프라인·갱신 캘린더 | — | 인증서 | 릴리스 체크리스트 |
| ELE-3 `file://` → 커스텀 프로토콜 | — | ELE-1 영향 검증 | 앱 기동 E2E |

#### P3 — 결정 이후 또는 후속

| 항목 | 요구사항 | 의존 |
|---|---|---|
| 이벤트 스키마·수집·dedup·마스킹 구현 | R15·R16 | 계약 스파이크 결과, **거버넌스 정책 확정**, (OPEN-2) |
| NEW-I 후보 산출 스크립트 | R17 | **OPEN-2**, 스키마 |
| R13/R14 구현(확장 AI 경로) | R3·R13·R14 | **OPEN-1**, 스파이크 합격 |
| NEW-H 문장당 노출 제한 | R8 | 문장 경계 정의 |
| OpaqueRange 점진 도입 | R4 | 검증 필요(V-2) |
| 응답 캐시 | — | 스파이크 이후 |
| 확장 Rule Pack 적용(EXC-3) | R17 | 저장·권한 설계 |
| 서명 필수 모드 | — | 서명 방식 결정(V-9) |
| CSP `style-src 'unsafe-inline'` 제거 | — | 없음 |

### 11.4 노력 규모 (추정)

> S = 반나절~1일, M = 2~4일, L = 1주 이상. **작성자의 대략적 추정이며 측정값이 아니다.**

| 항목 | 규모 | 항목 | 규모 |
|---|---|---|---|
| NEW-A IME | S | NEW-C 사본 동기화 테스트 | S |
| NEW-B 계약 스파이크 | M | NEW-D 마크 순수 모듈 | S |
| 접근성 3층 문서화 | S | NEW-E 포커스 관리 + 팝오버 문서 | S |
| 오프라인 타겟 크기 실측·고정 | S | NEW-F 딥링크 | S (앵커 목록 선행 시 M) |
| OFF-1 경계 고정 테스트 | S | NEW-G E2E 편입 | S~M |
| ENG-1 오프셋 규약 | S | 스크롤바·글꼴 보정 | M |
| 퓨즈·게이트·권한·preload (패키징 시) | M | Rule Pack v2 + CI 게이트 | M |
| SBOM + SHA-256 | S~M | EXC-1~4 | M |
| 코드서명 파이프라인 | M | ENG-3 `rule_id` | M |
| ELE-3 커스텀 프로토콜 | M | 이벤트 수집·마스킹·dedup | L |
| R13/R14 구현 | L | NEW-I 후보 산출 | M |

### 11.5 완료 정의 (Definition of Done)

1. 해당 요구사항의 추적표(§3) 상태가 갱신되어 있다.
2. 신규/변경 로직에 대응 테스트가 있고 `npm test`가 통과한다. 분기는 양쪽 경로를 테스트한다.
3. 사본(확장 `lib/`·`offline-app/dist/`)이 있으면 동기화 테스트가 통과한다.
4. 오프라인판에 네트워크·AI·이력·URL 공유 코드가 들어가지 않았음을 OFF-1 테스트가 확인한다.
5. 비공개 문서를 추가했다면 같은 커밋에서 `_config.yml` exclude에 추가했다.

---

## 부록 A. R18~R20 (구현 품질·거버넌스·비용)

| ID | 요구 | 상태 | TRD |
|---|---|---|---|
| R18 | 신규 순수함수 vitest, `krds-lint.js` DRY, 구조화 로그 | PARTIAL — 순수 로직 테스트는 충실, `content.js` 오프셋 계산은 IIFE 안 (NEW-D), 사본 동기화 장치 없음 (NEW-C), 구조화 로그 없음 | §4.2.7, §8.3 |
| R19 | 데이터 거버넌스(전송 범위·PII·보존·export 게이트) | PARTIAL — 정책 문서만 있고 코드 없음(웹 이력 30일 TTL만 구현) | §4.5.2, §5.4 |
| R20 | AI 비용·지연(디바운스·캐시·규칙 1차 필터) | MISSING (AI 경로 부재) | §9 |

## 부록 B. 변경 이력

| 날짜 | 변경 |
|---|---|
| 2026-11-10 | 초안 작성 |
| 2026-11-10 | 문서 품질 점검 수행(상세는 비공개) |
