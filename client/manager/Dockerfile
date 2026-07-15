FROM node:20-alpine AS dependencies

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

ARG SERVER_TARGET
ARG APP_URL_PREFIX=/api
ARG JWT_SECRET=next-admin
ENV SERVER_TARGET=${SERVER_TARGET} \
    APP_URL_PREFIX=${APP_URL_PREFIX} \
    JWT_SECRET=${JWT_SECRET}

COPY . ./
RUN pnpm run build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY package.json pnpm-lock.yaml ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

RUN chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 9901

CMD ["./node_modules/.bin/next", "start", "-p", "9901"]
