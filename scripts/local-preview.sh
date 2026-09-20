#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$repo_dir/.env.preview.local"

if [[ ! -f "$env_file" ]]; then
  echo "Erro: copie .env.preview.example para .env.preview.local e preencha o token/URLs." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

required_variables=(TUNNEL_TOKEN PREVIEW_WEBAPP_URL PREVIEW_ADMIN_URL PREVIEW_API_URL)
for variable_name in "${required_variables[@]}"; do
  if [[ -z "${!variable_name:-}" ]]; then
    echo "Erro: $variable_name não está configurada em .env.preview.local." >&2
    exit 1
  fi
done

local_database_url="${LOCAL_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54329/lisboa_por_outros_preview}"
if [[ ! "$local_database_url" =~ ^postgresql://[^@]+@(localhost|127\.0\.0\.1)(:[0-9]+)?/[A-Za-z0-9_-]+_preview([?].*)?$ ]]; then
  echo "Erro: LOCAL_DATABASE_URL deve apontar para localhost/127.0.0.1 e banco terminado em _preview." >&2
  exit 1
fi
sqlalchemy_database_url="${local_database_url/postgresql:\/\//postgresql+psycopg:\/\/}"

webapp_host="${PREVIEW_WEBAPP_URL#*://}"
webapp_host="${webapp_host%%/*}"
admin_host="${PREVIEW_ADMIN_URL#*://}"
admin_host="${admin_host%%/*}"

child_pids=()
cleanup() {
  for child_pid in "${child_pids[@]}"; do
    kill "$child_pid" >/dev/null 2>&1 || true
  done
  wait >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker compose -f "$repo_dir/compose.local.yml" up -d --wait db
(
  cd "$repo_dir/backend"
  DATABASE_URL="$sqlalchemy_database_url" nix develop --command uv run alembic upgrade head
)

echo "Iniciando API, PWA, admin e Cloudflare Tunnel..."
(
  cd "$repo_dir/backend"
  ENVIRONMENT=development \
  DATABASE_URL="$sqlalchemy_database_url" \
  ADMIN_SECRET_KEY=local-preview-only-change-me \
  CORS_ORIGINS="[\"http://localhost:5173\",\"http://localhost:5174\",\"$PREVIEW_WEBAPP_URL\",\"$PREVIEW_ADMIN_URL\"]" \
  AUDIO_WORKER_ENABLED=false \
  nix develop --command uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
) &
child_pids+=("$!")

(
  cd "$repo_dir"
  VITE_API_BASE_URL="$PREVIEW_API_URL" \
  VITE_ALLOWED_HOSTS="$webapp_host" \
  npm --workspace @ecosdelisboa/webapp run dev -- --host 127.0.0.1
) &
child_pids+=("$!")

(
  cd "$repo_dir"
  VITE_API_BASE_URL="$PREVIEW_API_URL" \
  VITE_ALLOWED_HOSTS="$admin_host" \
  npm --workspace @ecosdelisboa/admin run dev -- --host 127.0.0.1
) &
child_pids+=("$!")

TUNNEL_TOKEN="$TUNNEL_TOKEN" nix develop "$repo_dir/backend" --command \
  cloudflared tunnel --no-autoupdate run &
child_pids+=("$!")

echo "PWA: $PREVIEW_WEBAPP_URL"
echo "Admin: $PREVIEW_ADMIN_URL"
echo "API: $PREVIEW_API_URL"
wait -n "${child_pids[@]}"
