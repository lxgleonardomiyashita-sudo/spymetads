#!/usr/bin/env bash
#
# Backup completo do banco de dados Supabase do projeto spymetads.
#
# COMO USAR
# ---------
# 1. Pegue a "Connection string" no painel do Supabase:
#      Dashboard -> Project Settings -> Database -> Connection string
#      Use a opção "Session pooler" (IPv4) e copie a URI, trocando
#      [YOUR-PASSWORD] pela senha do banco.
#
#    Formato tipico (pooler / IPv4 - recomendado neste ambiente):
#      postgresql://postgres.niklyxbgbtwagztsxrbw:SUA_SENHA@aws-0-<regiao>.pooler.supabase.com:5432/postgres
#
# 2. Exporte a variavel e rode o script:
#      export DATABASE_URL="postgresql://postgres.niklyxbgbtwagztsxrbw:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
#      ./scripts/backup-supabase.sh
#
# Gera 3 arquivos em ./backups/<timestamp>/:
#   - full.sql        -> schema + dados (restauravel do zero)
#   - data-only.sql   -> apenas os dados (INSERTs), sem estrutura
#   - schema-only.sql -> apenas a estrutura das tabelas
#
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERRO: defina a variavel DATABASE_URL antes de rodar." >&2
  echo 'Ex.: export DATABASE_URL="postgresql://postgres.niklyxbgbtwagztsxrbw:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"' >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/${STAMP}"
mkdir -p "${OUT}"

COMMON=(--no-owner --no-privileges --schema=public)

echo "==> Backup completo (schema + dados) -> ${OUT}/full.sql"
pg_dump "${DATABASE_URL}" "${COMMON[@]}" -f "${OUT}/full.sql"

echo "==> Backup apenas dos dados -> ${OUT}/data-only.sql"
pg_dump "${DATABASE_URL}" "${COMMON[@]}" --data-only --column-inserts -f "${OUT}/data-only.sql"

echo "==> Backup apenas do schema -> ${OUT}/schema-only.sql"
pg_dump "${DATABASE_URL}" "${COMMON[@]}" --schema-only -f "${OUT}/schema-only.sql"

echo ""
echo "OK! Arquivos gerados em ${OUT}/:"
ls -lh "${OUT}"
