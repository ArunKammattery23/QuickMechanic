# --- Production Image ---
FROM node:20-alpine

WORKDIR /usr/src/app

# Keep the realtime cache in the same capped Cloud Run instance. This avoids a
# separately billed Redis service while preserving the app's existing
# localhost Redis configuration.
RUN apk add --no-cache redis

# Copy production dependencies configuration
COPY package*.json ./

# Install exactly the reviewed lockfile. The Redis integration currently
# declares a NestJS 10 peer range but is verified by our NestJS 11 test suite,
# so npm must not re-resolve and reject that existing lockfile relationship.
RUN npm ci --omit=dev --legacy-peer-deps

# Copy the pre-built application from the local machine!
# This prevents Google Cloud Build from running out of memory during Webpack compilation.
COPY dist ./dist

# Set standard environment variables (Cloud Run will inject PORT)
ENV NODE_ENV=production

# The port Cloud Run uses
EXPOSE 8080

# Start the monolith
CMD ["sh", "-c", "redis-server --daemonize yes && exec node dist/apps/backend/main.js"]
