# Etapa 1: Builder - Instalar dependencias y construir la aplicación
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

# Instalar pnpm
RUN npm install -g pnpm

# Copiar solo los archivos de manifiesto para instalar dependencias
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copiar el resto del código fuente
COPY . .

# Generar Prisma Client y construir el proyecto
RUN npx prisma generate
RUN pnpm build

# ---

# Etapa 2: Runner - Ejecutar la aplicación en producción
FROM node:20-alpine AS runner
WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copiar node_modules completos desde builder (pnpm virtual store incluye .prisma generado)
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copiar los artefactos de construcción (la carpeta dist) desde la etapa builder
COPY --from=builder /usr/src/app/dist ./dist

# Copiar el schema de Prisma para que esté disponible en tiempo de ejecución
COPY --from=builder /usr/src/app/prisma ./prisma

COPY package.json ./

EXPOSE 8007

# nest build con sourceRoot=src compila a dist/src/main.js
CMD ["node", "/usr/src/app/dist/src/main.js"]
