# ==============================================================================
# Portal de Integridad Activa (PIA) - Dockerfile de Producción
# Comisión Nacional contra la Corrupción (CNC) - Organismo Ejecutivo de Guatemala
# ==============================================================================

FROM python:3.11-slim AS base

# Configuración del entorno de ejecución de Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=3000 \
    PIA_DATA_DIR=/app/data

# Instalar utilidades básicas de seguridad y red
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Crear usuario y grupo sin privilegios por directrices de hardening institucional
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup --no-create-home appuser

# Instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente y recursos del portal
COPY . .

# Crear directorios de datos persistentes y asignar permisos al usuario de la app
RUN mkdir -p /app/data/backups && \
    chown -R appuser:appgroup /app

# Cambiar a usuario sin privilegios
USER appuser

# Exponer puerto de servicio institucional
EXPOSE 3000

# Verificación de salud del contenedor (Healthcheck)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/chatbot/config || exit 1

# Comando de inicio del servidor WSGI de alta concurrencia
CMD ["gunicorn", "-c", "gunicorn.conf.py", "app:app"]
