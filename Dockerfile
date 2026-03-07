FROM node:20-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.output .output

RUN mkdir -p /app/data

ENV HOST=0.0.0.0
ENV PORT=3000
ENV WAITTIME_DB_PATH=/app/data/waittimes.db

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
