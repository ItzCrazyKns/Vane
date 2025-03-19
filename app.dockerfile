FROM node:20.18.0-alpine

WORKDIR /home/perplexica

COPY src /home/perplexica/src
COPY public /home/perplexica/public
COPY package.json /home/perplexica/package.json
COPY yarn.lock /home/perplexica/yarn.lock
COPY tsconfig.json /home/perplexica/tsconfig.json
COPY next.config.mjs /home/perplexica/next.config.mjs
COPY next-env.d.ts /home/perplexica/next-env.d.ts
COPY postcss.config.js /home/perplexica/postcss.config.js
COPY drizzle.config.ts /home/perplexica/drizzle.config.ts
COPY tailwind.config.ts /home/perplexica/tailwind.config.ts

RUN mkdir /home/perplexica/data
RUN mkdir /home/perplexica/uploads

RUN yarn install --frozen-lockfile
RUN yarn build

CMD ["yarn", "start"]