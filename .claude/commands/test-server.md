# Test Server Command

로컬 HTTP 서버를 관리해 Playwright MCP 테스트를 준비합니다.

## Usage

```
/test-server [start|stop|restart] [port]
```

- 기본 포트: **8300**
- 서빙 디렉토리: 현재 프로젝트 루트 (`/Users/7457948/KRDS`) 또는 `--directory` 옵션으로 지정

## Examples

- `/test-server` → 포트 8300에 서버 시작 (기본, KRDS 루트)
- `/test-server start` → 서버 시작
- `/test-server stop` → 서버 종료
- `/test-server restart` → 재시작 (kill → start)
- `/test-server start 8400` → 커스텀 포트로 시작
- `/test-server /tmp` → `/tmp` 디렉토리를 서빙 루트로 지정

## Implementation

사용자가 `/test-server`를 실행하면:

1. **인자 파싱**: action(start/stop/restart), port(기본 8300)
2. **start/restart 시**:
   ```bash
   lsof -ti:{port} | xargs kill -9 2>/dev/null; true
   python3 -m http.server {port} &
   sleep 2 && echo "Server ready"
   ```
3. **stop 시**:
   ```bash
   lsof -ti:{port} | xargs kill -9 2>/dev/null; true
   echo "Server stopped"
   ```
4. 완료 후 접속 URL 출력: `http://localhost:{port}/index.html`

## Notes

- **Playwright 검증 시퀀스**: `/test-server start` → `browser_navigate` → 검증 → `/test-server stop`
- 서버 시작 후 2초 대기 (python3 http.server 초기화 시간)
- 포트 충돌 방지를 위해 항상 kill-first 패턴 사용
- `.gitignore`에 서버 로그 파일 추가 불필요 (백그라운드로 실행됨)
