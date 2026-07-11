#!/usr/bin/env bash
#
# Copia os DADOS (linhas) do banco Supabase ANTIGO para o NOVO.
# Use DEPOIS de rodar ./scripts/setup-new-supabase.sh (que cria a estrutura).
#
# COMO USAR
# ---------
#   export SOURCE_URL="postgresql://postgres.niklyxbgbtwagztsxrbw:SENHA@aws-0-<regiao>.pooler.supabase.com:5432/postgres"
#   export TARGET_URL="postgresql://postgres.gtjcxiwqemnofernzich:SENHA@aws-0-<regiao>.pooler.supabase.com:5432/postgres"
#   ./scripts/copy-data.sh
#
# Estrategia: pg_dump --data-only do SOURCE, restore no TARGET.
# Usa --disable-triggers para nao esbarrar em FKs durante o load.
#
set -euo pipefail

if [[ -z "${SOURCE_URL:-}" || -z "${TARGET_URL:-}" ]]; then
  echo "ERRO: defina SOURCE_URL (banco antigo) e TARGET_URL (banco novo)." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP="/tmp/spymetads-data-${STAMP}.sql"

echo "==> Exportando dados do banco ANTIGO..."
pg_dump "${SOURCE_URL}" \
  --data-only --no-owner --no-privileges --disable-triggers \
  --schema=public -f "${TMP}"

echo "==> Dump gerado: ${TMP} ($(du -h "${TMP}" | cut -f1))"

echo "==> Importando dados no banco NOVO..."
psql "${TARGET_URL}" -v ON_ERROR_STOP=1 -f "${TMP}"

echo ""
echo "==> Concluido. Conferindo contagem de linhas no banco NOVO:"
psql "${TARGET_URL}" -c "
  SELECT relname AS tabela, n_live_tup AS linhas
  FROM pg_stat_user_tables
  WHERE schemaname='public'
  ORDER BY relname;"

echo ""
echo "(dump temporario mantido em ${TMP} — apague quando nao precisar mais)"
