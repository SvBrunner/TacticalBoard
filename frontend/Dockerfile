# Static SvelteKit build (ADR-008) served by Caddy with an SPA fallback.
# The build output is static and platform-independent, so the Node stage always runs on the
# build machine's platform; only the Caddy stage differs per target platform (arc42 ch. 7).

FROM --platform=$BUILDPLATFORM node:24-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM caddy:2-alpine
LABEL org.opencontainers.image.title="TacticalBoard frontend" \
      org.opencontainers.image.source="https://github.com/SvBrunner/TacticalBoard" \
      org.opencontainers.image.licenses="MIT"
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/build /srv
EXPOSE 8080
