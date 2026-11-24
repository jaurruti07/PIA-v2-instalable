#!/usr/bin/env bash
# ==============================================================================
# Portal de Integridad Activa (PIA) - Comisión Nacional contra la Corrupción
# Instalador Automatizado e Idempotente para Servidores Linux (Ubuntu/Debian/RHEL)
# ==============================================================================

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="/var/lib/pia/data"
SERVICE_USER="www-data"
PORT="3000"
INIT_SQL="false"
INSTALL_SYSTEMD="false"
SERVER_NAME="pia.cnc.gob.gt"

usage() {
  cat <<EOF
Uso: sudo ./deploy-linux.sh [opciones]

Opciones:
  --app-dir=RUTA       Directorio del proyecto (por defecto: directorio actual)
  --data-dir=RUTA      Directorio aislado de datos/respaldos (por defecto: /var/lib/pia/data)
  --user=USUARIO       Usuario del sistema para el servicio (por defecto: www-data)
  --port=PUERTO        Puerto interno Node.js (por defecto: 3000)
  --server-name=DOM    Dominio para plantilla Nginx (por defecto: pia.cnc.gob.gt)
  --init-sql           Inicializa también las 18 tablas y semilla inicial MySQL/MariaDB
  --install-systemd    Crea/actualiza /etc/systemd/system/pia.service y habilita el servicio
  -h, --help           Muestra esta ayuda
EOF
}

for arg in "$@"; do
  case "$arg" in
    --app-dir=*) APP_DIR="${arg#*=}" ;;
    --data-dir=*) DATA_DIR="${arg#*=}" ;;
    --user=*) SERVICE_USER="${arg#*=}" ;;
    --port=*) PORT="${arg#*=}" ;;
    --server-name=*) SERVER_NAME="${arg#*=}" ;;
    --init-sql) INIT_SQL="true" ;;
    --install-systemd) INSTALL_SYSTEMD="true" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "[ERROR] Opción desconocida: $arg" >&2; usage; exit 1 ;;
  esac
done

echo ""
echo "[PIA LINUX INSTALLER] 1. Verificando prerequisitos (Node.js >= 18 y npm)..."
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js no está instalado. Instale Node.js LTS (>= 18.x)." >&2
  exit 1
fi

NODE_RAW="$(node -v)"
NODE_MAJOR="$(echo "${NODE_RAW#v}" | cut -d'.' -f1)"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "[ERROR] Se requiere Node.js >= 18.x (detectado: $NODE_RAW)." >&2
  exit 1
fi
echo "  [OK] Node.js $NODE_RAW | npm $(npm -v)"

echo ""
echo "[PIA LINUX INSTALLER] 2. Preparando directorios protegidos y permisos..."
mkdir -p "$DATA_DIR/backups" "$DATA_DIR/migration_logs" "$APP_DIR/uploads/backgrounds"

if id "$SERVICE_USER" >/dev/null 2>&1; then
  chown -R "$SERVICE_USER":"$SERVICE_USER" "$DATA_DIR" "$APP_DIR/uploads/backgrounds"
  chmod 750 "$DATA_DIR" "$DATA_DIR/backups" "$DATA_DIR/migration_logs"
  chmod 755 "$APP_DIR/uploads" "$APP_DIR/uploads/backgrounds"
  echo "  [OK] Permisos asignados al usuario '$SERVICE_USER'."
else
  chmod 750 "$DATA_DIR" "$DATA_DIR/backups" "$DATA_DIR/migration_logs"
  echo "  [ALERTA] Usuario '$SERVICE_USER' no existe en el sistema; se conservaron permisos locales."
fi

echo ""
echo "[PIA LINUX INSTALLER] 3. Instalando dependencias de producción..."
cd "$APP_DIR"
if [ -f "package-lock.json" ]; then
  npm ci --omit=dev --no-audit --no-fund
else
  npm install --omit=dev --no-audit --no-fund
fi
echo "  [OK] Dependencias instaladas."

echo ""
echo "[PIA LINUX INSTALLER] 4. Inicializando .env, configuración JSON operativa y datasets..."
INIT_FLAGS=(admin/scripts/init_pia_config.js "--data-dir=$DATA_DIR" --generate-secret)
if [ "$INIT_SQL" = "true" ]; then
  INIT_FLAGS+=(--init-sql)
fi
node "${INIT_FLAGS[@]}"

if [ -f "$APP_DIR/.env" ]; then
  chmod 600 "$APP_DIR/.env"
  if id "$SERVICE_USER" >/dev/null 2>&1; then
    chown "$SERVICE_USER":"$SERVICE_USER" "$APP_DIR/.env"
  fi
fi

if [ "$INSTALL_SYSTEMD" = "true" ] && [ "$(id -u)" -eq 0 ]; then
  echo ""
  echo "[PIA LINUX INSTALLER] 5. Configurando servicio systemd (/etc/systemd/system/pia.service)..."
  NODE_BIN="$(command -v node)"
  cat >/etc/systemd/system/pia.service <<EOF
[Unit]
Description=Portal de Integridad Activa (PIA) - CNC
After=network.target mysql.service mariadb.service

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
Environment=NODE_ENV=production
ExecStart=${NODE_BIN} ${APP_DIR}/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now pia
  echo "  [OK] Servicio systemd 'pia' habilitado e iniciado."
fi

echo ""
echo "[PIA LINUX INSTALLER] 6. Plantilla Nginx recomendada (/etc/nginx/sites-available/pia):"
cat <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};
    client_max_body_size 20M;

    location ~* \.(env|sql|bak|tmp|ps1|sh)$ { deny all; return 404; }
    location ^~ /data/ { deny all; return 404; }
    location ^~ /db/ { deny all; return 404; }
    location ^~ /sql/ { deny all; return 404; }
    location ^~ /admin/scripts/ { deny all; return 403; }

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

echo ""
echo "[PIA LINUX INSTALLER] 7. Verificando endpoints locales (si el servicio ya está corriendo)..."
node -e "
  (async () => {
    try {
      const m = await (await fetch('http://127.0.0.1:${PORT}/api/modules')).json();
      const u = await (await fetch('http://127.0.0.1:${PORT}/api/ui/portal')).json();
      console.log('  [OK] API respondiendo: ' + (m.length || 0) + ' módulos, ' + (u.kpis?.length || 0) + ' KPIs portal.');
    } catch (e) {
      console.log('  [INFO] Servicio inactivo en puerto ${PORT}. Inicie con: npm start o systemctl start pia');
    }
  })();
"
echo ""
echo "=================================================================="
echo " INSTALACIÓN LINUX PIA COMPLETADA"
echo " Verificar siempre con: npm run setup:check && npm test"
echo "=================================================================="
