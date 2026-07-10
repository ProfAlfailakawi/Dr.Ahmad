FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Firebase Hosting يخدم الواجهة والأصول. هذه الحاوية مخصّصة للمسارات الآمنة
# /api/** فقط، لذلك لا نرسل أرشيف الصوت ولا أسرار البيئة إلى Cloud Build.
COPY server.mjs ./server.mjs
RUN mkdir -p dist
EXPOSE 8080
CMD ["node", "server.mjs"]
