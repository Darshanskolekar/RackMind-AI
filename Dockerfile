# ==============================================================================
# Multi-Stage Production Dockerfile for RackMind AI (TwinOps)
# Deployment Target: Google Cloud Run (Google Cloud AI Builder Cup 2026)
# ==============================================================================

# --- Stage 1: Build Frontend Assets ---
FROM node:20-slim AS builder

WORKDIR /app

# Copy dependency specifications
COPY package.json package-lock.json* bun.lock* ./

# Install dependencies
RUN npm ci || npm install

# Copy source code and build client bundle
COPY . .
RUN npm run build

# --- Stage 2: Production Container Runtime ---
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install production dependencies only
COPY package.json package-lock.json* bun.lock* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Install tsx globally or as runtime executor for server.ts
RUN npm install -g tsx

# Copy built distribution assets from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src/data ./src/data
COPY --from=builder /app/src/types ./src/types
COPY --from=builder /app/metadata.json ./metadata.json

# Cloud Run binds to $PORT (default 8080)
EXPOSE 8080

# Run the unified Express + Vite production server
CMD ["tsx", "server.ts"]
