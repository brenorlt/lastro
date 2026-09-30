# auth — autenticação (Fase 2)

Todas as rotas ficam em `/api/auth`. O frontend (Next.js) faz proxy de `/api/*`, então no browser a
API é **same-origin** e os cookies são first-party. CORS continua ativo para outros clientes.

## Endpoints

| Método | Rota | Auth | Resposta |
| --- | --- | --- | --- |
| POST | `/register` | pública, 5/min | 202 `{ message }` sempre (anti-enumeração) |
| POST | `/verify-email` | pública, 5/min | 200 `{ verified: true }` · 400 `TOKEN_INVALID` |
| POST | `/resend-verification` | pública, 5/min | 202 `{ message }` sempre |
| POST | `/login` | pública, 10/min | 200 `AuthPayload` + cookies · 401 `INVALID_CREDENTIALS` · 403 `EMAIL_NOT_VERIFIED` (se `AUTH_REQUIRE_EMAIL_VERIFICATION=true`) · 423 `ACCOUNT_LOCKED` |
| POST | `/refresh` | cookie + Origin, 30/min | 200 `AuthPayload` + cookies · 401 `UNAUTHORIZED`/`SESSION_REVOKED`/`SESSION_EXPIRED` · 403 `CSRF_REJECTED` |
| POST | `/logout` | cookie ou bearer | 204 (idempotente) |
| GET | `/me` | bearer | `UserDto` |
| POST | `/forgot-password` | pública, 5/min | 202 `{ message }` sempre |
| POST | `/reset-password` | pública, 5/min | 200 `{ reset: true }` · 400 `TOKEN_INVALID` |
| PATCH | `/password` | bearer | 200 `{ changed: true }` · 400 `INVALID_PASSWORD` |
| GET | `/sessions` | bearer | `SessionDto[]` ativas, mais recentes primeiro |
| DELETE | `/sessions/:id` | bearer | 204 · 404 `NOT_FOUND` (inexistente, já revogada ou de outro usuário) |
| POST | `/sessions/revoke-others` | bearer | 200 `{ revoked: n }` |
| GET | `/google` | pública, 20/min | 302 para o Google (ver "Login com Google") |
| GET | `/google/callback` | cookie `lastro_oauth`, 20/min | 302 para `/onboarding` (`?cadastro=google` se a conta é nova, para o GA), `?next=` ou `/painel` + cookies · 302 `/entrar?erro=…` |

## Login com Google

Authorization Code + PKCE (OpenID Connect), sem SDK no frontend: o botão é um link para
`/api/auth/google`. Ativo quando `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão definidos; a
redirect URI cadastrada no Google é `${APP_URL}/api/auth/google/callback` (passa pelo proxy do Next,
então os cookies são first-party).

- `state`, `nonce`, `code_verifier` e o `next` saneado vão num JWT assinado no cookie
  `lastro_oauth` (`HttpOnly; SameSite=Lax; Path=/api/auth/google`, 10 min, uso único).
- O `id_token` é validado com o JWKS do Google (assinatura, `iss`, `aud`, `exp`) e o `nonce`.
  `email_verified=false` é recusado.
- Resolução do usuário (`oauth_identities`, único por `provider + sub`): vínculo existente →
  conta com o mesmo e-mail → usuário novo (trial + categorias padrão, e-mail já verificado, sem
  senha). Vincular a uma conta local **não verificada** apaga a senha e revoga as sessões dela
  (defesa contra pre-account hijacking).
- Contas sem senha recebem `INVALID_CREDENTIALS` no login por senha e definem uma via
  "Esqueci minha senha". O bloqueio por força bruta não se aplica ao Google (não há senha em jogo).
- Erros voltam como `/entrar?erro=google_cancelado|google_email_nao_verificado|google_conta_indisponivel|google_indisponivel|google_falhou`.

## Senhas

- Política (igual ao frontend): 10–128 caracteres, ao menos uma letra e um dígito
  (`password/password.policy.ts`).
- Hash Argon2id via `@node-rs/argon2` (binários pré-compilados, inclusive Alpine/musl), parâmetros
  `ARGON2_*`. Rehash transparente no login quando os parâmetros mudam.
- E-mail desconhecido no login executa um `verify` contra um hash descartável para igualar o
  tempo de resposta; o cadastro sempre calcula o hash, exista o e-mail ou não.

## Tokens e sessões

- **Access token**: JWT HS256 (`JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL`) com
  `{ sub, sid, typ: 'access', iss: 'lastro-api', aud: 'lastro-app' }`. Enviado em
  `Authorization: Bearer`.
- **JwtAuthGuard** (global): valida assinatura/iss/aud/typ **e** consulta a sessão por PK — sessão
  revogada ⇒ 401 `SESSION_REVOKED` imediato (logout de outros dispositivos vale na hora); expirado ⇒
  `TOKEN_EXPIRED` (gatilho de refresh no frontend); assinatura inválida ⇒ `TOKEN_INVALID`; usuário
  excluído ⇒ `UNAUTHORIZED`. `lastUsedAt` é regravado no máximo a cada 5 minutos.
- **Refresh token**: opaco, `<sessionId>.<segredo base64url de 32 bytes>`. O banco guarda só
  `sha256(segredo)`; a busca é pela PK e a comparação em tempo constante.
- **Rotação**: cada `/refresh` cria uma nova linha em `sessions` com o mesmo `familyId` e o mesmo
  `expiresAt` (vida absoluta da família = `JWT_REFRESH_TTL` a partir do login — não é estendida) e
  marca a anterior com `revokedAt` + `replacedById`. A troca é condicional (`revokedAt IS NULL`), então
  duas rotações concorrentes do mesmo token resultam em uma vitória e um "reuso".
- **Reuso**: apresentar um refresh token já **rotacionado** (`replacedById` preenchido) revoga **toda a família**, grava
  `REFRESH_REUSE_DETECTED` e loga `warn`; resposta 401 `SESSION_REVOKED` com cookies limpos.
  Tokens revogados por logout/redefinição/revogação manual só recebem 401 `SESSION_REVOKED`.
  Não há janela de tolerância: requisições de refresh concorrentes (duas abas) devem ser
  serializadas no cliente.
- Segredo errado para um id existente ⇒ 401 `UNAUTHORIZED` sem revogar nada (evita DoS por
  adivinhação de id).

## Cookies

| Cookie | Conteúdo | Flags |
| --- | --- | --- |
| `lastro_rt` | refresh token | `HttpOnly; SameSite=Strict; Path=/api/auth; Secure` em staging/produção |
| `lastro_session` | `1` (sem segredo, só para UX de redirecionamento) | `SameSite=Lax; Path=/; Secure` em staging/produção |

`Max-Age` = tempo restante da família. `COOKIE_DOMAIN` opcional. Ambos são limpos em logout,
revogação da sessão atual e em qualquer falha de `/refresh`.

## CSRF

`/refresh` e `/logout` (autenticados por cookie) exigem `Origin` — ou, na falta dele, `Referer` —
pertencente a `CORS_ORIGINS` ou à origem de `APP_URL`; senão 403 `CSRF_REJECTED`. `/refresh` sem
Origin/Referer é rejeitado; `/logout` sem nenhum dos dois é aceito (clientes não-browser, e o pior
caso é um logout). `SameSite=Strict` é uma segunda barreira.

## Força bruta

- Cada senha errada incrementa `failedLoginAttempts`; ao atingir `AUTH_MAX_FAILED_ATTEMPTS`, a conta
  fica bloqueada por `AUTH_LOCKOUT_MINUTES × 2^(bloqueios anteriores)` (teto 24h), o contador volta a
  zero e `lockoutCount` incrementa. Login correto zera tudo.
- A tentativa que dispara o bloqueio e as seguintes (mesmo com senha correta) recebem 423
  `ACCOUNT_LOCKED` com os minutos restantes. E-mails inexistentes nunca recebem 423.
- Rate limit por IP (`@nestjs/throttler`) nas rotas públicas. O IP vem de `req.ip`, que respeita
  `TRUST_PROXY` (use `1` atrás do proxy do Next).

## Tokens de e-mail (`verification_tokens`)

`EMAIL_VERIFICATION` (24h) e `PASSWORD_RESET` (1h): segredo aleatório de 32 bytes, só o SHA-256 é
salvo, uso único via update condicional. Emitir um novo token invalida os anteriores do mesmo tipo.
Links: `${APP_URL}/verificar-email?token=…` e `${APP_URL}/redefinir-senha?token=…`.
A redefinição revoga todas as sessões, zera o bloqueio e marca o e-mail como verificado.
A troca de senha revoga todas as sessões exceto a atual. Ambas enviam aviso por e-mail.

## E-mail

`MailService` + transporte injetável (`MAIL_TRANSPORT` token):

- `log` (padrão): registra assunto/destinatário; o link só é logado em development/test.
- `smtp`: stub tipado que falha com erro claro (a implementar). Falhas de envio são logadas e não
  alteram a resposta HTTP.

Os testes e2e substituem o transporte por um que captura as mensagens.

## Auditoria e limpeza

`security_events`: `LOGIN_SUCCESS`, `LOGIN_FAILED` (motivo: e-mail desconhecido, senha errada,
bloqueado), `LOGOUT`, `PASSWORD_CHANGED`, `SESSION_REVOKED`, `REFRESH_REUSE_DETECTED`, com IP e
user-agent. Nunca são gravados/logados senhas, tokens ou hashes.

`AuthCleanupService` remove a cada hora sessões e tokens expirados/revogados/usados há mais de
7 dias (desligado em `NODE_ENV=test`).
