# SDL Operations – production image
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 UPLOAD_DIR=/data/uploads
COPY --from=build /app ./
RUN mkdir -p /data/uploads
VOLUME ["/data"]
EXPOSE 3000
# Applies database migrations (and creates the first admin) before starting
CMD ["sh", "-c", "node scripts/migrate.mjs && npx next start -p ${PORT}"]
