FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json build.mjs ./
COPY web ./web
COPY server ./server
COPY platform ./platform
COPY .openai ./.openai
RUN node build.mjs
RUN chmod +x platform/entrypoint.sh
EXPOSE 10000
CMD ["sh", "platform/entrypoint.sh"]
