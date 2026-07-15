ARG BASE_IMAGE=node:20-alpine
ARG NPM_REGISTRY=https://registry.npmmirror.com
FROM ${BASE_IMAGE} AS dependencies

ARG NPM_REGISTRY
WORKDIR /app
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY} \
    COREPACK_NPM_REGISTRY=${NPM_REGISTRY}
RUN npm config set registry "${NPM_REGISTRY}" \
    && corepack enable \
    && corepack prepare pnpm@9.15.5 --activate \
    && pnpm config set registry "${NPM_REGISTRY}"

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prefer-offline

FROM dependencies AS builder

ARG SERVER_TARGET
ARG APP_URL_PREFIX=/api
ARG APP_BASE_PATH=/suffer-web
ARG JWT_SECRET=next-admin
ENV SERVER_TARGET=${SERVER_TARGET} \
    APP_URL_PREFIX=${APP_URL_PREFIX} \
    APP_BASE_PATH=${APP_BASE_PATH} \
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
