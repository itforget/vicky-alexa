FROM node:22-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY tsconfig.json ./
COPY src ./src
RUN npm install --no-save typescript@5.7.2 @types/node@22.10.2 @types/express@5.0.0 && npm run build && npm prune --omit=dev
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/server.js"]
