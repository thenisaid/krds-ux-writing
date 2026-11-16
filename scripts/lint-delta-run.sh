#!/usr/bin/env bash
# scripts/lint-delta-run.sh
#
# krds-lint.yml 이 호출하는 파일별 린트 루프. 판정은 scripts/lint-delta.js 가 한다.
#
# 입력(환경변수)
#   LINT_FILE_LIST  검사할 파일 목록(한 줄에 하나). 기본 /tmp/changed_files.txt
#   LINT_BASE_REF   비교 기준 ref (예: origin/main). 비어 있으면 전체 검사 모드:
#                   base 가 없으므로 오류 전부를 새 오류로 보는 절대 총합 기준(기존 동작).
#   LINT_BIN        린터 CLI. 기본 bin/krds-lint
#   GITHUB_OUTPUT   있으면 결과를 step output 으로 기록
#
# 린트 JSON 은 stdout 파이프가 아니라 임시 파일로 받는다(큰 출력이 파이프에서 절단되는 문제).
# 비교 불가(base 린트 실패·파싱 실패 등)는 통과가 아니라 FAIL 로 센다(fail-closed).
# 종료 코드: 새 오류(또는 FAIL)가 1건 이상이면 1, 아니면 0.

set +e

LIST="${LINT_FILE_LIST:-/tmp/changed_files.txt}"
BASE_REF="${LINT_BASE_REF:-}"
LINT_BIN="${LINT_BIN:-bin/krds-lint}"
DELTA_JS="$(cd "$(dirname "$0")" && pwd)/lint-delta.js"
OUT="${GITHUB_OUTPUT:-/dev/null}"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

TABLE="$WORK/table.md"
DETAIL="$WORK/detail.md"
FILE_MD="$WORK/file.md"
PR_JSON="$WORK/pr.json"
BASE_JSON="$WORK/base.json"
: > "$TABLE"
: > "$DETAIL"

MAX_TABLE_ROWS=100
MAX_DETAIL_FILES=30

TOTAL_NEW=0
TOTAL_EXISTING=0
TOTAL_WARNINGS=0
FAIL_COUNT=0
LINTED=0
ROWS=0
ROWS_OMITTED=0
DETAIL_FILES=0
DETAIL_OMITTED=0

if [ -n "$BASE_REF" ]; then
  MODE="delta"
else
  MODE="absolute"
fi

write_outputs() {
  local delim="KRDS_REPORT_EOF_${RANDOM}${RANDOM}"
  {
    echo "mode=${MODE}"
    echo "linted_count=${LINTED}"
    echo "new_errors=${TOTAL_NEW}"
    echo "existing_errors=${TOTAL_EXISTING}"
    echo "total_warnings=${TOTAL_WARNINGS}"
    echo "fail_count=${FAIL_COUNT}"
    echo "report<<${delim}"
    if [ -s "$TABLE" ]; then
      echo "| 파일 | 기존 오류 | 신규 오류 | 경고 |"
      echo "|------|-----------|-----------|------|"
      cat "$TABLE"
      if [ "$ROWS_OMITTED" -gt 0 ]; then
        echo ""
        echo "... 외 ${ROWS_OMITTED}개 파일 생략"
      fi
      echo ""
    fi
    cat "$DETAIL"
    if [ "$DETAIL_OMITTED" -gt 0 ]; then
      echo "... 신규 오류가 있는 파일 ${DETAIL_OMITTED}개의 상세는 생략했습니다. 워크플로 로그를 확인하세요."
    fi
    echo "$delim"
  } >> "$OUT"
}

if [ ! -f "$LIST" ] || [ ! -s "$LIST" ]; then
  echo "검사할 파일이 없습니다. 건너뜁니다."
  write_outputs
  exit 0
fi

if [ "$MODE" = "delta" ]; then
  if ! git rev-parse --verify --quiet "${BASE_REF}^{commit}" > /dev/null; then
    # base 를 알 수 없으면 비교가 불가능하다 → 조용히 통과시키지 않는다
    echo "::error::비교 기준 ref '${BASE_REF}' 를 찾을 수 없어 신규 오류를 판정할 수 없습니다 (fail-closed)."
    TOTAL_NEW=1
    FAIL_COUNT=1
    write_outputs
    exit 1
  fi

  # 이름 변경된 파일은 옛 경로의 base 와 비교한다 (new<TAB>old). 지도를 못 만들면
  # 이름 변경을 신규 파일로 보게 되므로 더 엄격한 쪽(보수적)으로 실패한다.
  git -c core.quotepath=false diff --name-status -M --diff-filter=R "${BASE_REF}...HEAD" 2> /dev/null \
    | awk -F'\t' '{print $3 "\t" $2}' > "$WORK/rename_map.tsv"
else
  : > "$WORK/rename_map.tsv"
  echo "전체 검사 모드: base 비교 없이 오류 전부를 새 오류로 집계합니다."
fi

while IFS= read -r file; do
  [ -z "$file" ] && continue
  [ ! -f "$file" ] && continue
  LINTED=$((LINTED + 1))

  : > "$PR_JSON"
  node "$LINT_BIN" --json "$file" > "$PR_JSON"
  PR_EXIT=$?

  : > "$FILE_MD"
  ARGS=(--pr "$PR_JSON" --pr-exit "$PR_EXIT" --file "$file" --md-out "$FILE_MD")

  if [ "$MODE" = "absolute" ]; then
    ARGS+=(--new-file)
  else
    BASE_PATH="$file"
    RENAMED=$(LOOKUP="$file" awk -F'\t' '$1==ENVIRON["LOOKUP"]{print $2; exit}' "$WORK/rename_map.tsv")
    [ -n "$RENAMED" ] && BASE_PATH="$RENAMED"

    IN_BASE=$(git ls-tree --name-only "$BASE_REF" -- "$BASE_PATH" 2> /dev/null)
    if [ -z "$IN_BASE" ]; then
      # base 에 없는 새 파일: base 오류 0 으로 간주
      ARGS+=(--new-file)
    else
      # 린터는 파일 내용만 보지만 확장자는 그대로 붙여 같은 조건으로 린트한다
      BASE_FILE="$WORK/base.${file##*.}"
      : > "$BASE_JSON"
      if git show "${BASE_REF}:${BASE_PATH}" > "$BASE_FILE" 2> /dev/null; then
        node "$LINT_BIN" --json "$BASE_FILE" > "$BASE_JSON"
        BASE_EXIT=$?
      else
        BASE_EXIT=128
      fi
      ARGS+=(--base "$BASE_JSON" --base-exit "$BASE_EXIT")
    fi
  fi

  LINE=$(node "$DELTA_JS" "${ARGS[@]}")
  IFS='|' read -r STATUS NEWE OLDE WARN SCORE REASON <<< "$LINE"

  case "$STATUS" in
    OK|FAIL) ;;
    *) STATUS="FAIL"; REASON="lint-delta 판정 스크립트 실행 실패"; NEWE=1; OLDE=0; WARN=0 ;;
  esac
  case "${NEWE}${OLDE}${WARN}" in
    ''|*[!0-9]*) STATUS="FAIL"; REASON="lint-delta 출력 형식 오류"; NEWE=1; OLDE=0; WARN=0 ;;
  esac

  if [ "$STATUS" = "FAIL" ]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "::error file=${file}::${REASON}"
  elif [ "$NEWE" -gt 0 ]; then
    echo "::error file=${file}::신규 오류 ${NEWE}건 (기존 ${OLDE}건)"
  fi

  TOTAL_NEW=$((TOTAL_NEW + NEWE))
  TOTAL_EXISTING=$((TOTAL_EXISTING + OLDE))
  TOTAL_WARNINGS=$((TOTAL_WARNINGS + WARN))

  if [ "$NEWE" -gt 0 ] || [ "$OLDE" -gt 0 ] || [ "$WARN" -gt 0 ] || [ "$STATUS" = "FAIL" ]; then
    if [ "$ROWS" -lt "$MAX_TABLE_ROWS" ]; then
      SAFE_NAME="${file//|/_}"
      SAFE_NAME="${SAFE_NAME//\`/_}"
      MARK=""
      [ "$NEWE" -gt 0 ] && MARK=" ❌"
      echo "| \`${SAFE_NAME}\` | ${OLDE} | ${NEWE}${MARK} | ${WARN} |" >> "$TABLE"
      ROWS=$((ROWS + 1))
    else
      ROWS_OMITTED=$((ROWS_OMITTED + 1))
    fi
  fi

  if [ -s "$FILE_MD" ]; then
    if [ "$DETAIL_FILES" -lt "$MAX_DETAIL_FILES" ]; then
      cat "$FILE_MD" >> "$DETAIL"
      DETAIL_FILES=$((DETAIL_FILES + 1))
    else
      DETAIL_OMITTED=$((DETAIL_OMITTED + 1))
    fi
  fi
done < "$LIST"

write_outputs

echo ""
echo "════════════════════════════════════════"
echo "KRDS UX 라이팅 린팅 완료 (${MODE})"
echo "신규 오류: ${TOTAL_NEW}건 / 기존 오류(참고): ${TOTAL_EXISTING}건 / 경고: ${TOTAL_WARNINGS}건"
echo "════════════════════════════════════════"

if [ "$TOTAL_NEW" -gt 0 ]; then
  echo ""
  if [ "$MODE" = "delta" ]; then
    echo "❌ 이 PR 이 새로 만든 오류 ${TOTAL_NEW}건 발견 — PR 머지를 차단합니다."
  else
    echo "❌ 오류 ${TOTAL_NEW}건 발견 — 차단합니다."
  fi
  exit 1
fi

exit 0
