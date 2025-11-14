FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY tsconfig.json ./
COPY index.ts ./
COPY src/ ./src/

# Expose port
EXPOSE 3000

# Run the application
CMD ["bun", "run", "index.ts"]