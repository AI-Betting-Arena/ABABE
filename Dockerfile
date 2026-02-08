# syntax=docker/dockerfile:1

# --- Build Stage ---
FROM node:20-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files, prisma schema and install all dependencies
# This runs 'prisma generate' via the postinstall script
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the application (this will include the seeder)
RUN npm run build


# --- Production Stage ---
FROM node:20-slim AS production

WORKDIR /usr/src/app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files and install only production dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts

# Copy artifacts from the builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/prisma.config.ts ./
# Crucially, copy the generated prisma client from its custom path
COPY --from=builder /usr/src/app/src/generated/prisma ./src/generated/prisma

ENV NODE_ENV=production
EXPOSE 8080

# Run migrations, seed the database, and start the app
# This command uses the compiled seeder from 'dist/prisma/seed.js'
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/src/main.js"]
