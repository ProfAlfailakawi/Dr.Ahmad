FROM node:24.18.0-bookworm-slim

ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json
RUN npm ci --omit=dev --ignore-scripts

COPY server.mjs /app/server.mjs
COPY scripts/editorial-policy.mjs /app/scripts/editorial-policy.mjs
# متون الموقع: مصادر الفهرس التي يقرأها content-index.mjs وقت التشغيل.
# غيابها لا يُسقط الصورة — يُفرغ الفهرس بصمت فيردّ البوت «ما لقيت مادة» على كل سؤال.
COPY src/data.ts /app/src/data.ts
COPY src/data-curated.ts /app/src/data-curated.ts
COPY src/data/research-papers.ts /app/src/data/research-papers.ts
COPY src/data/audio.json /app/src/data/audio.json
COPY src/data/audio-meta.json /app/src/data/audio-meta.json
COPY src/data/podcast-admin.json /app/src/data/podcast-admin.json
COPY src/data/book-passages.json /app/src/data/book-passages.json
COPY src/data/book-knowledge.json /app/src/data/book-knowledge.json
COPY src/data/book-quotes.json /app/src/data/book-quotes.json
COPY src/data/spoken-index.json /app/src/data/spoken-index.json
COPY src/data/bodies.json /app/src/data/bodies.json
COPY src/data/media-archive.json /app/src/data/media-archive.json
COPY src/data/media-archive-transcripts.json /app/src/data/media-archive-transcripts.json
COPY src/data/dr-ahmad-domain-glossary.json /app/src/data/dr-ahmad-domain-glossary.json
COPY src/data/editorial-policy.json /app/src/data/editorial-policy.json
COPY src/data/encyclopedia-search-synonyms.json /app/src/data/encyclopedia-search-synonyms.json
COPY src/data/encyclopedia-structure.json /app/src/data/encyclopedia-structure.json
COPY src/data/encyclopedia-teaching-map.json /app/src/data/encyclopedia-teaching-map.json
COPY src/data/encyclopedia-transcript-corrections.json /app/src/data/encyclopedia-transcript-corrections.json
COPY src/data/encyclopedia-video-transcripts.json /app/src/data/encyclopedia-video-transcripts.json
COPY src/data/encyclopedia-videos-fallback.json /app/src/data/encyclopedia-videos-fallback.json
COPY src/lib/adversarial-misunderstanding.mjs /app/src/lib/adversarial-misunderstanding.mjs
COPY src/lib/encyclopedia-transcript-quality.mjs /app/src/lib/encyclopedia-transcript-quality.mjs
COPY src/lib/semantic-court.mjs /app/src/lib/semantic-court.mjs
COPY src/lib/sovereign-publishing.mjs /app/src/lib/sovereign-publishing.mjs
COPY src/lib/style-dna.mjs /app/src/lib/style-dna.mjs
COPY src/server/admin-communications.mjs /app/src/server/admin-communications.mjs
COPY src/server/encyclopedia-videos.mjs /app/src/server/encyclopedia-videos.mjs
COPY src/server/whatsapp-controller.mjs /app/src/server/whatsapp-controller.mjs
COPY whatsapp-agent/book-quotes.mjs /app/whatsapp-agent/book-quotes.mjs
COPY whatsapp-agent/bot-messages.mjs /app/whatsapp-agent/bot-messages.mjs
COPY whatsapp-agent/bot-rules.mjs /app/whatsapp-agent/bot-rules.mjs
COPY whatsapp-agent/config.mjs /app/whatsapp-agent/config.mjs
COPY whatsapp-agent/content-index.mjs /app/whatsapp-agent/content-index.mjs
COPY whatsapp-agent/conversation-context.mjs /app/whatsapp-agent/conversation-context.mjs
COPY whatsapp-agent/crypto.mjs /app/whatsapp-agent/crypto.mjs
COPY whatsapp-agent/daily-experience.mjs /app/whatsapp-agent/daily-experience.mjs
COPY whatsapp-agent/dialect-lexicon.mjs /app/whatsapp-agent/dialect-lexicon.mjs
COPY whatsapp-agent/domain-concepts.mjs /app/whatsapp-agent/domain-concepts.mjs
COPY whatsapp-agent/intent-engine.mjs /app/whatsapp-agent/intent-engine.mjs
COPY whatsapp-agent/knowledge-modes.mjs /app/whatsapp-agent/knowledge-modes.mjs
COPY whatsapp-agent/reminders.mjs /app/whatsapp-agent/reminders.mjs
COPY whatsapp-agent/scholar.mjs /app/whatsapp-agent/scholar.mjs
COPY whatsapp-agent/spoken-index.mjs /app/whatsapp-agent/spoken-index.mjs
COPY whatsapp-agent/sovereign-brain.mjs /app/whatsapp-agent/sovereign-brain.mjs

USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
