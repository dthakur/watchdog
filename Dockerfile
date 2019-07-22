FROM node:12-alpine

WORKDIR /base

COPY ./services/package*.json ./services/
COPY ./app/package*.json ./app/

RUN cd services && npm install --silent
RUN cd app && npm install --silent

COPY ./services ./services
COPY ./app ./app

RUN cd services && npm run build
RUN cd app && npm run build && cp -r ./build ../services/public

WORKDIR /base/services
CMD [ "npm", "run", "prod" ]
