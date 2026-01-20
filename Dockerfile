# Build stage - compile everything
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install all dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend
RUN bun run build

# Compile backend to single binary
RUN bun build packages/backend/src/index.ts \
    --compile \
    --minify \
    --target=bun-linux-x64 \
    --outfile=server

# Production stage - minimal Debian
FROM debian:bookworm-slim AS runner

WORKDIR /app

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r docproc && useradd -r -g docproc docproc

# Copy compiled binary
COPY --from=builder /app/server ./server

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

CMD ["./server"]
