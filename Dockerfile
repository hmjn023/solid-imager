FROM oven/bun:debian

# Install python3 and ffmpeg for yt-dlp and media processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
