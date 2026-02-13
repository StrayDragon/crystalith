ARG NODE_IMAGE=node:20-trixie-slim
ARG NGINX_IMAGE=nginx:1.29.5-trixie

FROM ${NODE_IMAGE} AS build

ARG NPM_REGISTRY=""
ARG PNPM_VERSION=10.29.2

WORKDIR /app/frontend/web

RUN set -eux; \
  if [ -n "$NPM_REGISTRY" ]; then \
    npm config set registry "$NPM_REGISTRY"; \
    export COREPACK_NPM_REGISTRY="$NPM_REGISTRY"; \
  fi; \
  corepack enable; \
  corepack prepare "pnpm@${PNPM_VERSION}" --activate

COPY frontend/web/package.json frontend/web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/web/ ./
COPY frontend/packages/ ../packages/

RUN pnpm run build

FROM ${NGINX_IMAGE} AS runtime

COPY dockers/nginx/default.conf /etc/nginx/conf.d/nginx.default.conf
COPY --from=build /app/frontend/web/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --retries=10 CMD ["nginx", "-t"]
