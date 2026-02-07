# syntax=docker/dockerfile:1

# --- Build Stage ---
FROM node:20-slim AS builder

# Install system dependencies for Prisma
RUN apt-get update -y \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY .env.compose .env

# Install dependencies (copy only package files first for better cache)
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install

# Generate Prisma Client (uses postinstall script)
RUN npx prisma generate

# Copy the rest of the application code
COPY . .

# Build the NestJS app
RUN npm run build

# --- Production Stage ---
FROM node:20-slim AS production

WORKDIR /usr/src/app

# Install system dependencies for Prisma
RUN apt-get update -y \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*



# Copy only the built app and node_modules from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/prisma.config.* ./

# If you use migrations at runtime, copy them too
COPY --from=builder /usr/src/app/prisma/migrations ./prisma/migrations

# Set environment variables (override in deployment)
ENV NODE_ENV=production

# Expose the port (Nest default is 3000)
EXPOSE 8080

# Run migrations and start the app
# 임시로 경로 확인용 로그 추가
# dist/main.js 대신 dist/src/main.js를 실행합니다.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
