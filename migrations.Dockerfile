FROM node:24-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --ignore-scripts
COPY . .

ENTRYPOINT ["node", "--require", "ts-node/register", "./node_modules/typeorm/cli.js", "-d", "src/dal/db.data-source.ts"]
CMD ["migration:run"]
