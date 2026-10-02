# Image unique pour l'hébergement (Render, Fly, un VPS…) : l'API Express sert
# aussi l'interface React compilée. Une seule adresse, donc des cookies de
# premier niveau et aucun réglage CORS.
#   docker build -t safeshare .

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY apps apps
# L'interface appelle l'API sur la même origine.
ENV VITE_API_URL=/api
RUN npm run build -w apps/api && npm run build -w apps/web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=10000 STORAGE_DIR=/tmp/safeshare-storage WEB_DIST=/app/apps/web/dist
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/api apps/api
COPY --from=build /app/apps/web/dist apps/web/dist
WORKDIR /app/apps/api
USER node
EXPOSE 10000
CMD ["sh", "scripts/start.sh"]
