FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Cloud Run serves the API only. Create every destination directory explicitly so
# Docker/Cloud Build never depends on implicit parent creation.
RUN mkdir -p /app/dist /app/scripts /app/src/data
COPY server.mjs /app/server.mjs
COPY scripts/daily-radar.mjs /app/scripts/daily-radar.mjs
COPY scripts/editorial-policy.mjs /app/scripts/editorial-policy.mjs
COPY src/data/editorial-policy.json /app/src/data/editorial-policy.json

# Fail during image build, before deployment, if the server or policy modules are invalid.
RUN node --check /app/server.mjs \
 && node --check /app/scripts/daily-radar.mjs \
 && node --check /app/scripts/editorial-policy.mjs

EXPOSE 8080
CMD ["node", "/app/server.mjs"]
