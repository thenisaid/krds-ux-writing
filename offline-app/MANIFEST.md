# offline-app/ MANIFEST

`offline-app/`은 KRDS UX Writing Assistant Offline — 기관 담당자 PC에서 원문을 외부로 보내지 않고 문구를 점검하는 데스크톱 보조 도구의 독립적인 정적 웹 앱 소스다. 이 디렉터리는 저장소 루트의 웹 데모 서버 진입점, 서버리스 함수 라우트, 브라우저 확장 프로그램, 조사 자료, B2G 제안 패키지를 포함해 이 디렉터리 밖의 어떤 파일도 import·require·링크로 참조하지 않는다.

## 파일 목록

| 경로 | 역할 |
|------|------|
| `index.html` | 앱 진입점. textarea 입력 + 검사/지우기 버튼 UI, 결과 표시 영역, 기관 Rule Pack 적용 패널, 엄격한 CSP(`default-src 'self'; connect-src 'none'`) 메타 태그. 외부 CDN 참조 없음(시스템 폰트 스택만 사용). 인라인 `<script>` 없음. |
| `app.js` | UI 로직 전부. `window.KRDSLint.lint()` 호출 결과를 DOM에 렌더링하고, `window.KRDSRulePackValidator.validateRulePack()`으로 검증된 기관 Rule Pack의 승인 예외 용어를 후처리로 반영한다(krds-lint.js 자체는 수정하지 않음). `fetch`/`XMLHttpRequest`/`WebSocket`/`localStorage`/`sessionStorage`/URL 쿼리 공유 코드를 포함하지 않는다 — AI 제안, 자동 이력 저장, 링크 공유 기능은 이 앱에 존재하지 않는다(끄는 것이 아니라 애초에 코드가 없음). Rule Pack 파일 선택은 `FileReader`로 로컬에서만 읽으며 네트워크 호출이 아니다. |
| `rulepack-schema.js` | 기관 Rule Pack JSON 스키마 정의(필드 길이 제한, 날짜 형식, entries 최대 개수 500, 파일 크기 제한 100KB). 데이터 정의만 담고 검증 로직은 없다. |
| `rulepack-validator.js` | `validateRulePack(jsonString)` — Rule Pack JSON import 검증. **`JSON.parse`만 사용하며 `eval`/`new Function`/`Function` 생성자를 절대 사용하지 않는다.** 필수 필드 누락, 타입 불일치, 날짜 형식·순서 오류, 크기·개수 제한 초과를 한국어 오류 메시지로 모두 수집해 반환한다. |
| `dist/krds-lint.js` | 루트 `krds-lint.js`의 빌드 시점 복사본. **직접 편집 금지.** `node scripts/build-offline-app.js`로 재생성한다(단일 소스 오브 트루스는 루트 `krds-lint.js`). |
| `dist/jargon-dictionary.js` | 루트 `jargon-dictionary.js`의 빌드 시점 복사본. **직접 편집 금지.** 위와 동일한 방식으로 재생성한다. |
| `MANIFEST.md` | 이 문서. |

빌드 스크립트는 `offline-app/` 밖의 `scripts/build-offline-app.js`에 있다(저장소 루트의 기존 `scripts/` 관례를 따름). 이 스크립트는 루트 `krds-lint.js`, `jargon-dictionary.js`를 읽어 `offline-app/dist/`로 복사만 하며, 그 외 어떤 루트 파일도 참조하지 않는다.

## 실행 방법

```bash
node scripts/build-offline-app.js   # dist/ 재생성 (필요 시)
python3 -m http.server 8300 --directory offline-app
# → http://localhost:8300/index.html
```

## 의도적으로 제외된 것

- 네트워크 호출(생성형 AI 기반 제안, 원격 규칙 조회 등) — 오프라인 보장을 위해 코드 자체가 없음.
- 브라우저 저장소 기반 자동 이력 저장.
- URL 쿼리 파라미터를 통한 원문 공유.
- 루트 `lint-ui.js`(743줄, 생성형 AI 제안 호출·자동 이력·URL 공유 포함) — 재사용하지 않고 `app.js`를 완전히 새로 작성함.
- 외부 CDN(Google Fonts, jsDelivr 등) 참조 — 시스템 폰트 스택만 사용.
- KRDS 공식 인증, KWCAG 100% 준수, 나라장터 규격 준수 등 대외 인증·준수 주장 문구.
