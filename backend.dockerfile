FROM node:18-slim

WORKDIR /home/perplexica

COPY src /home/perplexica/src
COPY tsconfig.json /home/perplexica/
COPY drizzle.config.ts /home/perplexica/
COPY package.json /home/perplexica/
COPY yarn.lock /home/perplexica/

RUN mkdir /home/perplexica/data

RUN yarn config set registry https://registry.npmjs.org/

RUN yarn install --frozen-lockfile
RUN yarn build

CMD ["yarn", "start"]