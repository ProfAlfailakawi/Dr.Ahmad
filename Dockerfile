FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Firebase Hosting serves the front end. Cloud Run only needs the API server and
# the two small radar policy modules. The personal glossary is already expanded
# in the browser request, so the container does not depend on a new nested COPY.
COPY server.mjs ./server.mjs
COPY scripts/daily-radar.mjs scripts/editorial-policy.mjs ./scripts/
COPY src/data/editorial-policy.json ./src/data/editorial-policy.json
RUN mkdir -p dist && node --check server.mjs
EXPOSE 8080
CMD ["node", "server.mjs"]
