# Lastro — Arquitetura e mapa de telas

## Visão geral

```text
 Navegador ──HTTPS──▶ Next.js 16 (frontend :3100)
                         │  Server Components para shell/SEO, Client Components para interação
                         │  TanStack Query (cache de servidor) · Zustand (UI local) · RHF + Zod
                         ▼
                   api-client.ts ──REST/JSON──▶ NestJS (backend :3333, prefixo /api)
                                                  │ Helmet · CORS · Throttler · ValidationPipe
                                                  │ JwtAuthGuard global (@Public() para exceções)
                                                  │ ResponseInterceptor · AllExceptionsFilter
                                                  ▼
                                               Prisma 7 (adapter-pg) ──▶ PostgreSQL 17
```

**Regra:** o frontend nunca acessa o banco. Todo dado passa por `frontend/src/services/api-client.ts`,
que converte erros da API em mensagens para o usuário (`services/api-error.ts`).

### Autenticação (Fase 2, implementada)

Detalhes completos em [`backend/src/auth/README.md`](../backend/src/auth/README.md).

- **Same-origin:** o navegador chama `/api/*` no próprio Next, que faz rewrite para o NestJS
  (`BACKEND_INTERNAL_URL`). Os cookies ficam first-party e não há CORS no navegador.
- **Access token:** JWT HS256 de 15 min (`iss`, `aud`, `typ`, `sid`), guardado **só em memória**
  (`stores/auth-store.ts`). O guard confere assinatura e se a sessão continua ativa no banco, então
  "sair dos outros dispositivos" vale na hora.
- **Refresh token:** opaco (`<sessionId>.<segredo>`) no cookie `lastro_rt` com `httpOnly`,
  `SameSite=Strict` e `Path=/api/auth` (`Secure` em staging e produção). O banco guarda só o hash
  SHA-256. Cada refresh cria uma nova sessão na mesma família. Se um token já rotacionado for
  reapresentado, **a família inteira é revogada** e o caso vira `REFRESH_REUSE_DETECTED`. A família
  tem vida máxima de 30 dias desde o login.
- **Cliente:** o refresh é single-flight dentro da aba e serializado entre abas via Web Locks
  (`services/api-client.ts`), para evitar detecção falsa de reuso. Só `TOKEN_EXPIRED` dispara
  renovação; `SESSION_REVOKED` e `SESSION_EXPIRED` encerram a sessão.
- **CSRF:** `/auth/refresh` e `/auth/logout` exigem `Origin` ou `Referer` confiável
  (`CORS_ORIGINS`/`APP_URL`), além de `SameSite=Strict`.
- **Senhas:** hash argon2id. Bloqueio progressivo após N falhas (dobra a cada vez, até 24h), com
  verificação fictícia para igualar o tempo de resposta. Cadastro, recuperação e reenvio sempre
  respondem 202, sem revelar se o e-mail existe. Login exige e-mail verificado quando
  `AUTH_REQUIRE_EMAIL_VERIFICATION=true` (o aviso só aparece após a senha correta). **Hoje está
  desligado:** o cadastro entra direto.
- **Rotas privadas:** `proxy.ts` redireciona para `/entrar?next=…` sem o cookie indicador
  `lastro_session`, que não contém segredo. `SessionGate` troca o refresh por um access token ao
  carregar. `?next=` só aceita caminhos internos (`lib/safe-redirect.ts`).
- **Rate limit:** limites por rota (login 10/min, cadastro e recuperação 5/min, refresh 30/min).
- **Produção — IP do cliente:** rate limit, bloqueio e registro de sessões dependem do IP real. O
  rewrite do Next repassa o `X-Forwarded-For` recebido, mas não o cria. Em produção, um proxy reverso
  ou load balancer à frente do Next **deve sobrescrever** `X-Forwarded-For`, e `TRUST_PROXY` precisa
  refletir o número de saltos. Sem isso, todos os usuários compartilham o mesmo IP (127.0.0.1) e um
  cliente poderia forjar o cabeçalho.

### Cartões de crédito (Fase 7)

- Fatura identificada pelo mês do **vencimento**. Compra no dia do fechamento ou depois vai para a próxima fatura.
- Compras no cartão são despesas **pela data da compra** (painel, orçamento, alertas) e não alteram saldo de conta.
- Pagar a fatura é uma transferência conta → cartão: reduz o saldo da conta e o que se deve no cartão, sem contar a despesa duas vezes.
- Limite usado = soma do que falta pagar em todas as faturas, inclusive parcelas futuras. A dívida no cartão entra nos passivos do patrimônio.

### Investimentos e patrimônio (Fase 8)

- A posição de um investimento nunca é editada diretamente: cada movimentação reprocessa o histórico em ordem de data (preço médio ponderado, custo proporcional na venda, ganho realizado).
- Rentabilidade = valor atual − aplicado + proventos líquidos + ganho realizado.
- Aplicar com débito em conta tira o dinheiro da conta e o coloca no ativo. O patrimônio não muda, só a composição.
- Patrimônio líquido vem de uma única função, usada pelo painel, por `/net-worth` e pelos snapshots.
- Projeções são calculadas no navegador (`features/planning/projection.ts`) sobre a base de `/planning/baseline`, sempre rotuladas como estimativa.

### Contrato de resposta

```json
{ "success": true, "data": { }, "meta": { "page": 1, "pageSize": 20, "total": 134, "totalPages": 7 } }
{ "success": false, "message": "Conta não encontrada", "code": "ACCOUNT_NOT_FOUND", "statusCode": 404, "requestId": "…" }
```

Dinheiro trafega como **string decimal** (`"1520.40"`) e é armazenado como `Decimal(18,2)`. Não
usamos float.

## Estrutura

```text
lastro/
├── frontend/src
│   ├── app/
│   │   ├── (marketing)/          landing (/)
│   │   ├── (auth)/               entrar, cadastro, recuperar-senha, redefinir-senha, verificar-email
│   │   ├── (app)/                área privada com AppShell: painel, lancamentos, contas, …
│   │   ├── onboarding/           7 perguntas → primeira visão financeira
│   │   ├── design-system/        documentação viva
│   │   └── logout/
│   ├── components/{ui,finance,charts,layout,brand}   Design System (sem regra de negócio)
│   ├── features/<domínio>/{components,schemas,hooks,api}   lógica por domínio
│   ├── config/navigation.ts      fonte única do mapa de telas
│   ├── services/                 cliente HTTP e erros
│   ├── stores/                   Zustand (UI: privacidade, sidebar, ⌘K)
│   ├── lib/  types/  hooks/  utils/
├── backend/src
│   ├── modules/<domínio>/        controller · service · dto · (repository)
│   ├── auth/  guards/  interceptors/  filters/  common/  config/  database/
│   └── prisma/schema.prisma + migrations/
├── docker/                       Dockerfiles + init.sql do Postgres
└── docs/                         ARCHITECTURE.md · DESIGN_SYSTEM.md
```

## Mapa de telas

Fonte: `frontend/src/config/navigation.ts`. Sidebar, tab bar, busca global e placeholders leem daqui.

| Grupo | Tela | Rota | Tab mobile | Fase | Conteúdo principal |
| --- | --- | --- | --- | --- | --- |
| Público | Landing | `/` | — | 10 | Hero, problema, transformação, demo, benefícios, segurança, pricing, FAQ, CTA |
| Auth | Entrar · Cadastro · Recuperar · Redefinir · Verificar e-mail | `/entrar` … | — | 2 | Formulários RHF+Zod, anti-enumeração |
| Primeiro uso | Onboarding | `/onboarding` | — | 5 | 7 perguntas, uma por tela, que geram a visão inicial |
| Visão geral | Painel | `/painel` | Início | 5 | Patrimônio (assinatura), 6 tiles, 5 gráficos, insights |
| Dinheiro | Lançamentos | `/lancamentos` | Lançamentos | 4 | Lista virtualizada, filtros, busca, drawer de criação, recorrência, parcelas, transferência |
| | Contas | `/contas` | Patrimônio | 3 | Cards por conta, saldo, arquivar, transferir |
| | Cartões | `/cartoes` | Patrimônio | 7 | Fatura atual/próxima/anteriores, limite, parcelamentos |
| | Categorias | `/categorias` | Lançamentos | 3 | Árvore com subcategorias, ícone e cor |
| Planejamento | Orçamento | `/orcamento` | Planejar | 6 | Limites por categoria e alertas 50/80/100% |
| | Metas | `/metas` | Planejar | 6 | Progresso, prazo, contribuição mensal necessária |
| | Reserva | `/reserva` | Planejar | 6 | Custo mensal × meses, cobertura atual |
| | Projeções | `/planejamento` | Planejar | 8 | Cenários conservador/base/otimista, premissas editáveis, selo "Projeção" |
| Patrimônio | Investimentos | `/investimentos` | Patrimônio | 8 | Carteira por classe, rentabilidade, aportes |
| | Patrimônio | `/patrimonio` | Patrimônio | 8 | Ativos − passivos, evolução (snapshots) |
| Análise | Relatórios | `/relatorios` | Relatórios | 9 | Filtros de período/conta/categoria, CSV e PDF |
| Conta | Notificações | `/notificacoes` | (header) | 9 | Central com lidas e não lidas |
| | Perfil e preferências | `/perfil` | (header) | 3 | Dados, moeda, idioma, fuso, tema, notificações, sessões, exclusão |

## Roadmap

| Fase | Escopo | Status |
| --- | --- | --- |
| 1 | Arquitetura, infraestrutura, Design System, estrutura de telas, schema completo + migration | ✅ |
| 2 | Autenticação completa (JWT + refresh com rotação, sessões, brute force, proxy.ts) | ✅ |
| 3 | Usuário/perfil (incl. sessões ativas e troca de senha na UI), contas, categorias | ✅ |
| 4 | Receitas, despesas, transferências, recorrência, parcelamento, busca global com dados | ✅ |
| 5 | Dashboard com agregações reais, insights e snapshots diários (onboarding concluído na Fase 4) | ✅ |
| 6 | Orçamento com alertas 50/80/100%, metas com aportes, reserva, notificações básicas | ✅ |
| 7 | Cartões, faturas (fechamento/vencimento), parcelas no cartão, pagamento de fatura | ✅ |
| 8 | Investimentos (replay de movimentações), bens e dívidas, patrimônio consolidado, projeções em 3 cenários | ✅ |
| 9 | 7 relatórios com filtros, exportação CSV (Excel pt-BR) e PDF, notificações automáticas com dedupe | ✅ |
| 10 | Landing de vendas, planos, FAQ, páginas legais provisórias, SEO (robots/sitemap) | ✅ |
| 11 | Testes ampliados, auditoria de segurança, performance | próxima |
| 12 | Polimento, responsividade final, preparação para produção | |
