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
COPY --from=build /app/index.html ./index.html
COPY --from=build /app/firebase-applet-config.json ./firebase-applet-config.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
EXPOSE 8080
CMD ["npx", "tsx", "server.ts"]
