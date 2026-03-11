FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Secrets injetados via --mount=type=secret para não ficarem nas layers.
# Build: docker build --secret id=env,src=.env .
RUN --mount=type=secret,id=env,target=/app/.env \
    export $(grep -v '^#' /app/.env | xargs) && \
    npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]

