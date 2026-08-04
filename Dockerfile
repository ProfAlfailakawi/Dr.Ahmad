FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Cloud Run now serves the design critic and the central WhatsApp controller.
# Install production dependencies explicitly (firebase-admin + sharp) instead of
# relying on a dependency-free image that could start locally and fail in Cloud Run.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --registry=https://registry.npmjs.org/

RUN mkdir -p /app/dist /app/scripts /app/src/data /app/src/lib /app/src/server /app/whatsapp-agent
COPY server.mjs /app/server.mjs
COPY scripts/daily-radar.mjs /app/scripts/daily-radar.mjs
COPY scripts/editorial-policy.mjs /app/scripts/editorial-policy.mjs
# محرك بصمة الأسلوب: يستورده server.mjs، وكان سطر السماح في .gcloudignore
# موجوداً بلا سطر النسخ هنا — فبُنيت الصورة بنجاح («node --check» يقرأ الصياغة
# ولا يحلّ الاستيراد) ثم مات المُشغَّل عند الإقلاع، فرفض Cloud Run النسخة
# وسقط نشر الموقع كله معه. قاعدة الدار في أعلى الملف كانت تقول ذلك حرفاً.
COPY src/lib/style-dna.mjs /app/src/lib/style-dna.mjs
# جواز النشر يُوقَّع داخل server.mjs؛ لذلك محرك التطبيع جزء من الخادم لا من
# الواجهة فقط. يجب أن يبقى هذا السطر متزامناً مع سماحه في .gcloudignore.
COPY src/lib/sovereign-publishing.mjs /app/src/lib/sovereign-publishing.mjs
COPY src/lib/semantic-court.mjs /app/src/lib/semantic-court.mjs
COPY src/lib/adversarial-misunderstanding.mjs /app/src/lib/adversarial-misunderstanding.mjs
COPY src/server/whatsapp-controller.mjs /app/src/server/whatsapp-controller.mjs
COPY src/server/admin-communications.mjs /app/src/server/admin-communications.mjs
# فهرس موسوعة تكنولوجيا التعليم جزء من API الآن؛ server.mjs يستورده استيراداً
# ساكناً، لذلك يجب أن يصل إلى سياق Cloud Build ثم يُنسخ إلى الصورة.
COPY src/server/encyclopedia-videos.mjs /app/src/server/encyclopedia-videos.mjs
COPY src/data.ts /app/src/data.ts
COPY src/data-curated.ts /app/src/data-curated.ts
COPY src/data/bodies.json /app/src/data/bodies.json
COPY src/data/audio.json /app/src/data/audio.json
# معجم المجال (٢٩٠ مفهوماً/١٣٢٢ اسماً): به يفهم البوت المعنى لا اللفظ.
# قاعدة الدار: كل COPY جديد يقابله سطر سماح في .gcloudignore وإلا فشل البناء.
COPY src/data/dr-ahmad-domain-glossary.json /app/src/data/dr-ahmad-domain-glossary.json
COPY src/data/audio-meta.json /app/src/data/audio-meta.json
COPY src/data/podcast-admin.json /app/src/data/podcast-admin.json
COPY src/data/research-papers.ts /app/src/data/research-papers.ts
COPY src/data/book-quotes.json /app/src/data/book-quotes.json
COPY src/data/book-passages.json /app/src/data/book-passages.json
# فهرس الموسوعة الكامل المستخرج من PDF؛ تحتاجه مطابقة فيديوهات الأبواب الخمسة.
COPY src/data/encyclopedia-structure.json /app/src/data/encyclopedia-structure.json
# تلميحات العروض الأربعة تُدمج مع فهرس PDF ولا تستبدله.
COPY src/data/encyclopedia-teaching-map.json /app/src/data/encyclopedia-teaching-map.json
# الفهرس الزمني المبني مسبقاً هو قلب البحث داخل لحظة الفيديو؛ غيابه يجعل
# الاستيراد المحلي في encyclopedia-videos.mjs يسقط صورة dr-api عند البناء.
COPY src/data/encyclopedia-video-transcripts.json /app/src/data/encyclopedia-video-transcripts.json
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
COPY whatsapp-agent/domain-concepts.mjs /app/whatsapp-agent/domain-concepts.mjs
# «ما قاله الدكتور بصوته»: intent-engine يستورده استيراداً ساكناً، فغيابه أسقط
# بناء الصورة كلها (حارس شجرة الاستيراد أدناه أمسكه). وفهرسه JSON يُبنى قبل هذه
# الخطوة في وظيفة النشر نفسها، فينسخ ممتلئاً لا فارغاً.
COPY whatsapp-agent/spoken-index.mjs /app/whatsapp-agent/spoken-index.mjs
COPY whatsapp-agent/book-quotes.mjs /app/whatsapp-agent/book-quotes.mjs
COPY src/data/spoken-index.json /app/src/data/spoken-index.json

# «node --check» يقرأ الصياغة ولا يحلّ استيراداً: ملفٌ منسيٌّ في النسخ يمرّ من
# هنا ثم يقتل المُشغَّل في Cloud Run. نحلّ شجرة الاستيراد كلها في البناء نفسه،
# فيسقط البناء هنا لا الموقع هناك. ولا نُشغّل الخادم — نحلّ فقط بلا تنفيذ.
RUN node -e "const {readFileSync,existsSync}=require('fs');const {dirname,resolve}=require('path');const seen=new Set();const walk=(f)=>{if(seen.has(f))return;seen.add(f);if(!existsSync(f)){console.error('استيراد مفقود من الصورة: '+f);process.exit(1)}if(!/\\.(mjs|js)$/.test(f))return;const src=readFileSync(f,'utf8');for(const m of src.matchAll(/from\\s+['\\\"](\\.[^'\\\"]+)['\\\"]/g))walk(resolve(dirname(f),m[1]))};walk('/app/server.mjs');console.log('✓ شجرة استيراد الخادم كاملة داخل الصورة: '+seen.size+' ملفاً')"

RUN node --check /app/whatsapp-agent/intent-engine.mjs \
 && node --check /app/server.mjs \
 && node --check /app/scripts/daily-radar.mjs \
 && node --check /app/scripts/editorial-policy.mjs \
 && node --check /app/src/server/whatsapp-controller.mjs \
 && node --check /app/src/server/admin-communications.mjs \
 && node --check /app/src/server/encyclopedia-videos.mjs

EXPOSE 8080
CMD ["node", "/app/server.mjs"]
