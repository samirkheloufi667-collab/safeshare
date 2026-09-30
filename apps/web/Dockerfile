# Image de production de l'interface : fichiers statiques servis par nginx.
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=http://localhost:4200/api .

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/web --include-workspace-root=false
COPY apps/web apps/web
# Les variables VITE_* sont inscrites dans le code au moment du build.
ARG VITE_API_URL=http://localhost:4200/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w apps/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
