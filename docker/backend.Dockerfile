# QBite Backend — Dockerfile (placeholder)
#
# This is a structural placeholder for the engineering-foundation phase.
# It is NOT wired into a working deploy yet — no build has been
# validated against it. Multi-stage build (deps → build → runtime) is
# the intended shape once the backend has real routes/business logic
# to ship, per DEVELOPMENT_ROADMAP.md.

# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci --workspace=@qbite/backend

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=@qbite/backend

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "dist/server.js"]
