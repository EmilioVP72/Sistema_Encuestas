# Imagen base de Node.js ligera y moderna
FROM node:22-alpine

# Directorio de trabajo
WORKDIR /app

# Definir variables de entorno de producción
ENV NODE_ENV=production
ENV PORT=3000

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar únicamente dependencias de producción
RUN npm ci --omit=dev

# Copiar el código fuente completo
COPY . .

# Crear directorio de datos persistentes con permisos adecuados
RUN mkdir -p /app/data && chown -R node:node /app

# Usar usuario no-root por seguridad
USER node

# Exponer el puerto de la aplicación
EXPOSE 3000

# Healthcheck nativo para verificar el estado del contenedor
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

# Comando de arranque
CMD ["node", "src/server.js"]
