# KRDS 배포 스킬

KRDS UX Writing 가이드를 GitHub Pages에 안전하게 배포합니다.

## 실행 순서

### 1. 변경 파일 확인
```bash
git status --short
git diff --stat
```

### 2. principles.md 품질 검사 (principles.md 변경 시 필수)
principles.md가 변경된 경우에만 실행. 이중 구분선 / 중복 헤더 / 테이블 컬럼 불일치 검사.
```bash
git diff --cached --name-only | grep -q "^principles.md$" && python3 << 'PYEOF'
import sys, re
target = "principles.md"
content = open(target).read()
errors = 0
lines = content.splitlines()
for i in range(len(lines) - 1):
    if lines[i].strip() == "---" and lines[i+1].strip() == "---":
        print(f"❌ [이중구분선] {i+1}번째 줄"); errors += 1
headers = {}
for i, line in enumerate(lines):
    m = re.match(r'^(#{1,4})\s+(.+)', line)
    if m:
        key = (m.group(1), m.group(2).strip())
        if key in headers:
            print(f"❌ [중복헤더] '{m.group(2).strip()}' — {headers[key]+1}줄 + {i+1}줄"); errors += 1
        else: headers[key] = i
in_table = False; header_cols = 0
for i, line in enumerate(lines):
    s = line.strip()
    if s.startswith("|") and s.endswith("|"):
        parts = s.split("|"); cols = len(parts) - 2
        if not in_table: in_table = True; header_cols = cols
        elif all(c.strip().replace("-","").replace(":","") == "" for c in parts[1:-1]): pass
        elif cols != header_cols:
            print(f"❌ [테이블불일치] {i+1}줄: 헤더({header_cols}열) vs 데이터({cols}열)"); errors += 1
    else: in_table = False; header_cols = 0
if errors == 0: print(f"✅ principles.md OK"); sys.exit(0)
else: print(f"❌ {errors}개 오류"); sys.exit(1)
PYEOF
```

오류 발생 시 — 원인 파악 후 수정. 배포 중단.

### 3. JS 문법 검사 (필수)
script.js SyntaxError는 전체 화면을 망가뜨립니다.
```bash
node --check /Users/7457948/KRDS/script.js && echo "✅ script.js OK"
```

오류 발생 시 — 원인 파악 후 수정. 배포 중단.

### 4. nav ↔ anchor 일관성 검사
```bash
node << 'JSEOF'
const html = require('fs').readFileSync('/Users/7457948/KRDS/index.html', 'utf8');
const navLinks = [...html.matchAll(/href="(#[^"]+)"[^>]*class="[^"]*gnb/g)].map(m=>m[1]);
const sections = [...html.matchAll(/id="([^"]+)"/g)].map(m=>'#'+m[1]);
const broken = navLinks.filter(h => !sections.includes(h));
if (broken.length) { console.error('❌ 깨진 GNB 링크:', broken.join(', ')); process.exit(1); }
else console.log('✅ GNB 앵커 모두 정상');
JSEOF
```

### 5. CSP 인라인 스크립트 체크
```bash
node -e "
const h = require('fs').readFileSync('/Users/7457948/KRDS/index.html', 'utf8');
const inline = h.match(/<script(?!\s+src)[^>]*>[\s\S]*?<\/script>/g) || [];
const external = inline.filter(s => !s.includes('sha256-') && s.replace(/<[^>]+>/g,'').trim().length > 5);
if (external.length) { console.error('❌ CSP 위반 인라인 스크립트', external.length, '개'); process.exit(1); }
else console.log('✅ CSP OK');
"
```

### 6. Git add & commit
```bash
cd /Users/7457948/KRDS
git add index.html script.js principles.md
# 변경된 다른 파일이 있으면 추가
git status --short
```

커밋 메시지를 작성해 사용자에게 확인 후:
```bash
git commit -m "<type>: <변경 요약>"
```

### 7. 배포 (push)
```bash
git push origin main
echo "✅ 배포 완료 — https://thenisaid.github.io/krds-ux-writing/"
echo "⏱ GitHub Pages 반영: 약 1-2분 소요"
```

### 8. 확인 (선택)
Playwright로 배포된 사이트를 빠르게 확인하려면:
```bash
# 1-2분 후 실행
# /qa-only 스킬 또는 /browse 스킬로 https://thenisaid.github.io/krds-ux-writing/ 접속
```

## 에러 대응

| 에러 | 원인 | 해결 |
|------|------|------|
| `SyntaxError` in node --check | JS 문법 오류 | script.js 해당 줄 수정 |
| 깨진 GNB 링크 | anchor id 변경 | href 또는 id 일치화 |
| CSP 위반 | 인라인 스크립트 추가됨 | SHA256 해시 등록 또는 외부 파일로 이동 |
| push rejected | main 브랜치 강제 보호 | `git pull --rebase origin main` 후 재시도 |
