FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY prisma ./prisma
ARG PRISMA_SCHEMA=prisma/schema.prisma
ENV PRISMA_SCHEMA=${PRISMA_SCHEMA}
RUN npx prisma generate --schema ${PRISMA_SCHEMA}

COPY src ./src
COPY scripts ./scripts
COPY .env.example ./.env.example

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://localhost:5000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npm", "run", "start"]
