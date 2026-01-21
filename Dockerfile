# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend only
RUN bun run --cwd packages/frontend build

# Production stage - bun runtime
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Create non-root user
RUN groupadd -r docproc && useradd -r -g docproc docproc

# Copy node_modules (includes sharp native bindings)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/backend/node_modules ./packages/backend/node_modules

# Copy backend source
COPY --from=builder /app/packages/backend ./packages/backend

# Copy frontend build
COPY --from=builder /app/dist/frontend ./dist/frontend

# Copy drizzle migrations
COPY --from=builder /app/drizzle ./drizzle

# Create documents directory
RUN mkdir -p /documents && chown -R docproc:docproc /documents /app

ENV NODE_ENV="production"
ENV STORAGE_LOCAL_DIR="/documents"
ENV PORT=3000

USER docproc

EXPOSE 3000

CMD ["bun", "run", "packages/backend/src/index.ts"]
