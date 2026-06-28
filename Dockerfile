FROM oven/bun:debian AS builder

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile \
    && bun --filter @solid-imager/server run build

FROM oven/bun:debian

# Install python3, ffmpeg, and ca-certificates for yt-dlp and media processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app /app

ENV NODE_ENV=production

CMD ["bun", "run", "start"]
