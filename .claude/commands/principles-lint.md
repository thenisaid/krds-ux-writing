# principles-lint

`principles.md` 품질 검사를 즉시 실행합니다.

pre-commit hook과 동일한 검사 항목:
- 이중 구분선 (연속된 `---`)
- 중복 헤더 (동일 `##` 헤더 2회 이상)
- 테이블 컬럼 불일치

## 실행

```bash
cd /Users/7457948/KRDS

python3 << 'PYEOF'
import sys, re

target = "principles.md"
try:
    content = open(target).read()
except FileNotFoundError:
    print(f"❌ {target} 파일을 찾을 수 없습니다.")
    sys.exit(1)

errors = 0
lines = content.splitlines()

# 1. 이중 구분선 (연속된 ---)
for i in range(len(lines) - 1):
    if lines[i].strip() == "---" and lines[i+1].strip() == "---":
        print(f"❌ [이중구분선] {i+1}번째 줄: 연속된 '---' — 하나 제거 필요")
        errors += 1

# 2. 중복 헤더 검사 (동일 ## 헤더가 2회 이상)
headers = {}
for i, line in enumerate(lines):
    m = re.match(r'^(#{1,4})\s+(.+)', line)
    if m:
        key = (m.group(1), m.group(2).strip())
        if key in headers:
            print(f"❌ [중복헤더] '{m.group(2).strip()}' — {headers[key]+1}번째 줄과 {i+1}번째 줄 중복")
            errors += 1
        else:
            headers[key] = i

# 3. 테이블 컬럼 불일치
in_table = False
header_cols = 0
table_start = 0
for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped.startswith("|") and stripped.endswith("|"):
        parts = stripped.split("|")
        cols = len(parts) - 2  # 앞뒤 빈 문자열 제외
        if not in_table:
            in_table = True
            header_cols = cols
            table_start = i + 1
        elif all(c.strip() in ("-", "--", "---", "----", ":---", "---:", ":---:") or c.strip().replace("-","").replace(":","") == ""
                 for c in parts[1:-1]):
            pass  # separator row
        elif cols != header_cols:
            print(f"❌ [테이블불일치] {i+1}번째 줄: 헤더({header_cols}열) vs 데이터({cols}열) 불일치")
            errors += 1
    else:
        in_table = False
        header_cols = 0

if errors == 0:
    print(f"✅ principles-lint: {target} 검사 통과 ({len(lines)}줄, {len(headers)}개 헤더)")
    sys.exit(0)
else:
    print(f"\n❌ {errors}개 오류 발견 — 수정 후 재실행하세요")
    sys.exit(1)
PYEOF
```

## 주의사항

- macOS 기본 `grep -P` 미지원 → Python `re` 모듈 사용
- 테이블 빈 셀 `| |` 카운팅: `len(parts) - 2` 방식 (앞뒤 파이프 제외)
- pre-commit hook 위치: `.git/hooks/pre-commit`
