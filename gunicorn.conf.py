# ==============================================================================
# Portal de Integridad Activa (PIA) - Configuración de Producción Gunicorn WSGI
# Comisión Nacional contra la Corrupción (CNC) - Organismo Ejecutivo de Guatemala
# ==============================================================================

import os
import multiprocessing

# Enlace de Red
bind = f"0.0.0.0:{os.environ.get('PORT', '3000')}"

# Concurrencia y Procesos de Trabajo
# Recomendación: (2 x cores) + 1 para servidores dedicados
workers = int(os.environ.get('GUNICORN_WORKERS', '4'))
threads = int(os.environ.get('GUNICORN_THREADS', '2'))
worker_class = 'gthread'
worker_connections = 1000

# Tiempos de Espera
timeout = 120
keepalive = 5
graceful_timeout = 30

# Registro de Bitácoras (Salida estándar para recolección en contenedores/journald)
accesslog = '-'
errorlog = '-'
loglevel = os.environ.get('LOG_LEVEL', 'info')
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" (%(L)ss)'

# Optimización de Rendimiento
preload_app = True
max_requests = 2000
max_requests_jitter = 200
