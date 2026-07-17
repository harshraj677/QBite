# QBite Admin — Dockerfile (placeholder)
#
# Structural placeholder, not yet validated against a real build — see
# docker/backend.Dockerfile for the same caveat. Standard Next.js
# standalone-output multi-stage shape, to be activated once
# `output: "standalone"` is enabled in next.config.ts during hardening.

# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
RUN npm ci --workspace=@qbite/admin

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=@qbite/admin

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/admin/.next ./.next
COPY --from=build /app/apps/admin/public ./public
COPY --from=build /app/apps/admin/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@qbite/admin"]
