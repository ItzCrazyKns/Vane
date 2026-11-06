FROM node:24.5.0-slim AS builder

RUN apt-get update && apt-get install -y python3 python3-pip sqlite3 && rm -rf /var/lib/apt/lists/*

WORKDIR /home/vane

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

COPY tsconfig.json next.config.mjs next-env.d.ts postcss.config.js drizzle.config.ts tailwind.config.ts ./
COPY src ./src
COPY public ./public
COPY drizzle ./drizzle

RUN mkdir -p /home/vane/data
RUN yarn build

# onnxruntime-node (local Transformers embeddings) ships binaries for every
# OS/arch plus CUDA and TensorRT providers (~330 MB) that need NVIDIA
# libraries this image does not have. Keep only the CPU runtime for the
# architecture being built, which is what Transformers.js loads by default.
RUN set -eu; \
    ort=.next/standalone/node_modules/onnxruntime-node/bin/napi-v3; \
    if [ -d "$ort" ]; then \
      arch="$(node -p process.arch)"; \
      find "$ort" -mindepth 1 -maxdepth 1 ! -name linux -exec rm -rf {} +; \
      find "$ort/linux" -mindepth 1 -maxdepth 1 ! -name "$arch" -exec rm -rf {} +; \
      rm -f "$ort"/linux/*/libonnxruntime_providers_cuda.so \
            "$ort"/linux/*/libonnxruntime_providers_tensorrt.so; \
    fi

FROM node:24.5.0-slim

RUN apt-get update && apt-get install -y \
    python3-dev python3-babel python3-venv python-is-python3 \
    uwsgi uwsgi-plugin-python3 \
    git build-essential libxslt-dev zlib1g-dev libffi-dev libssl-dev \
    curl sudo \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/vane

COPY --from=builder /home/vane/public ./public
COPY --from=builder /home/vane/.next/static ./public/_next/static
# The standalone output already contains the traced node_modules installed
# from yarn.lock in the builder stage. Do not run yarn/npm installs here:
# they would resolve package.json ranges again and swap in a different
# Next.js version than the one used for the build.
COPY --from=builder /home/vane/.next/standalone ./
COPY drizzle ./drizzle

# data/ starts empty: the server creates config.json and db.sqlite on first
# start, so the ones the build left behind are not shipped.
RUN mkdir -p /home/vane/data /home/vane/uploads

RUN useradd --shell /bin/bash --system \
    --home-dir "/usr/local/searxng" \
    --comment 'Privacy-respecting metasearch engine' \
    searxng

RUN mkdir "/usr/local/searxng"
RUN mkdir -p /etc/searxng
RUN chown -R "searxng:searxng" "/usr/local/searxng"

COPY searxng/settings.yml /etc/searxng/settings.yml
COPY searxng/limiter.toml /etc/searxng/limiter.toml
COPY searxng/uwsgi.ini /etc/searxng/uwsgi.ini
RUN chown -R searxng:searxng /etc/searxng

USER searxng

RUN git clone "https://github.com/searxng/searxng" \
                   "/usr/local/searxng/searxng-src"

RUN python3 -m venv "/usr/local/searxng/searx-pyenv"
RUN "/usr/local/searxng/searx-pyenv/bin/pip" install --upgrade pip setuptools wheel pyyaml msgspec typing_extensions
RUN cd "/usr/local/searxng/searxng-src" && \
    "/usr/local/searxng/searx-pyenv/bin/pip" install --use-pep517 --no-build-isolation -e .

USER root

WORKDIR /home/vane
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
RUN sed -i 's/\r$//' ./entrypoint.sh || true

RUN echo "searxng ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

EXPOSE 3000 8080

ENV SEARXNG_API_URL=http://localhost:8080

CMD ["/home/vane/entrypoint.sh"]
