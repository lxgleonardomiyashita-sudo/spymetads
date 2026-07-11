#!/usr/bin/env bash
#
# Recria TODA a estrutura do projeto (tabelas, RLS, funcoes, triggers)
# num projeto Supabase novo, aplicando as migracoes na ordem correta.
#
# É o "trazer o que ja existe do Lovable" para um banco novo/vazio.
#
# COMO USAR
# ---------
# 1. Pegue a connection string do projeto NOVO no painel do Supabase:
#      Settings -> Database -> Connection string -> aba "Session pooler" (IPv4)
#      Troque [YOUR-PASSWORD] pela senha do banco.
#
# 2. Rode:
#      export DATABASE_URL="postgresql://postgres.<ref>:SENHA@aws-0-<regiao>.pooler.supabase.com:5432/postgres"
#      ./scripts/setup-new-supabase.sh
#
# O script aplica, em ordem, cada arquivo de supabase/migrations/*.sql.
# Para na primeira falha (set -e) e diz qual migracao falhou.
#
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERRO: defina a variavel DATABASE_URL antes de rodar." >&2
  echo 'Ex.: export DATABASE_URL="postgresql://postgres.gtjcxiwqemnofernzich:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"' >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/../supabase/migrations"

echo "==> Testando conexao..."
psql "${DATABASE_URL}" -c '\conninfo'

echo ""
echo "==> Aplicando migracoes de ${MIGRATIONS_DIR}"
count=0
for f in $(ls -1 "${MIGRATIONS_DIR}"/*.sql | sort); do
  count=$((count + 1))
  echo ""
  echo "--- [$count] $(basename "$f")"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "$f"
done

echo ""
echo "==> Concluido: ${count} migracoes aplicadas."
echo "==> Tabelas criadas:"
psql "${DATABASE_URL}" -c "\dt public.*"
