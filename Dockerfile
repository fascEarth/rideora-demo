# Rideora: one image with the Angular website/CMS and the NestJS API.
FROM node:22-alpine AS web
WORKDIR /src/web
COPY web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npx ng build

FROM node:22-alpine AS api
WORKDIR /src/api
COPY api/package*.json ./
RUN npm ci --no-audit --no-fund
COPY api/ ./
RUN npx tsc -p . && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production WEB_DIST=/app/web PORT=3000
WORKDIR /app/api
COPY --from=api /src/api/package.json ./
COPY --from=api /src/api/node_modules ./node_modules
COPY --from=api /src/api/dist ./dist
COPY --from=web /src/web/dist/web/browser /app/web
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -qO- http://127.0.0.1:3000/api/public/health || exit 1
CMD ["node", "dist/main.js"]
