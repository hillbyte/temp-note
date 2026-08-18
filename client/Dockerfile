# client/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (using npm install since there might not be a package-lock.json)
RUN npm install

# Copy source code and build
COPY . .

ARG PUBLIC_API_URL
ENV PUBLIC_API_URL=$PUBLIC_API_URL

RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built assets and production dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

# Run Astro's standalone server
CMD ["node", "./dist/server/entry.mjs"]
