# server/Dockerfile
#
# This file defines how to build your Express server into a Docker image.
# An image is a snapshot of everything needed to run the server:
# the OS, Node.js, your code, and your dependencies — packaged together
# so it runs identically on any machine.
#
# WHY TWO STAGES (builder + production):
# The "builder" stage installs ALL dependencies including devDependencies
# (TypeScript, ts-node-dev, @types/* etc) and compiles the code.
# The "production" stage copies only the compiled output and
# production dependencies — devDependencies never make it into the
# final image. This keeps the image lean: ~200MB instead of ~600MB+.
# Smaller image = faster deploys, less attack surface, lower registry cost.

# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# node:20-alpine uses Alpine Linux — a minimal Linux distro (~5MB base)
# instead of the default Debian (~150MB). Alpine is the standard choice
# for Node.js production images because it's small and well-maintained.
FROM node:20-alpine AS builder

# Set the working directory inside the container.
# All subsequent commands run from here. /app is convention.
WORKDIR /app

# Copy package files BEFORE copying source code.
# WHY THIS ORDER MATTERS:
# Docker builds in layers. Each instruction is a cached layer.
# If package.json hasn't changed, Docker reuses the cached
# npm ci layer — even if your source code changed.
# Copying package files first means "npm ci" only re-runs when
# dependencies actually change, not on every code change.
# Without this, every build would re-download all node_modules.
COPY package*.json ./

# npm ci (not npm install) in Docker:
# - ci = "clean install" — deletes node_modules and installs fresh
# - Installs EXACT versions from package-lock.json (reproducible builds)
# - Faster than npm install in CI/Docker because it skips lock file generation
RUN npm ci

# NOW copy the source code (after dependencies are installed).
COPY . .

# Compile TypeScript to JavaScript.
# Output goes to /app/dist as configured in tsconfig.json.
# The compiled JS is what the production stage actually runs —
# no TypeScript compiler or ts-node needed at runtime.
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Set NODE_ENV before npm ci so npm skips devDependencies automatically.
# This is the environment variable your logger.ts checks to decide
# whether to use pino-pretty (development) or raw JSON (production).
ENV NODE_ENV=production

COPY package*.json ./

# --omit=dev skips devDependencies (TypeScript, ts-node-dev, @types/*, vitest etc).
# These were needed to BUILD the code but are not needed to RUN it.
# Result: production image only contains what's actually needed at runtime.
RUN npm ci --omit=dev

# Copy compiled JavaScript from the builder stage — not the TypeScript source.
# This is the key multi-stage benefit: source maps and TypeScript compiler
# never enter the production image at all.
COPY --from=builder /app/dist ./dist

# Document which port the server listens on.
# This is metadata only — the actual port mapping happens in docker-compose.yml.
# EXPOSE doesn't open any ports by itself; it's documentation for humans
# and tooling (like docker inspect) that read the Dockerfile.
EXPOSE 3001

# The command that runs when the container starts.
# Uses the compiled JS, same as Railway's "npm start" command.
# CMD vs RUN: RUN executes during image BUILD. CMD executes when
# the container STARTS from the image.
CMD ["node", "dist/index.js"]