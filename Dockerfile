# ----------- 1. Base Stage -----------
FROM node:20-alpine AS base
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs
COPY package*.json ./

# ----------- 2. Dependencies Stage -----------
FROM base AS deps
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev && npm cache clean --force

# ----------- 3. Build Stage -----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ----------- 4. Prisma Generate Stage -----------
FROM base AS prisma
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
RUN npx prisma generate

# ----------- 5. Production Stage -----------
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY package*.json ./
COPY prisma ./prisma
USER nodejs
EXPOSE 3000
CMD ["node", "dist/main.js"]