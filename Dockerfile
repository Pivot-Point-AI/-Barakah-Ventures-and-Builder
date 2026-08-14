FROM node:20-alpine AS build
WORKDIR /app
COPY package.json build.js ./
COPY src ./src
RUN node build.js

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/index.html /app/contact.html /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
COPY public/ /usr/share/nginx/html/public/

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null || exit 1
