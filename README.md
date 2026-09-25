# Lastro

Gestão financeira pessoal premium: receitas, despesas, contas, cartões, orçamento, metas, reserva,
investimentos, patrimônio e planejamento, tudo em uma visão só.

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Radix UI, React Hook Form + Zod, TanStack Query, Zustand, Recharts
- **Backend:** NestJS 12 (ESM), Prisma 7 + PostgreSQL 17, JWT + refresh token, Swagger, Pino, Helmet, Throttler
- **Docs:** [Arquitetura e mapa de telas](docs/ARCHITECTURE.md) · [Design System](docs/DESIGN_SYSTEM.md)

> **Status:** Fases 1 a 10 concluídas: arquitetura, Design System, autenticação completa, perfil,
> contas, categorias, lançamentos (parcelas, recorrência, transferências), busca global, onboarding, painel, orçamento, metas, reserva, cartões, investimentos, patrimônio, projeções, relatórios, notificações e landing page. Veja o roadmap em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#roadmap).

## 1. Instalação

Pré-requisitos: Node.js 24+, npm 11+ e Docker (com Docker Compose).

```bash
git clone <repo> lastro && cd lastro
npm --prefix backend install
npm --prefix frontend install
```

O `postinstall` do backend roda `prisma generate`. O npm 11 bloqueia scripts de instalação por padrão;
os permitidos (prisma, @prisma/engines, esbuild) estão em `allowScripts` no `backend/package.json`.

## 2. Configuração do ambiente

```bash
cp .env.example .env                        # portas e credenciais do docker-compose
cp backend/.env.example backend/.env        # gere os segredos abaixo
cp frontend/.env.example frontend/.env.local
```

Gere segredos JWT distintos, com pelo menos 32 caracteres:

```bash
openssl rand -base64 48
```

O backend valida o ambiente com Zod ao iniciar. Se algo estiver inválido, ele lista as variáveis com
problema (sem imprimir valores) e encerra. `NODE_ENV` aceita `development`, `staging`, `production` e
`test`.

## 3. PostgreSQL

```bash
docker compose up -d postgres
```

O Postgres 17 fica exposto em `localhost:5433` (usuário, senha e banco: `lastro`).

## 4. Migrations

```bash
npm --prefix backend run prisma:deploy
```

Esse comando aplica as migrations existentes. Para criar novas durante o desenvolvimento, use
`npm --prefix backend run prisma:migrate -- --name <nome>`. `npm --prefix backend run db:seed`
é idempotente: cria as categorias padrão para usuários que ainda não têm nenhuma.
`npm --prefix backend run prisma:studio` abre o Prisma Studio.

## 5. Backend

```bash
npm --prefix backend run dev
```

API em `http://localhost:3333/api` e health check em `http://localhost:3333/api/health`. Para produção:
`npm --prefix backend run build && npm --prefix backend run start:prod`.

## 6. Frontend

```bash
npm --prefix frontend run dev
```

App em `http://localhost:3100`, com Design System vivo em `/design-system` e área logada a partir de
`/painel`. O frontend encaminha `/api/*` para o backend (`BACKEND_INTERNAL_URL`), então os dois
precisam estar rodando.

Em desenvolvimento, os e-mails não são enviados: o link aparece no log do backend
(`MAIL_TRANSPORT=log`). A confirmação de e-mail está **temporariamente desligada**
(`AUTH_REQUIRE_EMAIL_VERIFICATION=false`): depois do cadastro você entra direto. O link de confirmação
continua sendo gerado. Para voltar a exigi-lo, defina `true`, que é o padrão quando a variável não existe. Para produção: `npm --prefix frontend run build && npm --prefix frontend run start`.

## 7. Swagger

Disponível em `http://localhost:3333/api/docs` (JSON em `/api/docs-json`). Fica desativado quando
`NODE_ENV=production`, a menos que `SWAGGER_ENABLED=true`.

## 8. Testes

```bash
npm --prefix backend test
npm --prefix backend run test:e2e
npm --prefix frontend test
```

- `npm --prefix backend test` roda os testes unitários do backend (Jest, ESM).
- `npm --prefix backend run test:e2e` roda os testes e2e do backend. Eles precisam do Postgres no ar.
- `npm --prefix frontend test` roda os testes do frontend (Vitest + Testing Library).

Qualidade: `npm --prefix backend run lint`, `npm --prefix frontend run lint` e
`npm --prefix frontend run typecheck`.

### Stack completa em Docker

```bash
docker compose --profile app up -d --build
```

O container do backend roda `prisma migrate deploy` antes de iniciar, como usuário não-root.

## 9. Estrutura

```text
lastro/
├── frontend/          Next.js: app/ (rotas), components/ (Design System), features/, services/, stores/, config/
├── backend/           NestJS: src/{modules,common,database,config,auth,guards,interceptors,filters}, prisma/
├── docker/            Dockerfiles de backend e frontend
├── docs/              Arquitetura, mapa de telas e Design System
├── docker-compose.yml
└── .env.example
```

Detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 10. Variáveis de ambiente

### Raiz (`.env`, lido pelo docker-compose)

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `lastro` | Credenciais do banco local |
| `POSTGRES_PORT` | `5433` | Porta exposta no host |
| `BACKEND_PORT` / `FRONTEND_PORT` | `3333` / `3100` | Portas expostas |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3333/api` | URL da API embutida no build do frontend |

### Backend (`backend/.env`)

| Variável | Descrição |
| --- | --- |
| `NODE_ENV` | `development` \| `staging` \| `production` \| `test` |
| `PORT`, `APP_URL` | Porta HTTP e URL do **frontend** (links de e-mail e origem confiável para CSRF) |
| `DATABASE_URL` | Conexão PostgreSQL |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Segredos distintos, ≥ 32 caracteres |
| `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` | Expiração (padrão `15m` / `30d`) |
| `CORS_ORIGINS` | Origens permitidas, separadas por vírgula |
| `THROTTLE_TTL`, `THROTTLE_LIMIT` | Janela e limite globais de rate limiting |
| `LOG_LEVEL` | Nível do Pino (JSON em produção, legível em dev) |
| `SWAGGER_ENABLED` | Força o Swagger em produção |
| `COOKIE_DOMAIN` | Domínio dos cookies de sessão (opcional) |
| `UPLOAD_DIR` | Pasta dos avatares (padrão `./storage`; no Docker, volume `backend-storage`) |
| `MAIL_TRANSPORT`, `MAIL_FROM`, `SMTP_URL` | `log` (dev, link no log) ou `smtp` (stub, Fase 12) |
| `TRUST_PROXY`, `BODY_LIMIT` | Saltos de proxy confiáveis (padrão `1`, o Next) e tamanho máximo do corpo |
| `ARGON2_*` | Custos do hash de senha (argon2id) |
| `AUTH_MAX_FAILED_ATTEMPTS`, `AUTH_LOCKOUT_MINUTES` | Proteção contra força bruta |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | Exigir e-mail confirmado para entrar (padrão `true`; hoje `false` no `.env`) |
| `ABACATEPAY_API_KEY` | Chave de API da loja (Integrar → API Keys em [app.abacatepay.com](https://app.abacatepay.com)) |
| `ABACATEPAY_BASE_URL` | Base da API v2 (padrão `https://api.abacatepay.com/v2`) |
| `ABACATEPAY_WEBHOOK_SECRET` | Segredo escolhido por você, usado ao registrar o webhook (ver seção 11) |
| `BILLING_TRIAL_DAYS`, `BILLING_PLAN_PRICE_CENTS` | Dias de teste grátis e preço do plano único, em centavos (padrão `7` / `2500`) |

### Frontend (`frontend/.env.local`)

Só variáveis públicas. **Nenhum segredo no frontend.**

| Variável | Descrição |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Base da API no navegador (padrão `/api`, via rewrite) |
| `BACKEND_INTERNAL_URL` | Destino do rewrite (NestJS). Resolvido no build |
| `NEXT_PUBLIC_SITE_URL` | URL canônica, usada em SEO e metadados |

## 11. Cobrança (AbacatePay)

Todo cadastro ganha **7 dias de teste grátis** (`BILLING_TRIAL_DAYS`). Ao vencer sem pagamento, o
`SubscriptionGuard` bloqueia as rotas da API (exceto login/perfil/cobrança) com `402
SUBSCRIPTION_REQUIRED`, e o frontend redireciona para `/assinatura`. Três formas de pagamento, via
[AbacatePay](https://www.abacatepay.com): Pix avulso, cartão avulso (ambos liberam 30 dias; renovação
manual) e cartão com recorrência (assinatura, renova sozinha).

Setup em produção (a conta e a chave são criadas por você, não pelo agente):

1. Crie a conta em [app.abacatepay.com](https://app.abacatepay.com) e gere a chave em
   **Integrar → API Keys**. Preencha `ABACATEPAY_API_KEY` no `backend/.env`.
2. Escolha um segredo forte qualquer para `ABACATEPAY_WEBHOOK_SECRET`.
3. Registre o webhook uma vez, apontando para `https://<seu-domínio>/api/billing/webhook`, com os
   eventos `checkout.completed`, `transparent.completed`, `subscription.completed`,
   `subscription.renewed`, `subscription.cancelled` (via `POST /webhooks/create` da API da AbacatePay,
   usando o mesmo valor de `ABACATEPAY_WEBHOOK_SECRET` no campo `secret`).
4. Em desenvolvimento, use o Modo Sandbox/Devmode da AbacatePay (chave de teste) — sem webhook público,
   os eventos não chegam automaticamente; simule-os manualmente ou teste via `test/billing.e2e-spec.ts`.

Sem uma chave real configurada, os endpoints de checkout (`/billing/checkout/*`) respondem
`503 SERVICE_UNAVAILABLE` — o resto do produto funciona normalmente.
