FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package.json ./
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/boot.js"]
