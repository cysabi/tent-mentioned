FROM node:22-slim

WORKDIR /usr/src/app

RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

COPY .env ./
COPY package*.json ./
COPY src ./src/

EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
