FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .
RUN npx prisma generate
RUN pnpm build


FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

# Instalar dependencias de producción Y prisma para generar el cliente
RUN pnpm install --prod
RUN pnpm add -D prisma@7.4.1
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 8007

CMD ["node", "dist/src/main.js"]