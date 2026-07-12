#!/usr/bin/env bash
#
# Migracao completa para um projeto Supabase novo usando APENAS o access
# token da conta (sbp_...) — sem precisar da senha do banco.
#
# Faz, nesta ordem:
#   1. Aplica todas as migracoes (supabase/migrations/*.sql) via Management API
#   2. Busca a anon key do projeto novo e gera o .env apontando para ele
#   3. Deploy das edge functions via Supabase CLI (usa o mesmo token)
#
# REQUISITOS
#   - Rede com acesso a api.supabase.com (no Claude Code web: Network access
#     "Custom" com os dominios do MIGRATION.md liberados)
#   - jq e curl instalados (padrao no ambiente do Claude Code)
#
# USO
#   export SB_TOKEN="sbp_..."          # https://supabase.com/dashboard/account/tokens
#   export PROJECT_REF="gtjcxiwqemnofernzich"
#   ./scripts/migrate-via-token.sh
#
set -euo pipefail

: "${SB_TOKEN:?defina SB_TOKEN com o access token sbp_...}"
: "${PROJECT_REF:?defina PROJECT_REF com o ref do projeto novo}"

API="https://api.supabase.com/v1/projects/${PROJECT_REF}"
AUTH=(-H "Authorization: Bearer ${SB_TOKEN}")

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${SCRIPT_DIR}/.."

echo "==> [0/3] Verificando acesso ao projeto ${PROJECT_REF}..."
name=$(curl -sf "${AUTH[@]}" "${API}" | jq -r '.name')
echo "    OK: projeto \"${name}\""

echo ""
echo "==> [1/3] Aplicando migracoes via Management API..."
count=0
for f in $(ls -1 "${ROOT}/supabase/migrations"/*.sql | sort); do
  count=$((count + 1))
  echo "--- [${count}] $(basename "$f")"
  resp=$(jq -Rs '{query: .}' < "$f" | curl -sf -X POST "${API}/database/query" \
    "${AUTH[@]}" -H "Content-Type: application/json" --data @-) || {
      echo "ERRO aplicando $(basename "$f")." >&2
      echo "Resposta: ${resp:-<vazia>}" >&2
      exit 1
    }
done
echo "    OK: ${count} migracoes aplicadas."

echo ""
echo "==> [2/3] Gerando .env com a anon key do projeto novo..."
anon=$(curl -sf "${AUTH[@]}" "${API}/api-keys" | jq -r '.[] | select(.name=="anon") | .api_key')
if [[ -z "${anon}" || "${anon}" == "null" ]]; then
  echo "AVISO: nao consegui obter a anon key automaticamente." >&2
  echo "Pegue em Settings -> API e preencha o .env manualmente (.env.example)." >&2
else
  cat > "${ROOT}/.env" <<EOF
VITE_SUPABASE_PROJECT_ID="${PROJECT_REF}"
VITE_SUPABASE_PUBLISHABLE_KEY="${anon}"
VITE_SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
EOF
  echo "    OK: .env atualizado para o projeto novo."
fi

echo ""
echo "==> [3/3] Deploy das edge functions..."
export SUPABASE_ACCESS_TOKEN="${SB_TOKEN}"
cd "${ROOT}"
npx --yes supabase functions deploy scrape-ad-library --project-ref "${PROJECT_REF}"
npx --yes supabase functions deploy scheduler-hourly --project-ref "${PROJECT_REF}"
echo "    OK: functions no ar."

echo ""
echo "==> Migracao concluida!"
echo "    Tabelas no projeto novo:"
echo '{"query": "select tablename from pg_tables where schemaname = '"'"'public'"'"' order by 1;"}' |
  curl -sf -X POST "${API}/database/query" "${AUTH[@]}" -H "Content-Type: application/json" --data @- | jq -r '.[].tablename' | sed 's/^/      - /'

echo ""
echo "PENDENTE (manual):"
echo "  - Copiar DADOS do banco antigo: ./scripts/copy-data.sh (precisa das connection strings)"
echo "  - Secret FIRECRAWL_API_KEY nas edge functions (se usar Firecrawl):"
echo "      Settings -> Edge Functions -> Secrets do projeto ${PROJECT_REF}"
