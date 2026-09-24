FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/server-services.ts ./server-services.ts
COPY --from=build /app/src ./src
COPY --from=build /app/index.html ./index.html
COPY --from=build /app/firebase-applet-config.json ./firebase-applet-config.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget --spider --quiet http://127.0.0.1:8080/api/health || exit 1
CMD ["npx", "tsx", "server.ts"]
