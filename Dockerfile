FROM oven/bun:debian

# Install python3, ffmpeg, and ca-certificates for yt-dlp and media processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
