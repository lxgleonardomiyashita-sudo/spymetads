# Migração do Supabase — trazer tudo do Lovable para um projeto novo

Este guia move **toda a estrutura e os dados** do banco Supabase atual para um
projeto Supabase novo, e aponta o app para ele.

- **Projeto ANTIGO** (o que o app usa hoje): `niklyxbgbtwagztsxrbw`
- **Projeto NOVO** (destino): `gtjcxiwqemnofernzich`

Tudo que o app precisa (o "código do Lovable") **já está neste repositório**:
as 12 migrações em `supabase/migrations/`, as edge functions em
`supabase/functions/` e as configs. Os scripts abaixo usam esses arquivos.

---

## Pré-requisitos

- `psql` e `pg_dump` (PostgreSQL client 15+). Já vêm instalados no ambiente do Claude Code na web.
- A **connection string** de cada projeto (Settings → Database → Connection string
  → aba **"Session pooler"**, que é IPv4). Troque `[YOUR-PASSWORD]` pela senha do banco.
  Se não lembrar a senha: **Reset database password** na mesma tela.

> ⚠️ A connection string contém a senha do banco. Não a comite em texto puro.
> Depois de migrar, é recomendável resetar a senha por segurança.

---

## Passo a passo

### 1. Criar a estrutura no projeto novo (tabelas, RLS, funções)

```sh
export DATABASE_URL="postgresql://postgres.gtjcxiwqemnofernzich:SENHA@aws-0-<regiao>.pooler.supabase.com:5432/postgres"
./scripts/setup-new-supabase.sh
```

Aplica as 12 migrações em ordem e lista as tabelas criadas no fim.

### 2. (Opcional) Copiar os dados existentes do banco antigo

```sh
export SOURCE_URL="postgresql://postgres.niklyxbgbtwagztsxrbw:SENHA@aws-0-<regiao>.pooler.supabase.com:5432/postgres"
export TARGET_URL="postgresql://postgres.gtjcxiwqemnofernzich:SENHA@aws-0-<regiao>.pooler.supabase.com:5432/postgres"
./scripts/copy-data.sh
```

### 3. Apontar o app para o banco novo

Edite o `.env` (veja `.env.example`) com os dados do projeto novo:

- `VITE_SUPABASE_PROJECT_ID="gtjcxiwqemnofernzich"`
- `VITE_SUPABASE_URL="https://gtjcxiwqemnofernzich.supabase.co"`
- `VITE_SUPABASE_PUBLISHABLE_KEY="<anon key do projeto novo>"`

> A **anon key** fica em: Settings → API → Project API keys → `anon` `public`.
> Ela é pública/segura (usada no frontend).

### 4. Edge Functions (`scrape-ad-library`, `scheduler-hourly`)

Estas não sobem via `psql` — precisam do Supabase CLI:

```sh
npx supabase login
npx supabase link --project-ref gtjcxiwqemnofernzich
npx supabase functions deploy scrape-ad-library
npx supabase functions deploy scheduler-hourly
```

E configure os secrets que elas usam (ex.: chave do Firecrawl) em
Settings → Edge Functions → Secrets do projeto novo.

### 5. Backup (recomendado antes de qualquer coisa)

```sh
export DATABASE_URL="<connection string do banco que quer salvar>"
./scripts/backup-supabase.sh
```

Gera `full.sql`, `data-only.sql` e `schema-only.sql` em `backups/<timestamp>/`.

---

## Scripts disponíveis

| Script | O que faz |
|--------|-----------|
| `scripts/setup-new-supabase.sh` | Cria toda a estrutura (migrações) num banco novo |
| `scripts/copy-data.sh` | Copia os dados do banco antigo para o novo |
| `scripts/backup-supabase.sh` | Gera backup completo (schema + dados) |

---

## Rodando de dentro do Claude Code na web

O ambiente padrão ("Trusted") **bloqueia o Supabase na rede**. Para o Claude
rodar a migração por você, edite o ambiente e libere estes domínios em
**Network access → Custom → Allowed domains** (marque também "include default
list of common package managers"):

```
api.supabase.com
*.supabase.com
*.supabase.co
*.pooler.supabase.com
```

A mudança só vale para **sessões novas** — abra uma sessão nova depois de salvar.

Com `api.supabase.com` liberado, dá para criar toda a estrutura **sem a senha do
banco**, usando o access token (`sbp_...`) e a Management API do Supabase:

```sh
# aplica cada migração via Management API (nao precisa de senha do banco)
for f in $(ls -1 supabase/migrations/*.sql | sort); do
  curl -s -X POST "https://api.supabase.com/v1/projects/gtjcxiwqemnofernzich/database/query" \
    -H "Authorization: Bearer $SB_TOKEN" \
    -H "Content-Type: application/json" \
    --data "$(jq -Rs '{query: .}' < "$f")"
done
```

Deploy das edge functions e secrets também saem via token/CLI (ver Passo 4).
