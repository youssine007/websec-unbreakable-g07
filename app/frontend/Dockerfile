FROM node:24-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . ./
# Vite inlines VITE_* vars at build time, so the backend URL must be known
# at image build, not container start.
ARG VITE_API_BASE_URL=http://localhost:8123
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31.7-alpine3.24
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 8080
USER 101
