
# Dashboard (Vite + React) is compiled first so the Go image always ships the
# assets that match this commit, regardless of what is checked into static/.
FROM node:22-alpine AS dashboard

WORKDIR /app/dashboard-src

COPY dashboard-src/package.json dashboard-src/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY dashboard-src/ ./
# vite.config.ts writes to ../static/dashboard, i.e. /app/static/dashboard
RUN npm run build

FROM golang:latest as builder

# Configurar proxy do Go para evitar problemas de rede
ENV GOPROXY=https://proxy.golang.org,direct
ENV GOSUMDB=sum.golang.org
ENV CGO_ENABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    pkg-config \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY go.mod go.sum ./
# go.mod replaces go.mau.fi/whatsmeow with this local patched copy, so it must
# be present before `go mod download` resolves the module graph
COPY whatsmeow/ ./whatsmeow/

# Download com retry e verificação
RUN go mod download && go mod verify

COPY . .

RUN go build -o wuzapi

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    netcat-openbsd \
    postgresql-client \
    openssl \
    curl \
    ffmpeg \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

ENV TZ="America/Sao_Paulo"

WORKDIR /app

COPY --from=builder   /app/wuzapi           /app/
COPY --from=builder   /app/static           /app/static/
# Overwrite the checked-in dashboard bundle with the one just compiled
COPY --from=dashboard /app/static/dashboard /app/static/dashboard/
COPY --from=builder   /app/wuzapi.service   /app/wuzapi.service

RUN chmod +x /app/wuzapi && \
    chmod -R 755 /app && \
    chown -R root:root /app

# Shell entrypoint so WUZAPI_WADEBUG can be turned into the --wadebug flag.
# ${VAR:+--flag=$VAR} expands to the flag only when the env var is set and non-empty.
# `exec` replaces the shell so the binary still receives signals (graceful shutdown).
ENTRYPOINT ["/bin/sh", "-c", "exec /app/wuzapi --logtype=console --color=true ${WUZAPI_WADEBUG:+--wadebug=$WUZAPI_WADEBUG}"]
