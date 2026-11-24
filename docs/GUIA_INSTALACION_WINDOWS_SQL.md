# Guía Institucional de Instalación y Configuración Híbrida (JSON + MySQL/MariaDB)
## Portal de Integridad Activa (PIA) — Windows Server / Linux + Node.js

---

## 1. Arquitectura de Almacenamiento Soportada

El Portal de Integridad Activa (PIA) implementa una capa de acceso a datos híbrida que permite operar sin modificaciones en el código fuente bajo tres modalidades:

| Modalidad | Descripción | Cuándo utilizarla |
|---|---|---|
| **A. `json` (Predeterminada)** | Todos los módulos leen y escriben sobre los archivos JSON originales en disco con escrituras atómicas, control `ETag` y respaldos automáticos en `PIA_DATA_DIR/backups/`. | Instalación rápida, operación sin motor SQL o entornos portables. |
| **B. `sql`** | Todos los módulos leen y escriben en tablas relacionales **MySQL 8.0+ / MariaDB 10.6+** mediante transacciones ACID y consultas parametrizadas. | Infraestructura institucional con base de datos centralizada. |
| **C. `hybrid`** | Permite seleccionar individualmente qué módulos utilizan **JSON** y cuáles **SQL**. Cada módulo tiene **una única fuente autoritativa** para evitar inconsistencias. | Migración gradual por etapas o convivencia institucional controlada. |

> **Compatibilidad garantizada:** Las páginas públicas (`/`, `/canales-por-la-integridad/`, `/directorio/`, `/gobierno_en_numeros/`, `/riesgo/`, `/vehiculos/`) consumen las APIs dinámicas (`/api/:module`, `/api/ui/:module`, `/api/canales/config`, `/api/portal/metricas`) y las rutas JSON compatibles sin requerir cambios al conmutar entre JSON y SQL.

---

## 2. Requisitos del Servidor

1. **Sistema Operativo:**
   - **Windows Server 2019 / 2022** (con IIS), o
   - **Linux** (Ubuntu 22.04+, Debian 12+, RHEL/Rocky 8/9 con Nginx y Systemd).
2. **Node.js:** Versión **LTS 18.x, 20.x o 22.x+** (`node -v`, `npm -v`) ejecutando `server.js` en modo ESM.
3. **Motor SQL (Opcional para modalidades `sql` o `hybrid`):**
   - **MySQL Server 8.0+** o **MariaDB Server 10.6+** con motor `InnoDB` y juego de caracteres `utf8mb4_unicode_ci`.
4. **Servidor Web / Reverse Proxy (Producción):**
   - En Windows: **IIS** con módulos **URL Rewrite 2.1** y **Application Request Routing (ARR 3.0)** (`web.config` incluido), junto con **PM2** o **NSSM**.
   - En Linux: **Nginx** + **Systemd** (`deploy-linux.sh` incluido).

---

## 3. Procedimiento de Instalación Paso a Paso

### Paso 1: Ubicar el Proyecto, Instalar Dependencias e Inicializar Configuración
Copiar o clonar el proyecto en la ruta institucional (`C:\inetpub\wwwroot\PIA` en Windows o `/var/www/pia` en Linux):

- **Opción automatizada en Windows Server (PowerShell como Administrador):**
  ```powershell
  cd C:\inetpub\wwwroot\PIA
  .\deploy-iis.ps1
  # Opcional: añadir -InitSql si MySQL/MariaDB ya está configurado en .env
  ```
- **Opción manual / paso a paso:**
  ```powershell
  cd C:\inetpub\wwwroot\PIA
  npm ci --omit=dev
  node admin/scripts/init_pia_config.js --data-dir=C:\PIA_Data --generate-secret
  ```
  El script `init_pia_config.js`:
  - Crea `PIA_DATA_DIR`, `backups/`, `migration_logs/` y `uploads/backgrounds/`.
  - Genera `.env` desde `.env.example` (si no existe) y crea una llave `PIA_SESSION_SECRET` criptográfica de 96 caracteres hexadecimales.
  - Inicializa de forma **no destructiva** (sin sobrescribir archivos existentes) `users_roles.json`, `storage_config.json`, `canales_settings.json`, `modules_ui_config.json`, `page_visits.json`, `audit_logs.json` y `authorized_operators.json`.
  - Valida todos los archivos JSON de los módulos del portal.

### Paso 2: Verificar y Completar `.env` (Solo Backend)
Revise el archivo `.env` en la raíz del proyecto (este archivo **nunca** debe publicarse ni exponerse en el navegador):

```env
PORT=3000
NODE_ENV=production
PIA_SESSION_SECRET=<LLAVE_HEX_GENERADA_96_CARACTERES>
PIA_DATA_DIR=C:\PIA_Data

# Modalidad inicial: json | sql | hybrid
PIA_STORAGE_MODE=json
PIA_SQL_MODULES=

# Parámetros MySQL / MariaDB (solo backend, nunca expuestos al frontend)
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=pia_app_user
MYSQL_PASSWORD=CONTRASEÑA_SEGURA_AQUI
MYSQL_DATABASE=pia_db
MYSQL_SSL=false
MYSQL_CONNECTION_LIMIT=10

# Opcional: API Key Gemini para Asistente Virtual Lupita
GEMINI_API_KEY=
```

### Paso 3: Crear Base de Datos y Usuario SQL con Privilegios Mínimos
En MySQL/MariaDB (como `root` o DBA):

```sql
CREATE DATABASE IF NOT EXISTS `pia_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'pia_app_user'@'localhost' IDENTIFIED BY 'CONTRASEÑA_SEGURA_AQUI';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER
  ON `pia_db`.* TO 'pia_app_user'@'localhost';
FLUSH PRIVILEGES;
```

### Paso 4: Crear las 18 Tablas SQL y Semilla de Configuración Inicial
Puede realizarse de **dos maneras equivalentes**:

- **Opción A (Consola MySQL / CLI):**
  ```powershell
  mysql -u pia_app_user -p < sql\01_schema_mysql.sql
  mysql -u pia_app_user -p < sql\02_seed_initial_config.sql
  ```
- **Opción B (Desde el Panel Administrativo `/admin/` o Script `init_pia_config.js --init-sql`):**
  1. Inicie el servidor (`node server.js`).
  2. Ingrese a `http://localhost:3000/admin/` con su cuenta `@cnc.gob.gt`.
  3. Vaya a **Almacenamiento y BD** → pestaña **Almacenamiento Híbrido y SQL**.
  4. Haga clic en **Probar Conexión SQL** y luego en **Inicializar / Verificar Tablas SQL** (ejecuta idempotente `01_schema_mysql.sql` + `02_seed_initial_config.sql`).

---

## 4. Tablas Relacionales Generadas (18 Tablas Oficiales)

### A. Tablas de Módulos Ciudadanos y Métricas (`sql/01_schema_mysql.sql`)
1. `pia_canales_integridad` ← `canales-por-la-integridad/data_directorio.json`
2. `pia_directorio_acceso` + `pia_directorio_enlaces` (FK `ON DELETE CASCADE`) ← `directorio/data_acceso.json`
3. `pia_tableros_gobierno` ← `gobierno_en_numeros/data_tableros.json`
4. `pia_riesgo_ciclos` + `pia_riesgo_instituciones` (FK `ON DELETE CASCADE`) + `pia_riesgo_frecuentes` ← `riesgo/datos.json`
5. `pia_vehiculos_instituciones` + `pia_vehiculos_institucion_criterios` + `pia_vehiculos_institucion_documentos` + `pia_vehiculos` + `pia_vehiculos_historial` (FK `ON DELETE CASCADE`) ← `vehiculos/vehiculos.json`
6. `pia_portal_metricas` (incluye columna `metricas_json` para métricas dinámicas e íconos del carrusel) ← `data_portal.json`
7. `pia_storage_migrations` ← Bitácora técnica de importaciones y exportaciones JSON ↔ SQL.

### B. Tablas de Configuración Inicial, KPIs y Fondos Dinámicos (`sql/01_schema_mysql.sql` + `sql/02_seed_initial_config.sql`)
8. `pia_canales_config` ← `data/canales_settings.json` (`showProtocolos`, `showDashboardCnc`).
9. `pia_modules_ui_kpis` ← `data/modules_ui_config.json` (KPIs configurables por módulo con modo `auto`/`manual`, texto inferior e ícono).
10. `pia_modules_ui_backgrounds` ← `data/modules_ui_config.json` (Carrusel de fondos Hero del Portal y los 5 sub-módulos).
11. `pia_modules_ui_section_images` ← `data/modules_ui_config.json` (Imagen de sección *«¿Por qué existe?»* del Portal = `/img/wallpaperdirectorio.jpg`).

---

## 5. Migración Inicial de los Archivos JSON a SQL

### Opción A: Desde el Panel Administrativo (`/admin/`)
1. En `/admin/` → **Almacenamiento y BD** → **Almacenamiento Híbrido y SQL**, verifique que las **18 tablas** aparezcan con estado **Verificada**.
2. Haga clic en **Importar JSON → SQL**, elija política (`skip` o `overwrite` con autorización y respaldo previo) y ejecute.
3. En **Modalidad de Convivencia**, seleccione `Solo SQL` o `Híbrido` y presione **Aplicar Configuración**.

### Opción B: Script CLI de Inserción Masiva (`admin/scripts/migrate_json_to_sql.js`)
```powershell
# 1. Simular y validar los JSON contra el esquema SQL sin escribir en BD:
npm run migrate:sql:dry-run

# 2. Inicializar las 18 tablas + semilla e importar los 5 JSON + métricas del portal:
node admin/scripts/migrate_json_to_sql.js --init-schema --include-portal
```

---

## 6. Ejecución Permanente en Windows Server con Node.js

### Opción 1: PM2 como Servicio Windows
```powershell
npm install -g pm2 pm2-windows-service
pm2-service-install -n PIA_Portal
pm2 start server.js --name pia-backend --env production
pm2 save
```

### Opción 2: NSSM (Non-Sucking Service Manager)
```powershell
nssm install PIA_Service "C:\Program Files\nodejs\node.exe" "C:\inetpub\wwwroot\PIA\server.js"
nssm set PIA_Service AppDirectory "C:\inetpub\wwwroot\PIA"
nssm start PIA_Service
```

---

## 7. Verificación de Requisitos, Conexión y Seguridad

```powershell
npm run setup:check
npm run lint
npm test
```

Checklist rápido tras instalar:
- [ ] `GET http://127.0.0.1:3000/api/modules` y `GET http://127.0.0.1:3000/api/ui/portal` responden HTTP `200 OK`.
- [ ] El módulo **Almacenamiento y BD** en `/admin/` muestra las **18 tablas** y conexión SQL (si fue habilitada).
- [ ] Subida y selección de fondos dinámicos y KPIs en `/admin/` funciona y valida rutas bajo `/uploads/backgrounds/`.
- [ ] Scripts en `/admin/scripts/*` y rutas internas (`db/`, `sql/`, `data/`, `.env`) permanecen bloqueados vía HTTP.
- [ ] Las operaciones mutativas generan respaldo en `PIA_DATA_DIR/backups` y registro en `audit_logs.json`.

---

## 8. Configuración de IIS (URL Rewrite + ARR) y HTTPS/SSL

1. Instale **Microsoft URL Rewrite 2.1** y **Application Request Routing (ARR 3.0)**.
2. En **Administrador de IIS** → nodo raíz del servidor → **Application Request Routing Cache** → **Server Proxy Settings...** → marque **Enable proxy**.
3. Apunte el sitio a `C:\inetpub\wwwroot\PIA` (donde reside `web.config`), que:
   - Enruta `/api/*`, `/admin/*`, `/uploads/backgrounds/*` y los JSON híbridos hacia `http://127.0.0.1:3000`.
   - Permite cargas de hasta **20 MB** (`maxAllowedContentLength="20971520"`) para imágenes de fondo Base64 validados en backend.
   - Bloquea HTTP hacia `.env`, `.sql`, `.bak`, `.ps1`, `.sh`, `data/`, `db/`, `sql/`, `docs/` y `admin/scripts/`.
4. Instale el certificado TLS/SSL en el enlace HTTPS (`443`) y descomente `Redirect to HTTPS` en `web.config`.

---

## 9. Seguridad de Red, Llave de Sesión y Credenciales Iniciales

- **Generar `PIA_SESSION_SECRET` criptográficamente seguro:**
  ```powershell
  node admin/scripts/init_pia_config.js --generate-secret
  ```
- **Reglas de Firewall recomendadas:**
  - Abrir al exterior únicamente `80/TCP` (redirección HTTPS) y `443/TCP` (HTTPS).
  - Bloquear acceso externo a `3000/TCP` (Node.js interno) y `3306/TCP` (MySQL/MariaDB).
- **Cambio de contraseñas iniciales:** Al ingresar por primera vez a `/admin/` → **Gestión de Usuarios**, actualice las contraseñas iniciales de `deteccionydenuncia@cnc.gob.gt` y `apoyogi@cnc.gob.gt`.

---

## 10. Instalación Automatizada en Servidores Linux (Ubuntu / Debian / RHEL)

Utilice el instalador oficial `deploy-linux.sh`:

```bash
chmod +x deploy-linux.sh
sudo ./deploy-linux.sh --install-systemd
# Con inicialización automática de tablas SQL:
sudo ./deploy-linux.sh --install-systemd --init-sql
```

Plantilla Nginx recomendada (`/etc/nginx/sites-available/pia`):

```nginx
server {
    listen 80;
    server_name pia.cnc.gob.gt;
    client_max_body_size 20M;

    location ~* \.(env|sql|bak|tmp|ps1|sh)$ { deny all; return 404; }
    location ^~ /data/ { deny all; return 404; }
    location ^~ /db/ { deny all; return 404; }
    location ^~ /sql/ { deny all; return 404; }
    location ^~ /admin/scripts/ { deny all; return 403; }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 11. Respaldos Programados y Restauración

- **Respaldo de MySQL/MariaDB (`mysqldump`):**
  ```powershell
  $fecha = Get-Date -Format "yyyyMMdd_HHmm"
  mysqldump -u pia_app_user -p --single-transaction --routines --triggers pia_db > "C:\PIA_Backups\pia_db_$fecha.sql"
  ```
- **Restauración de emergencia desde respaldo SQL:**
  ```powershell
  mysql -u pia_app_user -p pia_db < C:\PIA_Backups\pia_db_20261118_0200.sql
  ```
- **Respaldo integral JSON, Fondos y Bitácoras:** Respaldar periódicamente `PIA_DATA_DIR` (`C:\PIA_Data` o `/var/lib/pia/data`), `uploads/backgrounds/` y los JSON base de los módulos.
