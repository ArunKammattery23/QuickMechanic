# --- Production Image ---
FROM node:20-alpine

WORKDIR /usr/src/app

# Copy production dependencies configuration
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the pre-built application from the local machine!
# This prevents Google Cloud Build from running out of memory during Webpack compilation.
COPY dist ./dist

# Set standard environment variables (Cloud Run will inject PORT)
ENV NODE_ENV=production

# The port Cloud Run uses
EXPOSE 8080

# Start the monolith
CMD ["node", "dist/apps/backend/main.js"]
