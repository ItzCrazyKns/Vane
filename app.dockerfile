FROM node:24.5.0-slim AS builder

RUN apt-get update && apt-get install -y python3 python3-pip sqlite3 && rm -rf /var/lib/apt/lists/*

WORKDIR /home/perplexica

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

COPY tsconfig.json next.config.mjs next-env.d.ts postcss.config.js drizzle.config.ts tailwind.config.ts ./
COPY src ./src
COPY public ./public
COPY drizzle ./drizzle

RUN mkdir -p /home/perplexica/data
RUN yarn build

RUN yarn add --dev @vercel/ncc
RUN yarn ncc build ./src/lib/db/migrate.ts -o migrator

FROM node:24.5.0-slim

RUN apt-get update && apt-get install -y python3 python3-pip sqlite3 && rm -rf /var/lib/apt/lists/*

WORKDIR /home/perplexica

COPY --from=builder /home/perplexica/public ./public
COPY --from=builder /home/perplexica/.next/static ./public/_next/static

COPY --from=builder /home/perplexica/.next/standalone ./
COPY --from=builder /home/perplexica/data ./data
COPY drizzle ./drizzle
COPY --from=builder /home/perplexica/migrator/build ./build
COPY --from=builder /home/perplexica/migrator/index.js ./migrate.js

RUN mkdir /home/perplexica/uploads

COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
RUN sed -i 's/\r$//' ./entrypoint.sh || true

CMD ["/home/perplexica/entrypoint.sh"]