FROM node:12-alpine

WORKDIR /base

COPY ./services/package*.json ./services/
COPY ./app/package*.json ./app/

RUN cd services && npm install --silent
RUN cd app && npm install --silent

COPY ./services ./services
COPY ./app ./app

RUN cd services && npm run build
RUN cd app && npm run build

COPY ./app/build ./services/public

CMD [ "npm", "run", "prod" ]
