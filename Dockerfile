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

FROM node:24.5.0-slim

RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    sqlite3 \
    git \
    build-essential \
    libxslt-dev \
    zlib1g-dev \
    libffi-dev \
    libssl-dev \
    uwsgi \
    uwsgi-plugin-python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/perplexica

COPY --from=builder /home/perplexica/public ./public
COPY --from=builder /home/perplexica/.next/static ./public/_next/static
COPY --from=builder /home/perplexica/.next/standalone ./
COPY --from=builder /home/perplexica/data ./data
COPY drizzle ./drizzle

RUN mkdir /home/perplexica/uploads

RUN useradd --system --home-dir /usr/local/searxng --shell /bin/sh searxng

WORKDIR /usr/local/searxng
RUN git clone https://github.com/searxng/searxng.git . && \
    python3 -m venv venv && \
    . venv/bin/activate && \
    pip install --upgrade pip setuptools wheel pyyaml && \
    pip install -r requirements.txt && \
    pip install uwsgi

RUN mkdir -p /etc/searxng
COPY searxng/settings.yml /etc/searxng/settings.yml
COPY searxng/limiter.toml /etc/searxng/limiter.toml
COPY searxng/uwsgi.ini /etc/searxng/uwsgi.ini

RUN chown -R searxng:searxng /usr/local/searxng /etc/searxng

WORKDIR /home/perplexica
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
RUN sed -i 's/\r$//' ./entrypoint.sh || true

EXPOSE 3000 8080

ENV SEARXNG_API_URL=http://localhost:8080

CMD ["/home/perplexica/entrypoint.sh"]
