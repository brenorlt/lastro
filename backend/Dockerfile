# syntax=docker/dockerfile:1.7
# Lastro API — build multi-stage. Contexto: ./backend (ver docker-compose.yml).

ARG NODE_VERSION=24-alpine

# ─── base ───────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    SCARF_ANALYTICS=false

# ─── deps: instala dependências (inclui dev) e gera o Prisma Client ─────
FROM base AS deps
# URL fictícia: `prisma generate` (postinstall) só precisa que a variável exista.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=${DATABASE_URL}
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci

# ─── build: compila TypeScript e remove devDependencies ─────────────────
FROM deps AS build
COPY . .
RUN npx prisma generate \
 && npm run build \
 && npm prune --omit=dev

# ─── runtime: imagem enxuta, usuário não-root ───────────────────────────
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3333
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
# Uploads (avatares). Monte um volume aqui para persistir entre deploys.
RUN mkdir -p /app/storage && chown node:node /app/storage
VOLUME ["/app/storage"]
USER node
EXPOSE 3333
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health/live" > /dev/null || exit 1
# Aplica migrations pendentes e sobe a API (exec => node recebe SIGTERM direto).
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
