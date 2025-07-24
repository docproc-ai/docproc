FROM node:22-alpine AS base

FROM base AS deps
# RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev


FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build


FROM base AS runner

WORKDIR /app
ENV NODE_ENV="production"

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY ./drizzle ./drizzle

# Create data directory with proper permissions
RUN mkdir -p /documents && chown -R nextjs:nodejs /documents

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
