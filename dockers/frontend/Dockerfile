FROM cgr.dev/chainguard/node:latest-dev AS build

WORKDIR /app/frontend/web

COPY frontend/web/package.json frontend/web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/web/ ./
COPY frontend/packages/ ../packages/
RUN pnpm run build

FROM cgr.dev/chainguard/nginx:latest AS runtime

COPY dockers/nginx/default.conf /etc/nginx/conf.d/nginx.default.conf
COPY --from=build /app/frontend/web/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=5s --retries=10 CMD ["nginx", "-t"]
