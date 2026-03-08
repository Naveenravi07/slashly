FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY yarn.lock* ./

RUN npm install

COPY . .

RUN npm run build
RUN npx prisma generate

EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
