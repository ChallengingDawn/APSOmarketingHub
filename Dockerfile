# syntax=docker/dockerfile:1
# Multi-stage build for the APSO Marketing Hub (Next.js 15, standalone output).
# Produces a lean image for AWS ECS Fargate. Listens on HTTP :3000.

# ---- deps: install node_modules from the lockfile ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile the Next.js standalone server ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- run: minimal runtime image ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Next.js standalone server defaults to localhost — bind to all interfaces
# so the Application Load Balancer can reach the container.
ENV HOSTNAME=0.0.0.0

# Standalone output already includes the traced node_modules + server.js.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
