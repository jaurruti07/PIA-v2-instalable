# Portal de Integridad Activa (PIA) - imagen de producción Node.js
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=3000 \
    PIA_DATA_DIR=/var/lib/pia/data

WORKDIR /app

# Instalar dependencias de producción antes de copiar el código.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copiar la aplicación y preparar almacenamiento persistente.
COPY . .
RUN mkdir -p /var/lib/pia/data/backups /app/uploads \
    && chown -R node:node /app /var/lib/pia

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/chatbot/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
