# SpyMeta Ads

Monitoramento de anúncios ativos da Biblioteca de Anúncios do Meta (Facebook),
com análises em tempo real, grupos, tags, alertas e visualizações por hora,
dia e mês.

**App publicado:** https://lxgleonardomiyashita-sudo.github.io/spymetads/

## Tecnologias

- Vite + React + TypeScript
- shadcn-ui + Tailwind CSS
- Supabase (banco de dados, autenticação e edge functions)

## Rodando localmente

Requisitos: [Bun](https://bun.sh) (ou Node.js 18+ com npm).

```sh
git clone https://github.com/lxgleonardomiyashita-sudo/spymetads.git
cd spymetads
bun install
bun run dev
```

O app abre em `http://localhost:8080`.

## Publicação

O deploy é automático: todo push na branch `main` dispara o workflow
[.github/workflows/deploy.yml](.github/workflows/deploy.yml), que builda o app
e publica no GitHub Pages.

## Instalar como aplicativo (Mac/iPhone)

O app é um PWA instalável:

- **macOS (Safari):** abra o app publicado → menu **Arquivo → Adicionar à Dock**
- **macOS/Windows (Chrome):** ícone de instalação na barra de endereço → **Instalar**
- **iPhone:** Safari → Compartilhar → **Adicionar à Tela de Início**

## Backend (Supabase)

- Migrações do banco: [`supabase/migrations/`](supabase/migrations)
- Edge functions: [`supabase/functions/`](supabase/functions)
  (`scrape-ad-library` faz a coleta; `scheduler-hourly` roda de hora em hora)
- Guia de migração para um projeto Supabase novo: [MIGRATION.md](MIGRATION.md)

Configuração do frontend via `.env` (veja `.env.example`).
