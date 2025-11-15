FROM oven/bun:latest

WORKDIR /app

# Install system dependencies and compilers
RUN apt-get update && apt-get install -y \
    # C++ compiler
    g++ \
    # Java JDK
    openjdk-17-jdk \
    # Build tools for Rust and TinyGo
    curl \
    wget \
    build-essential \
    pkg-config \
    tar \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install TinyGo for Go WASM compilation
RUN wget https://github.com/tinygo-org/tinygo/releases/download/v0.32.0/tinygo0.32.0.linux-amd64.tar.gz \
    && tar -xzf tinygo0.32.0.linux-amd64.tar.gz \
    && cp tinygo/bin/tinygo /usr/local/bin/ \
    && chmod +x /usr/local/bin/tinygo \
    && rm -rf tinygo0.32.0.linux-amd64.tar.gz tinygo

# Verify installations
RUN rustc --version && \
    g++ --version && \
    javac -version && \
    java -version && \
    tinygo version

# Copy package files
COPY package.json ./

# Install dependencies
# Install without frozen lockfile to allow lockfile regeneration if needed
RUN bun install --production

# Copy source code
COPY tsconfig.json ./
COPY index.ts ./
COPY src/ ./src/

# Expose port
EXPOSE 3000

# Run the application
CMD ["bun", "run", "index.ts"]