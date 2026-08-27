# KRDS UX Writing Assistant Offline — Electron 셸

`offline-app/`(정적 웹 앱: `index.html` + `app.js` + `dist/*.js`)을 Windows 담당자 PC에 배포하기 위한 최소 Electron 데스크톱 셸이다. 이 디렉터리는 `offline-app/index.html`, `app.js`, `dist/`를 감싸기만 하며 그 파일들의 로직에는 관여하지 않는다.

## 왜 이런 보안 설정을 했는가

| 설정 | 값 | 이유 |
|------|-----|------|
| `contextIsolation` | `true` | 렌더러(웹 페이지)의 JS 컨텍스트와 preload 스크립트의 컨텍스트를 분리해, 렌더러가 Node/Electron 내부 객체에 직접 접근하지 못하게 한다. |
| `nodeIntegration` | `false` | 렌더러 안에서 `require`, `process` 등 Node API를 아예 사용할 수 없게 한다. `offline-app`은 순수 브라우저 코드이므로 Node API가 필요 없다. |
| `sandbox` | `true` | 렌더러 프로세스를 OS 수준 샌드박스에 가둔다. |
| `preload.js` | 사실상 빈 파일 | `contextBridge`로 아무 API도 노출하지 않는다. 렌더러는 `window.KRDSLint`(dist/krds-lint.js)만 쓰면 되고 Electron 전용 API가 필요 없다. |
| `win.loadFile(...)` | 항상 로컬 `index.html` 경로만 | `loadURL`을 쓰지 않는다 — 원격 URL을 로드하는 코드 경로 자체가 없다. |
| `will-navigate` 차단 | `isAllowedNavigation()`으로 진입 파일 외 모든 네비게이션 차단 | 페이지 내 링크 클릭이나 버그로 외부 URL로 이동하는 것을 막는다. |
| `setWindowOpenHandler(() => ({action:'deny'}))` | 새 창/팝업 전체 차단 | `window.open()` 등으로 외부 브라우저 창이 뜨는 것을 막는다. |
| `Menu.setApplicationMenu(null)` | 기본 메뉴 제거 | "개발자 도구 열기" 등 최종 사용자에게 불필요한 메뉴 항목 노출 방지. |
| 서버 미기동 | `loadFile`만 사용, `http.createServer` 등 없음 | 로컬 포트를 열지 않는다. |

`offline-app/index.html`의 CSP(`default-src 'self'; script-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`)는 이미 엄격하다. Electron `file://` 로드 환경에서도 그대로 유효하며, 추가로 필요한 조정은 없다고 판단했다(별도 CSP 완화 불필요).

## 실행 방법

```bash
cd offline-app/electron
npm install          # electron을 devDependency로 로컬 설치 (이 디렉터리에만 설치됨)
npx electron .        # 앱 실행 (npm start 도 동일)
```

패키징(설치 파일 생성)은 이 스캐폴드에 포함하지 않았다 — 요청 범위는 "최소 스캐폴드"였고, `electron-builder`/`electron-forge` 도입은 별도 작업으로 판단.

## 실행 검증 여부 (정직하게 기록)

**이 환경에서 실제로 실행해 검증했다.**

- `npm install` (이 디렉터리 `offline-app/electron/`에서만 실행)로 `electron@44.0.0`을 devDependency로 설치.
  - 주의: 최초 시도 시 이 디렉터리에 `package.json`이 아직 없는 상태로 `npm install --save-dev electron`을 실행해, npm이 상위 디렉터리로 올라가 **루트 `package.json`/`package-lock.json`을 오염시키는 사고**가 있었다. `git checkout -- package.json package-lock.json`으로 즉시 되돌리고, 루트 `node_modules/electron` 등 잔여 패키지를 제거한 뒤 `npm install`로 루트를 원상복구했다. 이후 이 디렉터리에 `package.json`을 먼저 만들어두고 다시 설치해 문제를 재발시키지 않았다. 루트 `git status`가 클린한 상태임을 확인했다.
- `npx electron --version` / `node_modules/.bin/electron --version` 실행 → Electron 바이너리(v44.0.0, macOS arm64)를 실제로 다운로드하고 버전 출력까지 확인.
- `node_modules/.bin/electron .` 을 백그라운드로 실행(`timeout 8`)해:
  - 메인 프로세스, GPU 프로세스, 네트워크 서비스 유틸리티 프로세스, 렌더러 헬퍼 프로세스가 모두 정상 기동되는 것을 `ps aux`로 확인(즉, 창이 실제로 열렸다).
  - 렌더러 헬퍼 프로세스 커맨드라인에 `--enable-sandbox` 플래그가 포함되어 있음을 확인 — `sandbox: true` 설정이 실제로 적용됨을 프로세스 레벨에서 검증.
  - stdout/stderr 로그(`/tmp/electron-run.log`)에 에러 메시지 없음. `timeout 8`에 의해 `SIGTERM`으로 정상 종료됨을 확인.
- **하지 못한 것**: 렌더러가 실제로 발생시키는 네트워크 요청을 Chromium DevTools Protocol 등으로 정밀 계측하지는 않았다. `lsof`로 실행 중 열린 소켓을 훑어봤으나 다른 무관한 프로세스들과 섞여 있어 신뢰도 높은 결론을 내리긴 어려웠다. 다만 `index.html`의 CSP가 `connect-src 'none'`이고 `app.js`/`dist/*.js`에 `fetch`/`XMLHttpRequest`/`WebSocket` 호출이 코드 자체에 없음을 정적으로 확인했으므로(별도 에이전트 boundary-architect 보고 + 본인 직접 열람), 런타임에서도 네트워크 요청이 없을 것으로 판단한다 — 이 마지막 판단은 정적 분석에 근거한 추론이지, 트래픽을 직접 캡처해 "0건"을 실측한 것은 아니다.
- Windows 환경(실제 배포 대상 OS)에서는 검증하지 못했다. 이 검증은 macOS(Darwin arm64)에서만 수행됐다.

## 알려진 제약

- 코드 서명(macOS notarization, Windows Authenticode) 미적용 — 배포 전 별도 작업 필요.
- 자동 업데이트 기능 없음(의도적 — 오프라인 도구이므로 업데이트 체크 자체가 외부 통신이 된다).
- 패키징/인스톨러 생성 스크립트 없음(위 참고).
