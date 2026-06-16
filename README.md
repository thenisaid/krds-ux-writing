# KRDS UX Writing 가이드라인

> 공공기관 UX Writing 원칙(무번역·정보핵심화·심리적안전망) 자동 검증 도구

## 설치 (CLI)

Node.js 14+ 필요

```bash
npm install -g github:thenisaid/krds-ux-writing
```

## 사용법

```bash
# 텍스트 직접 검사
echo "귀하의 신청서가 제출되었습니다" | krds-lint

# 파일 검사
krds-lint ./안내문.txt

# JSON 출력 (CI/CD 연동)
krds-lint --json ./안내문.txt

# 디렉터리 전체 검사
krds-lint ./src/
```

## Web UI

브라우저에서 바로 사용: https://thenisaid.github.io/krds-ux-writing/lint.html

## 로컬 LLM 연동

`~/Desktop/LLangs`의 로컬 게이트웨이를 붙이면 KRDS 생성기를 외부 Anthropic API 없이도 사용할 수 있습니다.

```bash
# 1) LLangs 게이트웨이 시작
cd ~/Desktop/LLangs
ollama serve
./start.sh

# 2) KRDS 컨텍스트 초기 인덱싱
curl -X POST http://localhost:8200/v1/index/krds

# 3) KRDS를 로컬 게이트웨이 모드로 전환
cd /Users/7457948/KRDS
./scripts/switch-ai-mode.sh local
```

KRDS는 `ANTHROPIC_BASE_URL=http://localhost:8200/krds`를 감지하면 `ANTHROPIC_API_KEY`가 비어 있어도 `local-llm` 키로 루프백 게이트웨이에 연결합니다. 클라우드 설정으로 되돌릴 때는 `./scripts/switch-ai-mode.sh cloud`를 사용하면 됩니다.

## 3대 원칙

1. **무번역 원칙** — 행정 용어를 시민 언어로 전환
2. **정보핵심화 원칙** — 불필요한 표현 제거, 핵심만 남기기
3. **심리적 안전망 원칙** — 오류 메시지에 상황·이유·다음 행동 명시

## 라이선스

MIT
