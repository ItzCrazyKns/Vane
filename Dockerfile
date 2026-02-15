FROM node:24.5.0-slim

RUN apt-get update && apt-get install -y python3 python3-pip sqlite3 build-essential curl && rm -rf /var/lib/apt/lists/*

WORKDIR /home/perplexica

# Copy package files first
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Rebuild better-sqlite3 to ensure native module compatibility
RUN npm rebuild better-sqlite3 --build-from-source

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh && sed -i 's/\r$//' entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
