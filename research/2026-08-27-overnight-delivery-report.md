# 2026-08-27 야간 작업 결과 보고 — "공공기관 납품 가능한 수준" 1차 스프린트

> 작업 시각: 2026-08-27 17:34 ~ 19:30 (약 2시간, `/loop` 자율 루프 + `/team-assemble` 병렬 팀)
> 방법론: RSI(계획→실행→채점→판단 반복, codex를 채점자로 사용)
> 대상 커밋 범위: `af8118a`..`b31c4c0` (24개 커밋)

## 정직한 스코프 정의

사용자 요청은 "내일 오전 6시까지 공공기관에 납품할 수 있는 수준까지 끌어올려 달라"였다. `research/2026-08-20-project-audit-business-strategy.md`, `research/2026-08-20-audit-evidence-matrix.md`, `research/2026-08-20-offline-release-benchmark.md` 3개 감사 문서가 이미 이 목표를 90일 계획(0~30일 / 31~60일 / 61~90일)으로 잡아뒀다. 그중 Windows 코드 서명, SBOM 발급, 실기관 파일럿, 실제 담당자 사용성 테스트는 이 세션(AI 에이전트, 물리 하드웨어·인증서·기관 승인 없음)에서 원천적으로 수행 불가능하다.

따라서 이번 스프린트는 **"0~30일: 제품 경계와 설치판 최소화" 단계의 P0 항목 전부 + 코드만으로 가능한 일부 P1 항목**으로 스코프를 정직하게 한정했다. 아래는 "완료했다"고 부를 수 있는 것과 "여전히 남아있다"고 불러야 하는 것을 구분한 기록이다.

## 완료한 것 (코드로 구현, codex 재검토, npm test로 검증)

### P0 — 제품 경계 분리
1. **`offline-app/` 신설** — 공공기관 오프라인판을 웹 데모/서버/AI/확장/연구자료와 물리적으로 분리된 독립 디렉터리로 신설. 규칙 기반 린트 엔진만 포함, AI 제안 fetch·자동 이력 저장(localStorage)·URL 공유 기능은 애초에 코드에 존재하지 않음. 외부 CDN 미사용, `connect-src 'none'` 포함 엄격한 CSP. 실제 브라우저(Playwright)로 검사 동작·네트워크 요청 0건 확인.
2. **기관 Rule Pack 기능** — JSON 스키마(`offline-app/rulepack-schema.js`) + `JSON.parse`만 쓰는 import 검증기(`offline-app/rulepack-validator.js`, eval/new Function 절대 미사용을 테스트로 증명) + UI 통합. 이슈 집계·품질 점수에서 예외 처리된 항목을 정확히 재계산하도록 구현.
3. **최소 Electron 스캐폴드** — `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, `loadFile`만 사용(원격 URL 로드 없음), `will-navigate`/새 창 차단. 실제로 Electron 바이너리를 설치해 `electron .`로 기동, 프로세스 트리에 `--enable-sandbox` 플래그 존재까지 확인(단, DevTools Protocol 기반 네트워크 정밀 계측과 Windows 환경 검증은 하지 못함 — `offline-app/electron/README.md`에 한계를 명시).
4. **LICENSE / NOTICE / SECURITY.md** — MIT 전문, KRDS 비공식·비인증 고지, 국립국어원 데이터 출처 고지(재배포 사실 정정 포함), 현실적인(과장 없는) 취약점 신고 절차.
5. **B2G 문서 대외 배포 금지 경고** — `b2g-service-package/` 4개 파일에 배너 추가, 원본 내용은 무수정.
6. **GitHub Pages / Vercel / npm 3중 배포 경계 차단** — 실제 공개 채널이 Vercel이 아니라 **GitHub Pages(legacy Jekyll build, main 브랜치 루트 그대로 서빙)**임을 codex 재검토로 발견해, `_config.yml`(Jekyll exclude, research/ 안 비공개 파일 14개 개별 나열 — 디렉터리 통째 제외는 include로 복구 불가하다는 codex 지적 반영)과 `.vercelignore`(gitignore 문법, negation 정상 동작) 이중으로 차단. `package.json`의 `files` 필드로 npm 배포판(9개 파일, 122.9kB)도 별도로 좁힘.
7. **배포 산출물 검증 스크립트** — `release-manifest.json`(단일 소스 오브 트루스) + `scripts/verify-release-manifest.js`(npm 번들) + `scripts/verify-offline-app-bundle.js`(오프라인 앱 번들, MANIFEST.md 문서 드리프트까지 검출). 둘 다 실제로 깨뜨려서 검증기가 잡아내는지 확인 후 원복.

### P1 — 공급망·의존성 (코드만으로 가능한 것)
8. **`pnpm-lock.yaml` 제거** — CI가 npm만 쓰는데 두 잠금파일이 공존하던 것을 정리, `.gitignore`로 재발 방지.
9. **`engines.node` 현실화** — `>=14` → `^20.19.0 || >=22.12.0`(Vite 8.1.3/Vitest 4.1.6 실제 요구사항과 CI Node 20 기준에 정확히 일치, 21.x 오허용 문제까지 codex가 잡아 정정).
10. **개발 의존성 취약점 2건(high) 해결** — nanoid, postcss를 `npm audit fix`로 업데이트, `npm audit` 0건.
11. **오프라인 앱 독립 버전 표기** — `v0.1.0`, 왜 산출물별로 버전이 다른지 README에 정책 문서화.

### 검증 상태
- `npm test`: **50개 파일, 1366개 테스트 전부 통과** (스프린트 시작 시점 1268개 → 신규 98개 테스트 추가, 회귀 0건)
- `npm audit`: **0 vulnerabilities**
- 커밋 24개 중 22개는 `codex review`로 재검토(문제 발견 시 새 커밋으로 즉시 반영, amend 없음), 2개(순수 문구 정정)는 동일 계열의 직전 검토로 갈음
- 과장 대외 주장(KRDS 인증·KWCAG 100%·나라장터 규격 준수 등) 신규 유입 없음을 전체 변경 파일 대상으로 grep 스윕
- **git push는 하지 않았다** — 로컬 커밋만 61개가 origin/main보다 앞서 있는 상태(사용자 승인 없이 원격에 반영하지 않는다는 이번 세션의 원칙 유지)

## 아직 남아있는 것 (정직하게 기록)

### 이 환경에서 원천적으로 불가능
- Windows 설치 파일 빌드·코드 서명(Authenticode)·SBOM 발급·Windows VM 스모크 테스트
- 실기관 담당자 파일럿, 실사용성 검증
- 실제 GitHub Release 발행(현재 로컬 커밋 61개가 아직 push되지 않은 상태 — push 자체가 별도 승인이 필요한 결정)

### 코드로는 가능하지만 이번 스프린트에서 의도적으로 보류
- **웹 데모 30개 HTML 페이지의 CSP/외부 CDN 정리(SEC-06)** — 감사에서 P0(오프라인판)/P1(웹 데모)로 지적됐지만, 이미 실사용 중이고 QA 이력이 긴 공개 사이트 전체를 광범위하게 건드리는 작업이라 리스크 성격이 오늘 밤의 "새 디렉터리 신설" 작업들과 다르다고 판단해 보류했다. 사용자의 명시적 승인 후 별도 스프린트로 진행 권장.
- **package.json(0.1.0) vs VERSION 파일(0.1.0.2) 버전 불일치(REL-06)** — 기존 릴리스 이력과 충돌할 위험이 있어 임의로 하나를 바꾸지 않았다. README에 산출물별 버전 정책만 문서화해뒀다.
- **branch protection 강도** — 지난 세션에서 이미 force-push/삭제 차단은 적용됨(PR 필수화는 걸지 않음, 이번 세션에서 변경 없음).

## 다음에 사람이 결정해야 할 것
1. 로컬 61개 커�밋을 origin/main에 push할지 (push 시 GitHub Pages가 새 콘텐츠로 다시 빌드되므로, `_config.yml` exclude가 실제로 의도대로 동작하는지 push 직후 반드시 재확인 필요).
2. 웹 데모 CSP/CDN 정리를 언제 별도로 진행할지.
3. Electron 설치 파일 실제 빌드·서명·Windows 검증을 누가/언제 맡을지(이 저장소 밖의 작업).
4. package.json/VERSION 버전 정책을 언제 통일할지.
