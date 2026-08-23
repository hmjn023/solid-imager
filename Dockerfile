FROM oven/bun:debian

# Install the native build toolchain, Python for the CPU ONNX Runtime package,
# ffmpeg, and certificates for media processing.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    ffmpeg \
    libssl-dev \
    pkg-config \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# dghs-imgutils-rs is a Rust N-API addon and requires a current Rust toolchain
# during bun install. The addon loads the runtime dynamically at application
# startup, so keep the compatible CPU runtime beside its provider library.
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
    sh -s -- -y --profile minimal --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

RUN python3 -m pip install --no-cache-dir --target /tmp/onnxruntime \
    onnxruntime==1.24.2 \
    && mkdir -p /usr/local/lib/onnxruntime \
    && find /tmp/onnxruntime/onnxruntime/capi -maxdepth 1 -type f \
      -name 'libonnxruntime*.so*' \
      -exec cp {} /usr/local/lib/onnxruntime/ \; \
    && test -f /usr/local/lib/onnxruntime/libonnxruntime.so.1.24.2 \
    && test -f /usr/local/lib/onnxruntime/libonnxruntime_providers_shared.so \
    && rm -rf /tmp/onnxruntime

ENV ORT_DYLIB_PATH="/usr/local/lib/onnxruntime/libonnxruntime.so.1.24.2"
ENV LD_LIBRARY_PATH="/usr/local/lib/onnxruntime"
ENV DGHS_BACKEND="cpu"
ENV DGHS_PRECISION="fp32"

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile
RUN bun run --cwd apps/server validate:native
RUN bun run --cwd apps/server build
