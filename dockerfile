FROM node:8.7.0-alpine

RUN apk update && apk upgrade && \
    apk add --no-cache bash python alpine-sdk

WORKDIR /app/

ADD ./package.json ./yarn.lock /app/
RUN yarn

ADD . .

RUN yarn build

CMD ["./scripts/docker-exec.sh"]
