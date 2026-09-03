# Built from the monorepo root: docker build -f services/core-api/Dockerfile .
FROM node:20-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/validation/package.json packages/validation/
COPY services/core-api/package.json services/core-api/
RUN pnpm install --frozen-lockfile --filter @nexora/core-api...

FROM deps AS build
COPY packages/config packages/config
COPY packages/types packages/types
COPY packages/validation packages/validation
COPY services/core-api services/core-api
RUN pnpm --filter @nexora/core-api prisma:generate
RUN pnpm --filter @nexora/core-api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/services/core-api/dist services/core-api/dist
COPY --from=build /repo/services/core-api/node_modules services/core-api/node_modules
COPY --from=build /repo/services/core-api/prisma services/core-api/prisma
COPY --from=build /repo/node_modules node_modules
EXPOSE 4000
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy --schema services/core-api/prisma/schema.prisma && node services/core-api/dist/main.js"]
