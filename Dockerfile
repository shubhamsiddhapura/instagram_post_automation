# Production Dockerfile for MomaiDham Automation
FROM node:22-bookworm-slim

# Install system dependencies: Python 3, pip, ffmpeg, and build essentials
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    python-is-python3 \
    ffmpeg \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Set up Python virtual environment
ENV VIRTUAL_ENV=/app/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Enforce Node.js memory safety for Render 512MB RAM limit
ENV NODE_OPTIONS="--max-old-space-size=256 --expose-gc"

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir "pillow"

# Copy package files and install Node.js dependencies
COPY package*.json ./
COPY tsconfig.json ./
COPY scripts/patch-baileys.js ./scripts/

RUN npm ci

# Copy application source code and configs
COPY config/ ./config/
COPY src/ ./src/
COPY assets/ ./assets/
COPY scripts/ ./scripts/

# Build TypeScript to dist/
RUN npm run build

# Volumes for persistent session storage
VOLUME ["/app/wa-session"]

# Start the continuous automation daemon
CMD ["npm", "start"]
