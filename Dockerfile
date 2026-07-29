# خادم dr-api على Cloud Run — يشغّل server.mjs مباشرةً بلا بناء الموقع (vite).
# buildpacks كانت تُشغّل gcp-build (بناء الموقع الكامل) فتفشل لأن سكربتات البناء
# مستبعدة من حزمة dr-api المصغّرة. هذا الـ Dockerfile يتجاوز ذلك.
FROM node:24-slim
WORKDIR /app

# التبعيات فقط أولاً (طبقة مخبّأة) — لا سكربتات build في المشروع، فـ npm ci آمن.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# مصدر الخادم (مُرشَّح مسبقاً بـ .gcloudignore و .dockerignore).
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
