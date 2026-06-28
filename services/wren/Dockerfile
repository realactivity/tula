# Wren - SMART on FHIR records relay (Bun runtime).
# Built for Azure Container Apps. JWKS is NOT generated here; the entrypoint
# loads/persists it from the mounted Azure Files share (see docker-entrypoint.sh).
FROM oven/bun:1

# `zip` is required by the /skill.zip endpoint (server shells out to it).
RUN apt-get update \
    && apt-get install -y --no-install-recommends zip unzip ca-certificates bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Application source.
COPY . .

# Build the Epic brands directory and the skill package, then expose brand
# assets under static/ where the server serves them from.
RUN bun run build:brands \
    && bun run build:skill \
    && mkdir -p static data \
    && ln -snf /app/brands /app/static/brands \
    && sed -i 's/\r$//' ./docker-entrypoint.sh \
    && chmod +x ./docker-entrypoint.sh

ENV NODE_ENV=production \
    ENABLE_TEST_PROVIDER=false \
    CONFIG_PATH=./config.prod.json \
    PORT=8000

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
