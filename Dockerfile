FROM node:20-alpine@sha256:b88333c42c23fbd91596ebd7fd10de239cedab9617de04142dde7315e3bc0afa AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID
ARG VITE_API_BASE_URL

# Keep Fly/GitHub deploys compatible with --build-arg while still allowing
# local secure builds with an optional secret file:
# docker build --secret id=env,src=.env .
RUN --mount=type=secret,id=env,target=/run/secrets/env,required=false \
    if [ -f /run/secrets/env ]; then \
      set -a; . /run/secrets/env; set +a; \
    fi && \
    export VITE_FIREBASE_API_KEY="${VITE_FIREBASE_API_KEY}" \
      VITE_FIREBASE_AUTH_DOMAIN="${VITE_FIREBASE_AUTH_DOMAIN}" \
      VITE_FIREBASE_PROJECT_ID="${VITE_FIREBASE_PROJECT_ID}" \
      VITE_FIREBASE_STORAGE_BUCKET="${VITE_FIREBASE_STORAGE_BUCKET}" \
      VITE_FIREBASE_MESSAGING_SENDER_ID="${VITE_FIREBASE_MESSAGING_SENDER_ID}" \
      VITE_FIREBASE_APP_ID="${VITE_FIREBASE_APP_ID}" \
      VITE_FIREBASE_MEASUREMENT_ID="${VITE_FIREBASE_MEASUREMENT_ID}" \
      VITE_API_BASE_URL="${VITE_API_BASE_URL}" && \
    node -e "const required = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_APP_ID', 'VITE_API_BASE_URL']; const missing = required.filter((key) => !process.env[key]); if (missing.length) { console.error('Missing required web build vars: ' + missing.join(', ')); process.exit(1); }" && \
    npm run build

FROM nginx:stable-alpine@sha256:5b4900b042ccfa8b0a73df622c3a60f2322faeb2be800cbee5aa7b44d241649e AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

RUN mkdir -p /var/cache/nginx/client_temp /var/run/nginx \
  && sed -i -E 's#^pid\s+[^;]+;#pid /tmp/nginx.pid;#' /etc/nginx/nginx.conf \
  && chown -R nginx:nginx /var/cache/nginx /var/run/nginx /var/log/nginx /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

USER nginx

CMD ["nginx", "-g", "daemon off;"]
