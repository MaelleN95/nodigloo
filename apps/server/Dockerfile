FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace @nodigloo/server --include-workspace-root
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build --workspace @nodigloo/shared && npm run build --workspace @nodigloo/server

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev --workspace @nodigloo/server --include-workspace-root
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/dist apps/server/dist
EXPOSE 3001
CMD ["npm", "run", "start", "--workspace", "@nodigloo/server"]