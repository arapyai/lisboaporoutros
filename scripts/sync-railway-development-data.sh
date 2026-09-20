#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$repo_dir/.env.preview.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$repo_dir/.env.preview.local"
  set +a
fi
railway_environment="${RAILWAY_ENVIRONMENT:-development}"
railway_service="${RAILWAY_DATABASE_SERVICE:-postgres-dev}"
railway_project_id="${RAILWAY_PROJECT_ID:-}"
local_database_url="${LOCAL_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54329/lisboa_por_outros_preview}"
local_alembic_base_revision="${LOCAL_ALEMBIC_BASE_REVISION:-20260805_000018}"

if [[ "$railway_environment" != "development" ]]; then
  echo "Erro: somente o ambiente Railway development pode ser sincronizado." >&2
  exit 1
fi

if [[ ! "$local_database_url" =~ ^postgresql://[^@]+@(localhost|127\.0\.0\.1)(:[0-9]+)?/[A-Za-z0-9_-]+_preview([?].*)?$ ]]; then
  echo "Erro: LOCAL_DATABASE_URL deve apontar para localhost/127.0.0.1 e banco terminado em _preview." >&2
  exit 1
fi

if [[ ! "$local_alembic_base_revision" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "Erro: LOCAL_ALEMBIC_BASE_REVISION inválida." >&2
  exit 1
fi

for command_name in railway docker nix; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Erro: comando obrigatório não encontrado: $command_name" >&2
    exit 1
  fi
done

railway_project_args=()
if [[ -n "$railway_project_id" ]]; then
  railway_project_args=(--project "$railway_project_id")
fi

temp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$temp_dir"
}
trap cleanup EXIT

echo "Iniciando PostgreSQL local isolado..."
docker compose -f "$repo_dir/compose.local.yml" up -d --wait db

echo "Copiando conteúdo editorial (sem usuários e filas)..."
railway ssh \
  --service "$railway_service" \
  --environment "$railway_environment" \
  "${railway_project_args[@]}" \
  -- sh -lc 'exec pg_dump \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --format custom \
    --no-owner \
    --no-privileges \
    --exclude-table-data=public.admin_users \
    --exclude-table-data=public.audio_generation_jobs \
    --exclude-table-data=public.audio_generation_job_items \
    --exclude-table-data=public.content_generation_batches \
    --exclude-table-data=public.translation_generation_jobs \
    --exclude-table-data=public.translation_generation_job_items' \
  >"$temp_dir/development.dump"

nix develop "$repo_dir/backend" --command pg_restore --list "$temp_dir/development.dump" >/dev/null

echo "Restaurando somente no banco local validado..."
local_database_name="${local_database_url%%\?*}"
local_database_name="${local_database_name##*/}"
local_admin_url="${local_database_url%%\?*}"
local_admin_url="${local_admin_url%/*}/postgres"
nix develop "$repo_dir/backend" --command psql "$local_admin_url" \
  --set ON_ERROR_STOP=1 \
  --command "DROP DATABASE IF EXISTS \"$local_database_name\" WITH (FORCE)"
nix develop "$repo_dir/backend" --command psql "$local_admin_url" \
  --set ON_ERROR_STOP=1 \
  --command "CREATE DATABASE \"$local_database_name\""
nix develop "$repo_dir/backend" --command pg_restore \
  --dbname "$local_database_url" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  "$temp_dir/development.dump"

# O ambiente Railway pode carregar uma migration operacional ainda ausente na branch. No
# clone local, reposicionamos apenas o marcador para a última revisão comum antes do upgrade.
nix develop "$repo_dir/backend" --command psql "$local_database_url" \
  --set ON_ERROR_STOP=1 \
  --command "UPDATE alembic_version SET version_num = '$local_alembic_base_revision'"

sqlalchemy_database_url="${local_database_url/postgresql:\/\//postgresql+psycopg:\/\/}"
(
  cd "$repo_dir/backend"
  DATABASE_URL="$sqlalchemy_database_url" nix develop --command uv run alembic upgrade head
)

sanitize_sql=$(cat <<'SQL'
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'translations',
    'author_translations',
    'route_translations',
    'route_segment_translations',
    'point_translations'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('UPDATE %I SET reviewed_by = NULL', table_name);
    END IF;
  END LOOP;
  IF to_regclass('public.pronunciation_dictionaries') IS NOT NULL THEN
    UPDATE pronunciation_dictionaries SET last_published_by = NULL;
  END IF;
END $$;
SQL
)
nix develop "$repo_dir/backend" --command psql "$local_database_url" \
  --set ON_ERROR_STOP=1 \
  --command "$sanitize_sql"

(
  cd "$repo_dir/backend"
  ENVIRONMENT=development \
  DATABASE_URL="$sqlalchemy_database_url" \
  ADMIN_INITIAL_EMAIL=admin@example.com \
  ADMIN_INITIAL_PASSWORD=change-me \
  nix develop --command uv run python -m app.scripts.seed_admin
)

point_count="$(nix develop "$repo_dir/backend" --command psql "$local_database_url" -Atc 'SELECT count(*) FROM points')"
text_count="$(nix develop "$repo_dir/backend" --command psql "$local_database_url" -Atc 'SELECT count(*) FROM texts')"
echo "Sincronização concluída: $point_count pontos e $text_count textos."
echo "Usuários, jobs e identificadores de revisores da Railway não foram copiados."
echo "Admin local: admin@example.com / change-me"
