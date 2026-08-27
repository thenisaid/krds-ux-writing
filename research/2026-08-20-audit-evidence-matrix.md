# KRDS UX Writing 프로젝트 전체 검수 증거 매트릭스

> 확인일: 2026-08-20<br>
> 대상 커밋: ffc914fbbedf5ca68a8987750ff8b8e4c675870e<br>
> 범위: 저장소 코드·문서·워크플로·공개 GitHub 상태·배포 후보·테스트·공식 벤치마크<br>
> 제외: 기관 내부망 정책, 실제 Windows 설치판, 계약·법률·개인정보의 최종 적합성, 고객 인터뷰는 이 저장소만으로 검증할 수 없다.

## 1. 감사 판정

| 대상 | 판정 | 근거 | 다음 결정 |
|---|---|---|---|
| 규칙 엔진과 현재 웹 데모 | 제한적 Go | 47개 테스트 파일과 1,266개 테스트가 통과했고, 실제 unpacked Chrome 확장 검증도 통과했다. | 공개·비식별 문구의 데모·연구·Rule Pack 설계 재료로 사용한다. |
| 현재 저장소를 그대로 기관 PC에 배포 | No-Go | 서버·AI·외부 CDN·원문 이력·URL 공유·연구·제안서·개발 설정이 섞여 있다. | 기관판 전용 앱과 빌드 경계를 새로 만든다. |
| 공개 AI 생성 웹 서비스 | No-Go for 기관용 | 외부 Anthropic 호출 경로가 있고, API는 사용자 인증 없이 동작하며, Vercel Production 빌드도 반복 실패했다. | 데모/PoC로 격리하거나 기관판에서 제거한다. |
| 1인 PC 오프라인 린터 | 조건부 Go | HTML/JS 기반 규칙 엔진은 재사용 가능하고, 외부 전송을 제거하면 작은 보안 경계를 만들 수 있다. | Windows x64 Electron 앱 + Rule Pack import로 파일럿을 만든다. |
| B2G 제안서 즉시 외부 사용 | No-Go | KRDS·KWCAG·나라장터·수의계약·가격·SLA 관련 단정이 확인됐다. | 외부 사용을 중지하고 발주별 법무·조달 확인 뒤 재작성한다. |
| 사업화 방향 | 조건부 Go | 한국 공공서비스 문맥, 오프라인 기본값, 기관 예외·승인 운영에는 차별 기회가 있다. | 범용 AI Writer가 아니라 공공 UX Writing Quality Gate로 서비스 주도 파일럿을 한다. |

## 2. 증거 신뢰도와 한계

| 등급 | 뜻 | 이 문서에서의 예 |
|---|---|---|
| 확인됨 | 현 저장소 코드, 실행 결과 또는 공개 API로 직접 확인했다. | npm test, package dry run, 서버 바인딩, GitHub Actions 상태 |
| 강한 추론 | 코드 구조가 결과를 직접 뒷받침하지만, 실제 기관 환경에서 실행하지는 않았다. | CORS가 인증을 대신하지 못함, 서버의 공개 정적 경로 |
| 미확인 | 권한·외부 환경·사람의 승인이 필요하다. | branch protection, 코드 서명, Vercel 빌드 실패 원인, 기관 보안 승인 |

이 문서는 미확인 항목을 통과로 간주하지 않는다. 특히 테스트 통과는 해당 테스트가 다루는 회귀의 증거일 뿐, Windows 설치판·실기관 CMS·법정 문구의 정확성을 증명하지 않는다.

## 3. 현재 형상과 공개 상태

| 항목 | 확인 결과 | 위험 또는 의미 |
|---|---|---|
| 로컬 브랜치 | main은 origin/main보다 28개 커밋 앞서 있다. | 현재 개선분은 GitHub Release, Pages, 원격 CI에 아직 반영되지 않았다. |
| 공개 저장소 | public, 기본 브랜치 main, GitHub API상 라이선스 식별 없음, Release 0건 | 소스·문서가 공개된다. 기관용 비공개 자료, 제안서 초안, 로컬 설정이 섞이지 않아야 한다. |
| 원격 최신 검증 | 2026-07-19의 Tests 워크플로는 성공했다. | 현재 로컬 28개 커밋에 대한 원격 CI 증거는 없다. |
| 원격 Vercel 상태 | 최근 Vercel Production workflow들이 Vercel build 단계에서 실패했고 deploy 단계는 건너뛰었다. | 공개 AI 데모의 배포 상태를 정상으로 가정하면 안 된다. 실패 상세 로그는 권한 없이 확인하지 못했다. |
| branch protection | GitHub API는 인증이 필요하다고 응답했다. | 필수 리뷰·상태 검사·관리자 우회 방지 여부는 미확인이다. Release 전 저장소 관리자 화면에서 확인해야 한다. |
| 작업 트리 | 이 감사·전략 문서 세 개는 아직 미커밋이다. | 이번 검수는 코드·원격 상태를 바꾸지 않았다. 검토 후 별도 커밋한다. |

## 4. 기능·품질 검증

| 검증 | 결과 | 이 결과가 증명하는 것 | 증명하지 않는 것 |
|---|---|---|---|
| npm ci dry run | 잠금 파일 기준 의존성 해석이 통과했다. | 현재 npm lockfile은 해석 가능하다. | 완전히 깨끗한 Windows 환경에서의 실제 설치 |
| npm test | 47개 파일, 1,266개 테스트 통과 | 규칙 엔진, CLI, API 입력 검증·SSE 모의 응답, 다수 UI 계약의 회귀 기반 | 설치판, 실서비스 API, 실제 스크린리더, 전체 접근성 |
| Chrome 확장 E2E | unpacked 확장을 Chromium에 실제 로드해 16개 이슈 announce, 11개 강조, 팝오버 표시를 확인 | 이 저장소가 허용한 lint URL에서 content script가 실제로 동작함 | 일반 기관 CMS, contenteditable, 보안 정책이 다른 실제 편집기 |
| 런타임 의존성 감사 | npm audit omit dev는 0건 | 현재 런타임 의존성 경로의 알려진 npm 취약점은 없다. | 빌드 체인, CDN 자산, 운영 설정의 보안 |
| 전체 의존성 감사 | high 2건 | Vitest가 끌어오는 Vite → PostCSS 8.5.16 → nanoid 3.3.15 경로에 high advisories가 남아 있다. | 실제 악용 가능성의 확정; 업데이트 영향 분석이 필요하다. |
| 코드 커버리지 | 측정 체계 없음 | 테스트 개수는 많다. | 테스트 비율·미검증 분기·실행 경로의 양적 보장 |

TESTING 문서는 Vitest 1.x와 E2E 미구현을 말하지만 실제 lockfile은 Vitest 4.1.6이고, Chrome 확장의 실제 E2E 스크립트가 존재한다. 문서는 현재 상태로 갱신해야 한다.

## 5. 아키텍처와 보안 경계

### 5.1 긍정적으로 확인된 방어

| 영역 | 확인된 방어 | 판단 |
|---|---|---|
| 경로 탐색 | server.js가 경로 정규화와 저장소 루트 내 여부를 검사한다. 관련 테스트도 있다. | 로컬 서버의 단순 path traversal 방어는 확인됨 |
| 생성 결과 렌더링 | generator/app.js는 markdown-it과 DOMPurify가 모두 있을 때 allowlist sanitize를 하고, DOMPurify가 없으면 평문 렌더링으로 폴백한다. | AI 생성 결과의 직접 HTML 주입 위험을 줄이는 설계가 확인됨 |
| 입력 검증 | edge와 Cloudflare API는 메서드, 기관명, 모드, 샘플 수·길이, 선택 필드 길이를 검사한다. | 데모 API의 최소 입력 경계는 있음 |
| 작업 액션 | GitHub Actions의 checkout, setup-node, github-script는 commit SHA로 고정돼 있다. | Action tag 변조 위험을 낮춘다 |
| 환경 파일 | .env, .env.backup, .env.cloud-backup은 git 추적 대상이 아니며 npm pack 대상도 아니다. 내용은 읽지 않았다. | 일반적인 환경 파일 유출은 현재 패키지에서 차단됨 |

### 5.2 출시 차단 또는 파일럿 전 해결 항목

| ID | 확인된 사실 | 심각도 | 왜 중요한가 | 완료 조건 |
|---|---|---|---|---|
| SEC-01 | server.js는 0.0.0.0에 바인딩하고 LAN 공유 주소를 출력한다. | P0 | 담당자 1인 PC 제품에 불필요한 네트워크 노출·포트 운영 표면이 생긴다. | 기관판에서는 서버를 제거한다. 별도 서버 제품이면 127.0.0.1/인증/보안 설계를 새로 검토한다. |
| SEC-02 | server.js는 derived, research, generator, principles 등 8개 정적 prefix를 제공한다. | P0 | LAN에 열린 서버를 통해 연구·파생 가이드가 함께 노출될 수 있다. | 제품 번들 allowlist에 실행 파일만 넣고 연구·제안서·원문을 제외한다. |
| SEC-03 | AI 경로는 Anthropic API 또는 환경으로 지정한 endpoint에 입력을 보낸다. | P0 | 기관 문구의 외부 전송·보존·국외 처리 여부를 제품이 통제하지 못한다. | 첫 기관판에서 AI 코드와 UI를 물리적으로 분리한다. |
| SEC-04 | lint-ui.js는 원문 전체를 localStorage에 최대 5건 저장한다. | P0 | 브라우저 프로필에 기관 문구·개인정보가 남을 수 있다. | 자동 이력을 제거하고, 명시적 저장만 제공한다. |
| SEC-05 | lint-ui.js는 500자 이하 원문을 t URL parameter로 공유한다. | P0 | URL·브라우저 이력·프록시·화면 캡처에 내용이 남는다. | 기관판에서 URL 공유 기능을 제거한다. |
| SEC-06 | 30개 HTML 중 29개가 jsDelivr 또는 Google Fonts의 외부 자산을 참조하며, CSP meta가 있는 것은 6개뿐이다. | P0 for 오프라인판, P1 for 웹 데모 | 인터넷 연결과 외부 공급망에 의존하고, CSP 일관성이 없다. | 기관판은 모든 자산을 로컬 번들로 묶고 default-src self 수준의 CSP를 검증한다. |
| SEC-07 | API의 ALLOWED_ORIGINS는 CORS 응답 헤더만 제어한다. POST handler는 허용되지 않은 Origin 또는 Origin 없는 요청을 인증·거부하지 않는다. | P1 for 공개 AI, P0 for 기관 AI | CORS는 브라우저 읽기 제한이지 요청자 인증이 아니다. 공개 endpoint의 비용·남용 경계가 약하다. | 기관 AI를 만들 경우 SSO/API 인증, 서버 측 권한, 단일 rate-limit 저장소, 감사·보존 정책을 설계한다. |
| SEC-08 | Vercel은 선택적으로 KV rate limit을 쓰지만 Cloudflare와 local server는 in-memory 상태다. | P1 | cold start·인스턴스 간 제한이 달라 비용과 남용 통제가 배포 환경마다 다르다. | 단일 배포 경로와 영속 rate limit 정책을 정한다. |
| SEC-09 | package allowlist나 .npmignore가 없다. final dry run에는 제품과 무관한 테스트·연구·B2G·workflow·local-skills가 함께 들어간다. | P0 | 공개 npm 또는 설치 번들에 초안·비밀·불필요한 공격 표면이 섞일 수 있다. | package files allowlist와 release 검사로 포함 파일을 명시한다. |
| SEC-10 | npm pack은 로컬 전용 .claude settings 경로를 포함한다. 파일 내용은 확인하지 않았다. | P0 | git ignore가 npm publish 정책을 보장하지 않는다. | 해당 경로와 모든 개발 설정을 allowlist 밖으로 둔다. |

### 5.3 데모 API의 경계

API에는 입력 길이·메서드·CORS·in-memory rate limit 같은 안전장치가 있다. 그러나 이것은 공공기관 AI 처리 시스템의 통제가 아니다. 특히 CORS allowlist, IP 기반 rate limit, API 키를 가진 proxy는 사용자 인증, 업무 권한, 데이터 등급 분류, 원문 보존 금지, 사고 대응을 대체하지 않는다.

따라서 AI 생성기는 다음 중 하나로만 취급한다.

1. 공개 문구만 넣는 웹 데모
2. 보안 승인을 별도로 받은 내부망 AI PoC
3. 첫 기관판에서는 완전히 제외

## 6. 공급망·릴리스·운영 감사

| ID | 확인된 사실 | 우선순위 | 권고 |
|---|---|---|---|
| REL-01 | GitHub Release, 설치 파일, 서명, SHA-256, SBOM, provenance가 없다. | P0 | tag 기반 Draft Release에서 재현 빌드, SHA-256, SBOM, Authenticode, 검증 안내를 만든다. |
| REL-02 | 공개 원격의 Vercel build가 2026-07-18~19에 반복 실패했다. | P0 for 웹 데모 신뢰, P1 for 기관판 | 원인 로그를 Vercel 권한 보유자가 확인하고, 웹 데모와 기관판 release workflow를 분리한다. |
| REL-03 | Vercel workflow는 main push마다 Production 배포를 시도하고 vercel latest를 설치한다. | P1 | 데모는 PR preview/Draft 승인 후 배포하고 CLI 버전을 고정한다. |
| REL-04 | sync-prompts workflow는 contents write로 main에 자동 커밋·push한다. | P1 | 자동 변경은 PR을 열거나, 보호 브랜치 정책과 예외를 문서화한다. |
| REL-05 | package-lock과 pnpm-lock이 공존하고 Vitest/Vite 버전이 다르다. package engines는 Node 14 이상이지만 현재 테스트 도구는 더 높은 Node를 요구한다. | P1 | npm + package-lock을 단일 빌드 기준으로 하고 engines를 CI의 Node 20 이상과 맞춘다. |
| REL-06 | package.json 0.1.0, VERSION 0.1.0.2, UI·extension 1.0.0, 문서의 v1.x 등 버전이 어긋난다. | P1 | 제품 버전, tag, 설치 파일, 앱 정보, SBOM, 릴리스 노트를 하나의 정책으로 묶는다. |
| REL-07 | public branch protection은 권한 없이 확인할 수 없다. | P1 | 저장소 관리자 화면에서 PR review, status check, tag protection, Actions 권한을 증빙한다. |

## 7. 콘텐츠·데이터·권리 감사

| 항목 | 확인된 사실 | 판단 |
|---|---|---|
| 공통 사전 | 국립국어원 공공언어 데이터 출처가 연구 문서에 남아 있다. | 좋은 출발점이지만 대체어는 문맥·법정 용어 검토 후 Rule Pack으로 승격해야 한다. |
| 파생 가이드 | 홈택스, 정부24, 전자가족관계등록시스템을 대상으로 한 대형 분석 문서가 있다. 작성·실사 기준일은 2026-04-24로 표시된다. | 시점 의존적인 화면, 세금 기한·금액, 절차, 서비스 구조를 포함하므로 최신성과 출처·스크린샷 권리를 대외 사용 전에 다시 검증해야 한다. |
| 공개 노출 | local server는 derived와 research prefix를 정적 제공한다. public GitHub도 저장소 내용을 제공한다. | 연구 자료를 제품 도움말·설치 번들·제안서와 분리한다. |
| 권리·고지 | package.json의 MIT 표기 외에는 루트 LICENSE, NOTICE, SECURITY, CONTRIBUTING이 없다. GitHub API도 license null로 반환한다. | 대외 배포 전에 저작권자·MIT 전문·제3자 코드·폰트·KRDS·정부 자료의 이용 고지와 취약점 신고 채널을 정한다. |
| B2G 문서 | KRDS 고시, 나라장터 규격, KWCAG 100%, 품목 코드, 수의계약 기준, 대금 지급, SLA 같은 단정이 있다. | 외부 사용을 중단한다. 실제 발주·조달·법무 확인 없이 가격표나 계약 조건을 제시하지 않는다. |
| 로컬 작업물 | 385개의 ignored 항목이 보이며, 상당수가 QA 스크린샷·작업 메모·개인 설정이다. | 현재 Git과 npm 환경 파일 제외는 확인됐지만, 향후 broad copy나 zip 배포 때 포함되지 않도록 release staging을 깨끗한 runner에서 한다. |

## 8. UX·접근성·문서 품질 감사

| 항목 | 확인 | 해석 |
|---|---|---|
| 기본 HTML 속성 | 30개 HTML 모두 lang과 viewport를 가진다. | 기본적인 국제화·반응형 출발점은 있다. |
| CSP | 30개 중 6개만 CSP meta가 있다. | 공개 페이지 전반의 보안 헤더·CSP 운영은 일관되지 않다. 호스팅 헤더와 함께 통일할 필요가 있다. |
| skip link | 정적 휴리스틱상 9개 페이지에는 표준 skip target이 없거나 다른 패턴을 쓴다. | 실제 키보드 흐름과 스크린리더 검증으로 확인해야 하며, 이 결과만으로 접근성 실패를 단정하지 않는다. |
| 확장 E2E | textarea mirror overlay에서 실제 강조·팝오버가 동작한다. | 현재 대상 URL에 대한 좋은 기술 검증이지만, 기관 CMS 통합의 증거는 아니다. |
| 다운로드 기능 | HTML 다운로드는 구현되어 있으며 HWP와 DOCX 메뉴는 준비 중으로 표시되고 실패 시 HTML 안내를 한다. | 납품 형식 지원을 마케팅 기능으로 말하면 안 된다. |
| 테스트 문서 | 실제 도구·E2E·버전과 일부 어긋난다. | 운영자와 고객이 테스트 범위를 잘못 이해할 수 있으므로 release 전 갱신이 필요하다. |

## 9. 제품·사업 판단

### 9.1 가장 현실적인 제품

첫 기관판은 다음 범위를 넘지 않는다.

> KRDS UX Writing Assistant Offline: 기관 담당자 PC에서 원문을 외부로 보내지 않고, 공통 규칙과 승인된 기관 Rule Pack으로 문구를 점검하는 Windows 데스크톱 보조 도구

포함:

- 규칙 기반 검사와 사람이 적용·거절하는 제안
- 기관 용어·예외·승인자·근거·재검토일이 있는 Rule Pack
- 명시적 결과 복사·내보내기
- 버전·라이선스·데이터 처리 고지
- GitHub Release 원본 또는 기관 승인 반입본

제외:

- 외부 생성 AI, API 키, CDN, 텔레메트리
- 자동 원문 이력, URL 공유, 자동 업데이트
- 서버 포트, LAN 공유, 일반 CMS 확장 지원
- KRDS·KWCAG·법정 문구의 최종 판정

### 9.2 고객과 판매 방식

| 항목 | 권고 |
|---|---|
| 구매자 | 기관 디지털서비스 PM, UX 책임자, 정보화·개편 사업 책임자 |
| 실사용자 | 콘텐츠, UX·디자인, 개발, QA 담당자 |
| 첫 사용처 | 문화·교육·예약·지원사업 안내처럼 공개 문구 중심의 핵심 여정 |
| 피할 첫 사용처 | 민원 원문, 세무·의료·복지·상담 등 민감정보·법정 판단이 높은 흐름 |
| 포지셔닝 | 범용 AI Writer가 아닌 한국 공공 UX Writing Quality Gate |
| 첫 수익 모델 | 2주 진단 → 기관 Rule Pack·개선 시트 → 오프라인 도구·교육 → 분기 운영 리뷰 |
| 채널 | KRDS 개편 SI, UX 컨설팅, 접근성·교육 파트너와의 워크스트림 결합 |

### 9.3 벤치마크에서 취할 것

| 벤치마크 | 취할 운영 원리 | 이 프로젝트의 적용 |
|---|---|---|
| KRDS | 단계적 적용, Do–Better–Best, 자체 검증·성과 점검 | 점수만으로 준수를 선언하지 않고 Rule Pack과 사람 검토를 연결 |
| GOV.UK, Canada, Digital.gov, USWDS, Singapore GDS | 컴포넌트·상태별 콘텐츠 기준과 과업 중심 검증 | 버튼, 오류, 완료, 빈 상태를 별도 규칙과 표본으로 관리 |
| Vale | 저장소 기반의 스타일 규칙과 심각도 | 공통 규칙 위에 기관 Rule Pack·예외·근거·버전 추가 |
| LanguageTool | 로컬 HTTP도 별도 공격 표면이라는 운영 교훈 | 첫 기관판에서 서버를 배포하지 않음 |
| Acrolinx, Writer, Grammarly Business | 조직 규칙·톤·용어·거버넌스를 단순 검사와 분리 | 승인 이력과 예외 관리가 제품의 핵심이라는 방향만 취함; 외부 SaaS 처리 모델은 채택하지 않음 |

공식 링크와 더 상세한 시장·경쟁·90일 계획은 2026-08-20-project-audit-business-strategy.md와 2026-08-20-offline-release-benchmark.md를 참조한다.

## 10. 90일 실행 게이트

| 시점 | 필수 결과 | 통과 증거 |
|---|---|---|
| 0~30일 | 기관판 경계, Electron 최소 앱, Rule Pack JSON 스키마, 법적·데이터 고지 초안 | 포트 없이 오프라인 실행, CDN·AI·URL 공유·자동 이력 미포함 |
| 31~60일 | Windows 설치·삭제·재설치 테스트, package allowlist, SHA-256·SBOM·서명·Draft Release | 깨끗한 CI에서 자산을 재현하고 파일 목록·네트워크 요청·서명을 검사 |
| 61~90일 | 공개·비식별 여정 1개에서 담당자 파일럿, Rule Pack v1.0, 성과 보고 | 개발자 도움 없는 설치·검사·Rule Pack import·롤백, 오탐·수용률·과업 지표 |

## 11. 최종 의사결정

### 지금 할 일

1. B2G 문서를 대외 배포 금지 상태로 표시한다.
2. 웹 데모와 기관판의 코드·배포·문서를 분리한다.
3. 기관판은 AI 없는 Electron 앱으로 시작한다.
4. package allowlist와 LICENSE, NOTICE, SECURITY를 우선 만든다.
5. Vercel build 실패 원인을 권한 보유자가 확인하거나, 공개 AI 데모를 일시적으로 비핵심 기능으로 낮춘다.
6. Rule Pack의 승인·예외·만료·검증을 구현하기 전에는 기관 특화 기능을 판매하지 않는다.

### 하지 않을 일

- 현 저장소를 npm install 또는 ZIP 형태로 기관 담당자에게 바로 전달하지 않는다.
- 린트 점수로 KRDS·KWCAG·법정 문구의 준수를 선언하지 않는다.
- 실제 기관 문구를 외부 AI·현재 웹 데모에 입력하게 하지 않는다.
- 가격, 조달 코드, 수의계약, SLA를 법무·조달 확인 없이 약속하지 않는다.

### 최종 결론

프로젝트는 규칙 엔진·한국 공공서비스 문맥·가이드 자산이라는 실질적인 출발점을 갖고 있다. 그러나 지금은 웹 데모, 연구 아카이브, AI PoC, 브라우저 확장, B2G 초안이 공존하는 연구·개발 저장소다. 성공적인 사업 방향은 이를 더 많은 기능으로 넓히는 것이 아니라, 외부 전송 없는 문구 품질 게이트라는 하나의 제품 경계를 먼저 완성하는 데 있다.

그 경계를 완성한 뒤, 기관별 Rule Pack과 서비스형 진단·교육으로 신뢰·검증 데이터·레퍼런스를 쌓는 순서가 가장 안전하고 사업적으로도 설득력 있다.
