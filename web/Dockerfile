# 나만의 운세 웹(정적) — 저장소 루트에서 빌드: docker build -f web/Dockerfile .
# 빌드 때 API_ORIGIN·PUBLIC_WEB_ORIGIN·MOCK_MODE 등이 화면 코드에 들어간다(Railway 는 서비스 변수를 빌드 인자로 넘김).
FROM node:22-slim AS build
WORKDIR /app
ARG MOCK_MODE=true
ARG API_ORIGIN=
ARG PUBLIC_WEB_ORIGIN=
ARG KAKAO_JS_KEY=
ARG ADSENSE_CLIENT_ID=
ENV MOCK_MODE=$MOCK_MODE API_ORIGIN=$API_ORIGIN PUBLIC_WEB_ORIGIN=$PUBLIC_WEB_ORIGIN KAKAO_JS_KEY=$KAKAO_JS_KEY ADSENSE_CLIENT_ID=$ADSENSE_CLIENT_ID
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/content/package.json packages/content/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build -w web

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/web/dist /srv
EXPOSE 8080
