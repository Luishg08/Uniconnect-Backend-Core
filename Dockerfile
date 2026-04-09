# --- ETAPA 1: Builder ---
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm

# Instalar TODAS las dependencias (incluyendo devDependencies para compilar)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# Copiar código fuente y generar Prisma
COPY . .
RUN npx prisma generate
RUN pnpm build

# --- ETAPA 2: Producción ---
FROM node:20-alpine

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm

# Instalar SOLO dependencias de producción
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod

# Copiar los compilados
COPY --from=builder /app/dist ./dist

# Copiar los esquemas y configuración de Prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# 🔥 Copiar el cliente de Prisma ya generado para evitar ejecutar npx nuevamente
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 8007

CMD ["node", "dist/src/main.js"]