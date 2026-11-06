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

# SearXNG is built in its own stage so compilers, headers and git stay out of
# the final image. Pinned to a commit so rebuilds get the same SearXNG.
FROM node:24.5.0-slim AS searxng-builder

ARG SEARXNG_REPO=https://github.com/searxng/searxng
ARG SEARXNG_COMMIT=ac11e14c5edf995d4d2f066bfb885a614f52a978

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-dev python3-venv \
    git ca-certificates build-essential libxslt-dev zlib1g-dev libffi-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --shell /bin/bash --system \
    --home-dir "/usr/local/searxng" \
    --comment 'Privacy-respecting metasearch engine' \
    searxng
RUN mkdir "/usr/local/searxng" && chown -R "searxng:searxng" "/usr/local/searxng"

USER searxng
ENV PIP_NO_CACHE_DIR=1

RUN git init -q "/usr/local/searxng/searxng-src" && \
    cd "/usr/local/searxng/searxng-src" && \
    git fetch -q --depth 1 "$SEARXNG_REPO" "$SEARXNG_COMMIT" && \
    git checkout -q FETCH_HEAD

RUN python3 -m venv "/usr/local/searxng/searx-pyenv"
RUN "/usr/local/searxng/searx-pyenv/bin/pip" install --upgrade pip setuptools wheel pyyaml msgspec typing_extensions
RUN cd "/usr/local/searxng/searxng-src" && \
    "/usr/local/searxng/searx-pyenv/bin/pip" install --use-pep517 --no-build-isolation -e .
# Record the version in searx/version_frozen.py so SearXNG does not need git
# (or the .git directory) at runtime.
RUN cd "/usr/local/searxng/searxng-src" && \
    "/usr/local/searxng/searx-pyenv/bin/python" -m searx.version freeze && \
    rm -rf .git

FROM node:24.5.0-slim

# Runtime only: python3 runs the SearXNG virtualenv built above; the sqlite3
# CLI stays for inspecting data/db.sqlite.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 ca-certificates sqlite3 \
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

COPY --from=searxng-builder --chown=searxng:searxng /usr/local/searxng /usr/local/searxng

RUN mkdir -p /etc/searxng && chown searxng:searxng /etc/searxng

COPY --chown=searxng:searxng searxng/settings.yml /etc/searxng/settings.yml
COPY --chown=searxng:searxng searxng/limiter.toml /etc/searxng/limiter.toml
COPY --chown=searxng:searxng searxng/uwsgi.ini /etc/searxng/uwsgi.ini

WORKDIR /home/vane
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
RUN sed -i 's/\r$//' ./entrypoint.sh || true

EXPOSE 3000 8080

ENV SEARXNG_API_URL=http://localhost:8080

CMD ["/home/vane/entrypoint.sh"]
