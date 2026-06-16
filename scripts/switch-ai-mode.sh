#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
MODE="${1:-local}"
LOCAL_BASE_URL="http://localhost:8200/krds"
CLOUD_BASE_URL="https://api.anthropic.com/v1"

touch "$ENV_FILE"

upsert_env_line() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp_file

  tmp_file="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { replaced = 0 }
    index($0, key "=") == 1 {
      print key "=" value
      replaced = 1
      next
    }
    { print }
    END {
      if (!replaced) {
        print key "=" value
      }
    }
  ' "$file" > "$tmp_file"
  mv "$tmp_file" "$file"
}

remove_env_line() {
  local key="$1"
  local file="$2"
  local tmp_file

  tmp_file="$(mktemp)"
  grep -v "^${key}=" "$file" > "$tmp_file" || true
  mv "$tmp_file" "$file"
}

show_current_settings() {
  echo ""
  echo "Current KRDS AI settings:"
  grep -E "^(ANTHROPIC_BASE_URL|ANTHROPIC_API_KEY)=" "$ENV_FILE" || true
}

case "$MODE" in
  local)
    if ! grep -q "^ANTHROPIC_BASE_URL=${LOCAL_BASE_URL}$" "$ENV_FILE"; then
      cp "$ENV_FILE" "${ENV_FILE}.cloud-backup"
    fi
    upsert_env_line "ANTHROPIC_BASE_URL" "$LOCAL_BASE_URL" "$ENV_FILE"
    upsert_env_line "ANTHROPIC_API_KEY" "local-llm" "$ENV_FILE"
    echo "Switched KRDS to LOCAL LLM"
    echo "Start LLangs from ~/Desktop/LLangs with:"
    echo "  ollama serve"
    echo "  ./start.sh"
    echo "Index once with:"
    echo "  curl -X POST http://localhost:8200/v1/index/krds"
    ;;
  cloud)
    if [ -f "${ENV_FILE}.cloud-backup" ]; then
      cp "${ENV_FILE}.cloud-backup" "$ENV_FILE"
      echo "Restored KRDS cloud settings from ${ENV_FILE}.cloud-backup"
    else
      upsert_env_line "ANTHROPIC_BASE_URL" "$CLOUD_BASE_URL" "$ENV_FILE"
      if grep -q "^ANTHROPIC_API_KEY=local-llm$" "$ENV_FILE"; then
        remove_env_line "ANTHROPIC_API_KEY" "$ENV_FILE"
      fi
      echo "No ${ENV_FILE}.cloud-backup found."
      echo "Restored the default Anthropic base URL only."
      echo "Set ANTHROPIC_API_KEY manually if you want cloud inference."
    fi
    ;;
  *)
    echo "Usage: $0 [local|cloud]"
    exit 1
    ;;
esac

show_current_settings
