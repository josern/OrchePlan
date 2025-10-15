FROM node:18-bullseye

WORKDIR /usr/src/app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci --only=production || npm install

# Copy source
COPY . .

# Generate prisma client
RUN npx prisma generate || true

EXPOSE 3000

CMD ["/bin/bash","-c","npx prisma migrate deploy || true && npm run start-local"]
