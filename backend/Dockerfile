FROM node:24-bookworm-slim AS build

WORKDIR /workspace/backend

# Install ALL dependencies (including devDependencies for esbuild build step)
COPY backend/package*.json ./
RUN npm ci

# Copy backend and shared frontend modules used by build:utils
COPY backend/ ./
COPY src/ ../src/
COPY shared/ ../shared/

RUN chown -R node:node /workspace

# Build utility bundles (esbuild)
RUN npm run build:utils

# Remove devDependencies after build
RUN npm prune --omit=dev

FROM gcr.io/distroless/nodejs24-debian12:nonroot AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /workspace/backend /app

# Expose API port
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:8080/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["server.js"]
