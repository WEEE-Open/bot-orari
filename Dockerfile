FROM node:latest

WORKDIR /usr/src

COPY package.json ./

RUN npm i --prefix /usr/src/

WORKDIR /usr/src/app

COPY . .

ENV NODE_PATH=/usr/src/node_modules

CMD  ["npm", "run", "start"]