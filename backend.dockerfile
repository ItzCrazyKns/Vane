FROM node:alpine

ARG SEARXNG_API_URL
ENV SEARXNG_API_URL=${SEARXNG_API_URL}

WORKDIR /home/perplexica

COPY src /home/perplexica/src
COPY tsconfig.json /home/perplexica/
COPY .env /home/perplexica/
COPY package.json /home/perplexica/
COPY yarn.lock /home/perplexica/

RUN yarn install
RUN yarn build

CMD ["yarn", "start"]