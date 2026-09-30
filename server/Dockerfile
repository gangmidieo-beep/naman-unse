# 나만의 운세 서버 — 저장소 루트에서 빌드: docker build -f server/Dockerfile .
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/content/package.json packages/content/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --workspace server --include-workspace-root=false --ignore-scripts=false

FROM node:22-slim
# 공유 카드 이미지(SVG→PNG)에 한글 글꼴이 필요
RUN apt-get update && apt-get install -y --no-install-recommends fonts-noto-cjk && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production APP_ENV=production PORT=8791
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY package.json brand.config.json ./
COPY packages ./packages
COPY server ./server
EXPOSE 8791
CMD ["node", "--import", "tsx", "server/src/index.ts"]
