# Caddy com o plugin caddy-dns/cloudflare, necessario para o desafio ACME DNS-01.
# A imagem oficial caddy:2-alpine nao traz plugins DNS; compilamos via xcaddy e
# copiamos o binario para a imagem runtime enxuta.
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
