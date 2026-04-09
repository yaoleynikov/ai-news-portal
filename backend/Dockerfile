# Use the lightweight Debian Slim image. 
# Alpine often has issues compiling C++ bindings for library "sharp" and "ONNX" (used by Xenova Transformers).
FROM node:20-slim

# Install OS dependencies necessary for node-gyp, sharp (libvips), and ONNX runtime used by @xenova/transformers
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package descriptors first to leverage Docker layer caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --omit=dev

# Copy the rest of the backend source code
COPY . .

RUN chown -R node:node /app \
  && mkdir -p /app/.cache \
  && chown node:node /app/.cache \
  && chmod +x /app/docker-entrypoint.sh

# Entrypoint fixes permissions on mounted volume, then drops to node.
USER root
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Single process: job worker (sequencer.js) with embedded RSS gatekeeper unless GATEKEEPER_INTERVAL_MS=0.
CMD ["npm", "run", "worker"]
