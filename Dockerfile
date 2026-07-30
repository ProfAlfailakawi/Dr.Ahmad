FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Cloud Run now serves the design critic and the central WhatsApp controller.
# Install production dependencies explicitly (firebase-admin + sharp) instead of
# relying on a dependency-free image that could start locally and fail in Cloud Run.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --registry=https://registry.npmjs.org/

RUN mkdir -p /app/dist /app/scripts /app/src/data /app/src/server /app/whatsapp-agent
COPY server.mjs /app/server.mjs
COPY scripts/daily-radar.mjs /app/scripts/daily-radar.mjs
COPY scripts/editorial-policy.mjs /app/scripts/editorial-policy.mjs
COPY src/server/whatsapp-controller.mjs /app/src/server/whatsapp-controller.mjs
COPY src/data.ts /app/src/data.ts
COPY src/data-curated.ts /app/src/data-curated.ts
COPY src/data/bodies.json /app/src/data/bodies.json
COPY src/data/audio.json /app/src/data/audio.json
COPY src/data/audio-meta.json /app/src/data/audio-meta.json
COPY src/data/podcast-admin.json /app/src/data/podcast-admin.json
COPY src/data/research-papers.ts /app/src/data/research-papers.ts
COPY src/data/editorial-policy.json /app/src/data/editorial-policy.json
COPY whatsapp-agent/content-index.mjs /app/whatsapp-agent/content-index.mjs
COPY whatsapp-agent/config.mjs /app/whatsapp-agent/config.mjs
COPY whatsapp-agent/dialect-lexicon.mjs /app/whatsapp-agent/dialect-lexicon.mjs
# عقل الواتساب المركزي يستورد محرك النوايا وقوالب الرسائل وتوابعهما؛ غيابها
# كان لغماً يسقط الخدمة عند أول نشر بعد تحديث ٢٩ يوليو. القائمة تطابق شجرة
# استيراد src/server/whatsapp-controller.mjs كاملة (استيرادات ساكنة فقط).
COPY whatsapp-agent/intent-engine.mjs /app/whatsapp-agent/intent-engine.mjs
COPY whatsapp-agent/bot-messages.mjs /app/whatsapp-agent/bot-messages.mjs
COPY whatsapp-agent/bot-rules.mjs /app/whatsapp-agent/bot-rules.mjs
COPY whatsapp-agent/crypto.mjs /app/whatsapp-agent/crypto.mjs
COPY whatsapp-agent/reminders.mjs /app/whatsapp-agent/reminders.mjs
COPY whatsapp-agent/scholar.mjs /app/whatsapp-agent/scholar.mjs
COPY whatsapp-agent/knowledge-modes.mjs /app/whatsapp-agent/knowledge-modes.mjs
COPY whatsapp-agent/conversation-context.mjs /app/whatsapp-agent/conversation-context.mjs
COPY whatsapp-agent/daily-experience.mjs /app/whatsapp-agent/daily-experience.mjs

RUN node --check /app/whatsapp-agent/intent-engine.mjs \
 && node --check /app/server.mjs \
 && node --check /app/scripts/daily-radar.mjs \
 && node --check /app/scripts/editorial-policy.mjs \
 && node --check /app/src/server/whatsapp-controller.mjs

EXPOSE 8080
CMD ["node", "/app/server.mjs"]
