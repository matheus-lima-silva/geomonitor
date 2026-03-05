FROM node:20-alpine

WORKDIR /app

# Install ALL dependencies (including devDependencies for esbuild build step)
COPY package*.json ./
RUN npm ci

# Copy application source code
COPY . .

# Build utility bundles (esbuild)
RUN npm run build:utils

# Remove devDependencies after build
RUN npm prune --omit=dev

# Expose API port
EXPOSE 8080

CMD ["node", "server.js"]
