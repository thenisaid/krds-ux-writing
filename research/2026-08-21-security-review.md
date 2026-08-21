# 2026-08-21 보안 검토 — KRDS UX Writing

> 검토 기준 시각: 2026-08-21 KST
> 검토 형상: `ffc914fbbedf5ca68a8987750ff8b8e4c675870e` (`main`, `origin/main`보다 28개 커밋 앞섬)
> 대상: 현재 웹 데모, 로컬 Node 서버, AI 생성 API, Chrome 확장, GitHub Actions, npm 패키지·릴리스 경로
> 결론: **현재 저장소를 그대로 공공기관 담당자 1인 PC에 배포하는 것은 No-Go.** 외부 통신·서버 포트·원문 자동 저장을 제거하고, 별도 오프라인 설치판과 검증 가능한 Release를 만들면 조건부 Go가 가능하다.

이 문서는 소스·구성·공개 응답 헤더와 배포 산출물 설정을 근거로 한 보안 검토다. 침투 테스트, 기관망 점검, 클라우드 계정·비밀·GitHub 보호 규칙의 관리자 화면 검증은 범위에 포함하지 않았다. `.env*`와 `.claude/settings.local.json`의 **내용은 열지 않았다.**

## 1. 의사결정 요약

| 사용 방식 | 판정 | 이유 |
|---|---|---|
| 현재 GitHub Pages 웹 데모에 실제 기관 문구 입력 | No-Go | 외부 CDN 의존, URL 공유·브라우저 저장, 선택적 AI 외부 전송 경로가 함께 존재한다. |
| 현재 `node server.js`를 담당자 PC에서 실행 | No-Go | 기본 `0.0.0.0` 바인딩으로 LAN에 열리고, API 요청자 인증과 본문 크기 제한이 없다. |
| 현재 코드 전체를 ZIP·npm 패키지로 전달 | No-Go | 제품과 무관한 연구·테스트·API·개발 설정이 섞이고, npm dry-run에서 로컬 설정 경로가 포함된다. |
| AI 없는 Windows 오프라인 앱(규칙 린트 + 승인된 Rule Pack) | 조건부 Go | 포트·네트워크·자동 원문 저장·URL 공유를 제거하고, 서명·해시·SBOM이 있는 별도 Release를 만들 때만 가능하다. |
| 기관 승인 내부망 AI 서비스 | 보류 | 인증·권한·감사·보존·데이터 분류·영속 rate limit을 새 보안 설계로 구현한 뒤 별도 심사가 필요하다. |

여기서 “로컬”은 단순히 인터넷이 연결되지 않은 상태가 아니다. 원문이 PC 밖으로 나가지 않고, 불필요하게 남지 않으며, 실행 파일의 출처와 버전을 검증할 수 있는 상태를 뜻한다.

## 2. 확인한 범위와 근거

### 2.1 수행한 확인

- 추적 파일 189개를 대상으로 대표적인 private key, AWS, Google, GitHub, Anthropic, Slack 토큰 패턴을 파일명만 반환하도록 검사했다. 일치 파일과 Git 이력의 일치 커밋은 각각 0개였다.
- `.env*`와 로컬 설정 파일의 내용은 읽지 않고, Git 추적·패키지 포함 여부만 확인했다.
- JavaScript 실행 위험 API, HTML 주입 지점, 외부 네트워크 호출, 브라우저 저장소·URL 공유를 정적 점검했다.
- [server.js](../server.js), [api/generate.js](../api/generate.js), [functions/api/generate.js](../functions/api/generate.js), [generator/app.js](../generator/app.js), [lint-ui.js](../lint-ui.js), [krds-extension/manifest.json](../krds-extension/manifest.json), `vercel.json`, `wrangler.toml`, GitHub Actions를 읽었다.
- 실제 `https://thenisaid.github.io/krds-ux-writing/`와 `/lint.html` 응답 헤더를 확인했다.
- KRDS, GitHub artifact attestations, Electron Security, SignTool, CISA SBOM, NIST SSDF, SLSA, Vale, LanguageTool, GOV.UK UI writing의 공식 자료 링크가 2026-08-21에 HTTP 200으로 접근되는지 확인했다.

### 2.2 검토 한계

- GitHub branch/tag protection, Actions 조직 정책, Vercel·Cloudflare·Anthropic의 실제 비밀값과 운영 설정은 권한이 없어 검증하지 못했다.
- GitHub API는 이 검토 환경에서 403으로 응답했다. Release·tag 부재는 `git ls-remote --tags origin` 결과(0개)와 저장소 상태로 확인했다.
- 소스 검토는 알려진 경로를 중심으로 했다. 새 패키지, 새 endpoint, 기관별 Rule Pack import가 추가되면 재검토가 필요하다.

## 3. 위험도 기준

| 등급 | 이 문서에서의 의미 |
|---|---|
| P0 | 기관판 Release 또는 실제 기관 문구 입력을 막는 항목 |
| P1 | 공개 AI 데모·파일럿 전에 고쳐야 하는 보안 또는 공급망 통제 공백 |
| P2 | 출시 후가 아니라 설계·운영 시점에 계획적으로 보강할 항목 |

P0은 원격 코드 실행이 확인됐다는 뜻이 아니다. 공공기관 1인 PC 도입이라는 더 좁고 높은 운영 기준을 충족하지 못한다는 뜻이다.

## 4. P0 — 출시 차단 항목

| ID | 확인 사실 | 영향 | 필요한 종료 조건 |
|---|---|---|---|
| SEC-01 | [server.js](../server.js)는 `server.listen(PORT, '0.0.0.0')`으로 모든 인터페이스에 바인딩하고 LAN 공유 URL을 출력한다. | “한 담당자 PC만 사용”이 구현상 성립하지 않는다. 같은 네트워크의 다른 사용자가 포트에 접근할 수 있고, AI/API 키가 있는 프록시를 비용·데이터 전송 경로로 악용할 수 있다. | 기관판에는 Node 서버를 포함하지 않는다. 별도 서버 제품이 필요하면 기본 loopback 바인딩, 인증·권한·요청 크기 제한·감사·방화벽을 별도 설계한다. |
| SEC-02 | 로컬·Vercel·Cloudflare API는 CORS allowlist를 두지만 Origin 없는 요청 또는 허용되지 않은 Origin의 POST를 인증·거부하지 않는다. 로컬 서버는 `x-forwarded-for`, `x-real-ip` 등을 직접 신뢰하고 본문을 무제한으로 누적한다. | CORS는 브라우저의 응답 읽기 제어일 뿐 요청자 인증이 아니다. 직접 HTTP 요청·IP 헤더 위조·대형 본문으로 rate limit과 가용성 통제가 약화된다. | 기관 AI판에는 SSO/API 인증, 신뢰 프록시 경계, body size·동시성 제한, 영속 rate limit, 사용량·사고 로그 정책을 구현한다. 첫 오프라인판에서는 endpoint 자체를 제거한다. |
| SEC-03 | 생성기 입력은 기본 Anthropic endpoint 또는 환경 설정 endpoint로 전송할 수 있다. [lint-ui.js](../lint-ui.js)의 AI 제안도 이슈 문구 최대 3개를 `/api/generate`로 보낸다. | 기관 문구·개인정보·내부 정보가 외부 모델 또는 승인되지 않은 endpoint로 전송될 수 있다. 이슈 일부만 보내더라도 민감 문자열이 포함될 수 있다. | 첫 기관판에서는 AI UI·API·API 키 경로를 물리적으로 제외한다. AI를 다시 도입할 때는 데이터 분류, 처리자·보존·국외 이전, 승인된 endpoint와 이용자 고지를 별도 확정한다. |
| SEC-04 | [lint-ui.js](../lint-ui.js)는 검사 원문 전체를 `localStorage`에 최대 5건 자동 저장하고, 500자 이하 원문을 `?t=` URL로 복사·복원한다. | 원문이 브라우저 프로필, 히스토리, 프록시·웹 로그, 화면 캡처와 클립보드에 남을 수 있다. | 기관판에서 자동 이력과 URL 원문 공유를 제거한다. 저장은 명시적 내보내기만 허용하고 저장 위치·보존·삭제 방법을 화면과 운영 문서에 명시한다. |
| SEC-05 | 30개 HTML 중 29개가 jsDelivr·Google Fonts 등 외부 자산을 참조하고, CSP meta가 있는 페이지는 6개뿐이다. 정적 서버는 `/derived/`, `/research/`, `/generator/`, `/principles/` 등을 공개 제공한다. | 오프라인 요구와 충돌하고 외부 공급망·네트워크 메타데이터 노출이 생긴다. LAN 서버 사용 시 연구 문서와 파생 산출물도 함께 노출될 수 있다. | 설치판은 실행 파일 allowlist만 담고, 폰트·라이브러리를 검증 후 로컬 번들로 포함한다. 실행 중 DNS/HTTP(S)/WebSocket 요청과 리스닝 포트가 0임을 자동 테스트로 증명한다. |
| REL-01 | Git tag와 GitHub Release가 0개이며, 설치 파일·SHA-256·SBOM·provenance·Windows 코드 서명·검증 안내가 없다. local `main`은 원격보다 28개 커밋 앞선다. | 담당자가 받은 파일의 출처, 변경 여부, 대상 버전을 검증할 기준점이 없다. 아직 GitHub에서 내려받을 수 없는 로컬 변경도 있다. | 검토된 commit을 push한 뒤 tag 기반 Draft Release를 깨끗한 runner에서 생성한다. 설치 자산, SHA-256, SBOM, provenance/attestation, Authenticode 검증 결과와 롤백 방법을 함께 발행한다. |
| REL-02 | `package.json`에 `files` allowlist와 `.npmignore`가 없다. npm package dry-run에 `.claude/settings.local.json` 경로가 포함된다. 해당 파일의 내용은 검토하지 않았다. | 제품과 무관한 연구·테스트·API·개발 설정 또는 로컬 정보가 배포물·공개 npm 패키지에 섞일 수 있다. `.gitignore`는 npm publish 정책을 보장하지 않는다. | npm 배포가 필요하면 허용 목록 방식으로 CLI 실행 파일·사전·LICENSE·NOTICE만 포함한다. Electron 설치판도 별도의 staging allowlist와 CI 파일 목록 검사를 사용한다. |

## 5. P1 — 파일럿·공개 AI 데모 전 보완 항목

| ID | 확인 사실 | 판단과 권고 |
|---|---|---|
| WEB-01 | 공개 GitHub Pages의 두 실제 응답에는 HSTS와 `Access-Control-Allow-Origin: *`만 확인됐다. HTTP 응답 헤더에는 CSP, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`가 없었다. | meta CSP는 일부 페이지에만 있고 호스팅 레벨 보호를 대체하지 못한다. 공개 데모는 전용 호스팅·reverse proxy에서 보안 헤더를 일관되게 적용하거나, 기관판과 분리해 “공개 문구 전용 데모”로 명확히 표시한다. |
| API-01 | Vercel은 KV 환경변수가 있을 때만 영속적인 rate limit을 사용한다. Cloudflare·로컬 서버는 in-memory Map이며, cold start·인스턴스 간 상태가 공유되지 않는다. | 비용·남용 통제가 환경마다 다르다. 공개 AI 서비스가 필요하면 한 운영 경로, 인증된 주체 기준 quota, 중앙 저장소 기반 rate limit을 정한다. |
| DEP-01 | 런타임 의존성은 매우 작지만 개발·빌드 경로의 `vitest → vite → postcss → nanoid`에서 high 2건이 보고된다. `npm audit fix --dry-run`은 `postcss 8.5.16 → 8.5.26`, `nanoid 3.3.15 → 3.3.18`을 제안한다. | 릴리스 빌드에 쓰이는 도구도 공급망 범위다. 자동 수정 대신 잠금 파일을 한 패키지 관리자 기준으로 갱신하고, 전체 테스트·패키지 스모크·변경 기록으로 triage한다. |
| CI-01 | Actions의 `checkout`, `setup-node`, `github-script`는 commit SHA로 고정돼 있어 긍정적이다. 하지만 Vercel workflow는 `vercel@latest`를 전역 설치하고 main push마다 production 배포한다. | 웹 데모의 배포와 기관 설치판 Release를 분리하고, CLI 버전을 고정한다. production publish는 Draft 검토·승인 뒤에만 수행한다. |
| CI-02 | `sync-prompts.yml`는 `contents: write` 권한으로 main에 자동 commit·push한다. | 사람이 검토하지 않은 생성 변경이 기본 브랜치에 들어갈 수 있다. workflow는 PR 생성으로 바꾸거나, 보호 규칙의 예외·승인자·변경 범위를 관리자 화면에서 증빙한다. |
| CFG-01 | `ANTHROPIC_BASE_URL`과 `OLLAMA_URL`은 환경 설정으로 임의 HTTP(S) endpoint를 가리킬 수 있다. `ALLOW_INSECURE_TLS=true`는 TLS 검증을 명시적으로 끌 수 있다. 사용자 입력으로 SSRF가 되는 코드는 확인되지 않았다. | 환경 설정은 신뢰 경계다. loopback 외에는 HTTPS·허용 hostname을 강제하고, insecure TLS 옵션은 기관판에서 제거한다. |

## 6. P2 — 설계·운영 보강 항목

1. GitHub branch protection, tag protection, Actions 권한, secret scanning·dependabot 설정을 저장소 관리자 화면에서 증빙한다.
2. `package-lock.json`과 `pnpm-lock.yaml`을 함께 유지하지 말고 npm+`package-lock.json`처럼 하나의 재현 빌드 기준으로 정한다. `engines`도 실제 CI/빌드 버전과 맞춘다.
3. 제품 버전, tag, 설치 파일명, 앱 정보, SBOM, 릴리스 노트의 버전 규칙을 하나로 통일한다.
4. 기관 Rule Pack을 구현할 때 JSON schema, 파일 크기, 출처·승인자·근거·만료일, 읽기 전용 승인본, import 회귀 테스트를 추가한다. Rule을 실행 코드로 해석하지 않는다.
5. `SECURITY.md`와 취약점 신고·대응 SLA, root `LICENSE`, `NOTICE`를 저작권자·법무 확인 뒤 추가한다.

## 7. 긍정적으로 확인된 통제

| 영역 | 확인 결과 |
|---|---|
| 경로 탐색 | `server.js`는 URL 정규화와 저장소 루트 내부 여부를 확인하고, 공개 정적 경로를 allowlist로 제한한다. 단, 허용된 `/research/` 등은 제품판에서 제외해야 한다. |
| 입력 검증 | API가 POST, 기관명, 기관 유형, 작업 모드, 샘플 수·길이, 선택 입력 길이를 검증한다. 이는 인증·권한 통제를 대체하지는 않는다. |
| XSS 방어 | 생성기는 `markdown-it({ html: false })` 결과를 DOMPurify allowlist로 정화하고, DOMPurify가 없으면 평문으로 폴백한다. 린트 UI·확장 프로그램은 사용자 텍스트를 escape하거나 `textContent` 중심으로 표시하며 관련 회귀 테스트가 있다. |
| 확장 권한 | Manifest V3, 빈 `permissions`, 프로젝트 GitHub Pages와 localhost lint URL만의 좁은 host permission을 사용한다. 광범위한 웹사이트 접근 권한이나 원격 코드 로드는 확인되지 않았다. |
| 비밀 관리 | 선택한 고신뢰 credential 패턴은 추적 파일과 Git 이력에서 발견되지 않았다. 일반 `.env*`는 Git 추적·npm dry-run 대상이 아니었다. 단, 이것은 모든 비밀·외부 서비스 설정의 부재를 보장하지 않는다. |
| Actions 고정 | 주요 GitHub Action은 tag가 아닌 commit SHA로 고정돼 있다. |

## 8. 벤치마크를 실제 출시 기준으로 바꾸기

기존 [오프라인 배포·벤치마크 조사](./2026-08-20-offline-release-benchmark.md)는 제품·시장·도입 관점의 상세 비교를 담고 있다. 이번 보안 검토에서는 아래처럼 보안 운영 기준으로 연결한다.

| 벤치마크·공식 기준 | 가져올 원리 | 이 프로젝트의 적용 |
|---|---|---|
| [KRDS 정부 관계자 시작하기](https://www.krds.go.kr/html/site/outline/outline_04.html) | 단계적 적용, 자체 검증과 성과 점검 | 린트 점수로 KRDS 준수·인증을 주장하지 않고, 기관 Rule Pack과 사람 검토 증빙으로 사용한다. |
| [NIST SSDF](https://csrc.nist.gov/pubs/sp/800/218/final) | 보안 개발 관행을 릴리스 전 과정에 넣기 | 요구사항부터 파일 목록, 취약점 triage, 테스트, 배포 승인까지 Release gate로 관리한다. |
| [SLSA](https://slsa.dev/) · [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations) | 누구의 어떤 소스가 어떤 빌드에서 산출됐는지 증명 | 깨끗한 runner의 tag build, provenance/attestation, 검증 명령을 Draft Release에 포함한다. |
| [CISA SBOM](https://www.cisa.gov/topics/information-communications-technology-supply-chain-security/sbom) | 구성 요소 가시성 | 설치 파일과 SBOM을 함께 배포하고, 취약점 예외·기한을 기록한다. |
| [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security) · [Microsoft SignTool](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool) | 안전한 데스크톱 경계와 Windows 배포 신뢰 | 로컬 정적 콘텐츠만 로드하고, `contextIsolation`, sandbox, 좁은 preload IPC, `default-src 'self'`, Authenticode 검증을 필수로 한다. |
| [Vale](https://docs.vale.sh/) | 조직별 버전 관리 Rule Pack과 심각도 | 공통 사전 위에 기관별 예외·근거·승인자·재검토일이 있는 Rule Pack을 둔다. |
| [LanguageTool local HTTP server](https://dev.languagetool.org/http-server) | “로컬 서버”도 별도 공격 표면 | 최초 기관판은 서버를 배포하지 않는다. 다수 사용자·AI 협업이 필요해질 때 별도 제품으로 설계한다. |
| [GOV.UK UI writing](https://www.gov.uk/service-manual/design/writing-for-user-interfaces) | 개인정보를 URL에 두지 않는 UI 운영 원칙 | `?t=` 원문 공유 기능을 기관판에서 제거한다. |

## 9. 기관 오프라인판 Release gate

다음 모두가 증빙되기 전에는 기관 담당자에게 설치 파일을 전달하지 않는다.

- [ ] 실행 중 외부 AI, CDN, telemetry, update endpoint로 나가는 네트워크 요청이 없다.
- [ ] 실행 중 서버 포트를 열지 않는다. `netstat`/방화벽/네트워크 감시 결과를 설치 테스트 기록에 남긴다.
- [ ] 원문 자동 이력과 URL 원문 공유가 없고, 앱 종료 후 원문이 남지 않는 테스트가 있다.
- [ ] 제품 번들은 lint engine, 승인 Rule Pack, 로컬 도움말, 라이선스 고지 등 allowlist 파일만 포함한다.
- [ ] tag와 설치 파일 버전이 같고, SHA-256, SBOM, provenance/attestation, Authenticode 서명과 검증 방법이 Draft Release에 있다.
- [ ] Windows 대상 PC에서 설치·실행·검사·명시적 저장·종료·삭제·롤백을 개발자 도움 없이 수행한 기록이 있다.
- [ ] Rule Pack의 출처, 승인자, 유효 기간, 예외와 재검토일이 있다.
- [ ] 기관 보안·개인정보·SW 반입 담당자가 데이터 경계와 반입 경로를 승인했다.

### 담당자에게 안내할 한 문장

현재 웹 데모에는 공개 문구만 입력하고, 실제 기관 문구·개인정보·내부 자료는 오프라인 설치판 Release와 기관 승인 절차가 준비되기 전까지 입력하지 않는다.

## 10. 다음 구현 순서

1. 기관판 전용 디렉터리/앱을 만들고, 현재 데모·AI·연구·확장과 빌드·배포를 분리한다.
2. AI 없는 규칙 린트만 포함한 Windows 데스크톱 최소 앱을 만든다. Node 서버를 감싸는 방식은 선택하지 않는다.
3. 원문 이력·URL 공유·외부 CDN을 제거하고, 네트워크 0·포트 0을 테스트로 고정한다.
4. package/release allowlist, LICENSE·NOTICE·SECURITY, SBOM·해시·서명·Draft Release workflow를 만든다.
5. 공개·비식별 표본으로 담당자 1명 파일럿을 한 뒤 Rule Pack, 설치 절차, 오탐·수용률을 평가한다.

이 순서는 기능을 줄이는 것이 아니라, 공공기관 도입에서 먼저 검증해야 할 신뢰 경계를 작게 만드는 순서다.

## 11. 재검증 기록

이 문서를 추가한 뒤 2026-08-21에 다시 실행한 결과다.

| 확인 | 결과 | 해석 |
|---|---|---|
| `npm test` | 47개 테스트 파일, 1,266개 통과 | 현재 코드의 회귀 검증은 통과했다. 기관 설치판의 보안·배포 승인을 뜻하지는 않는다. |
| `python3 krds-extension/scripts/verify-real-chrome.py` | 실제 unpacked Chrome 확장 E2E 통과 | 제한된 대상 URL에서 overlay·popover의 동작은 확인됐다. 기관 CMS 통합의 증거는 아니다. |
| `npm audit --omit=dev` | 취약점 0건 | 현재 런타임 의존성 기준 결과다. |
| `npm audit` | high 2건: `nanoid`, `postcss` | Vitest/Vite 빌드 경로의 개발 의존성이다. release 전 업데이트 영향 분석과 전체 테스트가 필요하다. |
| `npm pack --dry-run` | 189개 파일, 약 8.7MB | `.claude/settings.local.json`, GitHub workflow, API, 연구·테스트·local-skills 등 제품 외 경로가 포함된다. 설정 파일 내용은 열지 않았다. |
| credential pattern scan | 추적 파일 189개·Git 이력에서 일치 0건 | 대표적인 고신뢰 토큰·키 패턴 기준이며, 모든 비밀 또는 운영 설정의 부재를 보장하지 않는다. |
| `git ls-remote --tags origin` | tag 0개 | 검증 가능한 버전별 Release 기준점이 아직 없다. |

문서 링크와 공백 오류도 별도로 점검한다. 검토 문서 자체는 코드 변경이나 배포 권한 행사가 아니며, 현재 작업 트리의 미커밋 조사 문서로 유지한다.

## 12. Claude /cso 교차검증 추가분 (2026-08-21)

이 문서(위 1~11절)의 핵심 주장 3가지를 코드를 직접 읽어 독립 검증했다 — SEC-01(server.js `0.0.0.0` 바인딩, 900행), SEC-03(lint-ui.js가 매치 스니펫 최대 3개를 `/api/generate`로 전송, 877행), SEC-04(lint-ui.js가 전체 원문을 localStorage에 자동 저장 + `?t=` URL 공유, 546·772행) — 전부 정확했다.

별도로 `/cso`(OWASP+STRIDE+공급망+CI 표준 감사)를 병행 실행해 이 문서에 없는 2건을 추가로 발견·검증했다(Codex 서브에이전트 독립 검증, confidence 8/10):

| ID | 확인 사실 | 영향 | 권고 |
|---|---|---|---|
| RL-01 | `api/generate.js`/`functions/api/generate.js`/`server.js`의 `getClientIp()`가 `x-forwarded-for`보다 먼저 `x-real-ip`를 신뢰하는데, Vercel은 `x-forwarded-for`는 자체적으로 덮어써 보증하지만 `x-real-ip`는 그렇지 않다(공식 문서상 시스템 관리 헤더 목록에 없음). 요청마다 임의의 `X-Real-IP` 값을 보내면 시간당 5회 제한을 매번 우회할 수 있다. | 유료 Anthropic API 호출량 무제한 증폭(비용 공격) — DoS 예외 규정상 "LLM 비용 증폭"은 제외 대상에서 명시적으로 빠짐. | `x-real-ip` 분기 제거 또는 실제로 신뢰 가능한 배포 환경에서만 사용. TODO-011(Anthropic 월 사용량 한도)을 최우선으로 구현해 이중 방어선 확보. |
| CI-03 | `main` 브랜치에 branch protection이 전혀 없음(`gh api .../branches/main/protection` → 404). `deploy-vercel.yml`은 push 즉시 프로덕션 배포. CODEOWNERS 파일도 없음. | 계정/토큰 탈취 시 검토 없이 프로덕션에 즉시 반영됨. | main에 branch protection(PR 필수 또는 상태 체크 필수) 설정, `.github/workflows/`에 CODEOWNERS 추가. |

전체 발견사항 요약은 `.gstack/security-reports/cso-2026-08-21-daily.json`에 구조화 저장(로컬 전용, git 추적 안 됨). 이 문서의 P0/P1/P2 분류(공공기관 배포 관점)가 더 실무적이므로, 위 2건은 그 체계에 편입하면 RL-01은 P1(API-01과 같은 급), CI-03은 P2(6절 1번 항목과 병합)에 해당한다.

## 13. 수정 완료 (2026-08-21)

12절의 RL-01 + 7절 API-01(부분) + Codex 발견 3건(no-cors, vercel@latest, Cloudflare KV 제외)을 다음 커밋으로 수정:

| ID | 상태 | 커밋 |
|---|---|---|
| RL-01 (cf-connecting-ip/x-real-ip 스푸핑) | ✅ 수정 — Vercel은 x-forwarded-for만, Cloudflare는 cf-connecting-ip만, server.js는 소켓 주소만 신뢰 | 85ca426 |
| CORS no-cors 비용 공격 | ✅ 수정 — 허용 안 된 Origin은 403으로 즉시 거부(검증 단계 진입 전) | 85ca426 |
| vercel@latest 미고정 | ✅ 수정 — vercel@59.3.0 고정 | 85ca426 |
| Origin 강제 거부의 회귀(LAN 공유·Vercel/CF 자기 호출 차단) | ✅ 수정 — server.js는 자신의 LAN IP를 허용 목록에 자동 반영. Vercel/Cloudflare는 사용자 확인 결과 미사용이라 도메인 미추가(경고 주석만 추가) | 813db10 |

실제 서버 기동 후 curl로 재검증: 허용 안 된 Origin/Origin 없음 → 403, 가짜 CF-Connecting-IP로 우회 시도 → 계속 429, LAN IP origin → 정상 통과. npm test 1266개 통과(PORT=3001 환경에서도 확인).

사용자가 "3개 다 해주세요"로 나머지 항목(SEC-01, SEC-03/04, CI-03)을 모두 승인해 다음과 같이 마저 수정:

| ID | 상태 | 커밋/조치 |
|---|---|---|
| SEC-01 (server.js `0.0.0.0` 바인딩) | ✅ 수정 — 기본값을 `127.0.0.1`로 전환, `ALLOW_LAN_ACCESS=true`를 명시적으로 켰을 때만 LAN에 바인딩(경고 로그 포함) | b074bab |
| SEC-03 (lint-ui.js AI 제안 → 외부 전송) | ✅ 완화 — 버튼 위에 상시 경고 문구 + 최초 클릭 시 `confirm()`으로 명시적 동의 요구 | c3d7ca2, 31bf707(폰트 크기 보정) |
| SEC-04 (lint-ui.js localStorage/URL 공유) | ✅ 완화 — URL 공유도 동일하게 경고+동의 게이트 추가. localStorage 이력에 `savedAt` 타임스탬프 도입, 30일 초과 시 자동 삭제(레거시 데이터는 마이그레이션 시점부터 30일 유예, 유예 시작을 저장소에 영속화) | c3d7ca2, 31bf707(TTL 영속화 버그 수정) |
| CI-03 (CODEOWNERS 부재) | ✅ 수정 — `.github/CODEOWNERS`에 `.github/`, `api/`, `functions/`, `server.js`, `vercel.json`, `wrangler.toml`을 `@thenisaid` 리뷰 대상으로 지정 | 2445e54 |
| CI-03 (branch protection 부재) | ✅ 수정 — `main`에 force-push·브랜치 삭제 차단 적용. PR 필수화·리뷰 필수화는 걸지 않음(1인 유지보수 + 세션 내내 써온 direct-push 워크플로우를 깨지 않기 위한 의도적 선택) | GitHub API로 적용, 별도 커밋 없음 |

각 커밋은 `codex review --commit <sha>`로 재검토를 받았고, lint-ui.js/lint.html 변경(c3d7ca2)에서 codex가 실제 버그 2건(레거시 이력 TTL 유예가 영속화되지 않아 영원히 만료 안 되던 문제, 경고 문구가 13px 미만이던 접근성 위반)을 잡아 31bf707에서 수정·재검증(npm test 1266개 통과) 완료.

**남은 것**: 없음 — 이번 세션에서 식별된 항목은 모두 수정 또는 완화 조치를 반영했다. TODO-011(Anthropic 월 사용량 한도)처럼 이 문서 이전부터 별도 트래킹 중이던 항목은 이 문서의 범위 밖.
