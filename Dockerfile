# Etapa 1: Builder
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile

COPY . .
RUN npx prisma generate
RUN pnpm build

RUN pnpm prune --prod

# Etapa 2: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache curl
WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=8007

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/prisma ./prisma

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1


EXPOSE ${PORT}

CMD ["node", "dist/src/main"]