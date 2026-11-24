# Portal de Integridad Activa (PIA)
### Comisión Nacional contra la Corrupción (CNC) — Presidencia de la República de Guatemala
**Documentación Técnica de Arquitectura, Instalación, Configuración Inicial y Despliegue (TI)**

---

## 1. Resumen Ejecutivo y Arquitectura Vigente

El **Portal de Integridad Activa (PIA)** es la plataforma oficial del Organismo Ejecutivo de Guatemala orientada a centralizar y transparentar la información pública, canales de denuncia administrativa confidencial, directorio de acceso a la información pública, tableros de rendición de cuentas, gestión de riesgos de corrupción y transparencia vehicular.

### Pila Tecnológica Actual (Tech Stack)
- **Backend Institucional:** **Node.js LTS (18.x / 20.x / 22.x+) ESM** con **Express 4.19** (`server.js` en el puerto `3000`).
- **Frontend:** HTML5 semántico, CSS3 modular con variables institucionales, JavaScript ES Modules nativo sin frameworks pesados de compilación.
- **Capa de Persistencia Híbrida (`db/`):** Convivencia configurable sin cambios de código entre almacenamiento en **JSON** (escrituras atómicas + respaldos rotativos) y **MySQL 8.0+ / MariaDB 10.6+** (`mysql2`, transacciones ACID, consultas parametrizadas `?`, 18 tablas relacionales).
- **Seguridad Criptográfica y Control de Acceso:**
  - Contraseñas derivadas con **PBKDF2-HMAC-SHA512** (10,000 iteraciones y sal aleatoria de 16 bytes) en `PIA_DATA_DIR/users_roles.json`.
  - Tokens de sesión firmados con **HMAC-SHA256** (`pia_sess_*`) y verificación opcional de tokens **Firebase Auth (JWKS RS256)**.
  - Control de concurrencia optimista (**ETag SHA-256** / `If-Match` → HTTP `409 Conflict`).
  - Bitácora de auditoría inmutable (`audit_logs.json`) y bloqueo HTTP `403` para scripts CLI (`/admin/scripts/*`).
- **Configuración Visual Dinámica por Módulo (`/api/ui/:module`):**
  - Métricas dinámicas del Portal principal con carrusel automático cuando hay más de 4 indicadores activos.
  - KPIs configurables por módulo (`auto` o `manual`), galería/carrusel de fondos Hero e imagen de sección *«¿Por qué existe?»* (`/img/wallpaperdirectorio.jpg`), con carga binaria segura (`PNG`/`JPG`/`WEBP`, máx. 5 MB, validación por *magic bytes*) en `/uploads/backgrounds/`.
- **Asistente Ciudadano Lupita:** Integración server-side con `@google/genai` (`GEMINI_API_KEY`) y motor heurístico local de contingencia.

---

## 2. Estructura Actual del Proyecto

```text
/
├── server.js                         # Servidor Express ESM (API REST, Auth, DAL Híbrida, UI Dinámica, IA, Auditoría)
├── package.json                      # Dependencias y comandos (setup:init, setup:check, lint, test, migrate:sql)
├── .env.example                      # Plantilla segura de variables de entorno (Puerto, Sesión, MySQL, Gemini, Firebase)
├── deploy-iis.ps1                    # Instalador automatizado Windows Server + IIS + NTFS ACLs + init_pia_config
├── deploy-linux.sh                   # Instalador automatizado Linux (Ubuntu/Debian/RHEL + systemd + Nginx)
├── web.config                        # Configuración IIS (URL Rewrite + ARR, límite 20 MB, bloqueo de archivos sensibles)
├── test_security_suite.js            # Suite integral de pruebas de seguridad, RBAC, UI dinámica y SQL
├── index.html & data_portal.json     # Portada del Portal PIA y métricas generales dinámicas
│
├── sql/                              # Scripts oficiales de Base de Datos (MySQL 8.0+ / MariaDB 10.6+)
│   ├── 01_schema_mysql.sql           # DDL idempotente con 18 tablas, llaves foráneas e índices
│   └── 02_seed_initial_config.sql    # Semilla idempotente de métricas, KPIs, fondos Hero y banderas iniciales
│
├── db/                               # Capa de Acceso a Datos Híbrida (JSON + SQL)
│   ├── sqlClient.js                  # Pool MySQL2 y manejo transaccional
│   ├── schemaInit.js                 # Verificación e inicialización idempotente (18 tablas + semilla)
│   ├── storageConfig.js              # Gestión de modalidad (json | sql | hybrid) por módulo
│   ├── sqlRepository.js              # CRUD parametrizado y mappers SQL <-> JSON
│   ├── hybridStorage.js              # Enrutador único por módulo
│   └── migrationService.js           # Importación JSON -> SQL y Exportación SQL -> JSON con respaldos
│
├── data/                             # Directorio de datos operativos protegido (configurable con PIA_DATA_DIR)
│   ├── users_roles.json              # Cuentas @cnc.gob.gt con hash PBKDF2/SHA-512 y permisos por módulo
│   ├── storage_config.json           # Modalidad activa (json | sql | hybrid)
│   ├── canales_settings.json         # Banderas públicas de Canales (showProtocolos, showDashboardCnc)
│   ├── modules_ui_config.json        # KPIs, fondos Hero e imagen de sección por módulo
│   ├── audit_logs.json               # Bitácora oficial de auditoría
│   ├── page_visits.json              # Analítica de visitas
│   ├── authorized_operators.example.json # Plantilla de operadores institucionales
│   ├── backups/                      # Respaldos automáticos rotativos (hasta 30 versiones por archivo)
│   └── migration_logs/               # Bitácoras detalladas (.log/.json) de migraciones CLI
│
├── uploads/backgrounds/              # Imágenes de fondo subidas desde /admin/ y validadas por magic bytes
├── docs/                             # Manuales oficiales de instalación y arquitectura
│   ├── GUIA_INSTALACION_WINDOWS_SQL.md
│   └── ARQUITECTURA_V2_Y_MIGRACION_SQL.md
│
├── admin/                            # Panel Administrativo SPA (/admin/)
│   ├── scripts/                      # CLIs administrativos bloqueados por HTTP (403)
│   │   ├── init_pia_config.js        # Inicializador idempotente de directorios, .env, configs JSON y SQL
│   │   └── migrate_json_to_sql.js    # Migración masiva CLI y validación estricta de JSON vs SQL
│   └── js/                           # app.js, crud.js, module-ui-manager.js, user-manager.js, database-manager.js
│
└── Módulos Públicos                  # /canales-por-la-integridad/, /directorio/, /gobierno_en_numeros/, /riesgo/, /vehiculos/
```

---

## 3. Cuentas Institucionales, Roles y Gestión de Usuarios

### Cuentas Base Institucionales Protegidas
El portal inicializa dos cuentas administrativas maestras protegidas contra eliminación no autorizada:

| Usuario (Correo) | Rol Base | Contraseña Inicial | Mecanismo de Seguridad | Estado |
|---|---|---|---|---|
| `deteccionydenuncia@cnc.gob.gt` | Administrador Pleno (`admin`) | `12345` | PBKDF2-HMAC-SHA512 + Sal 16 bytes | Cuenta Base Protegida |
| `apoyogi@cnc.gob.gt` | Administrador Pleno (`admin`) | `12345` | PBKDF2-HMAC-SHA512 + Sal 16 bytes | Cuenta Base Protegida |

> **Recomendación obligatoria en producción:** Cambiar las contraseñas iniciales desde `/admin/` → **Gestión de Usuarios** inmediatamente después de finalizar la instalación.

### Gestión Granular por Módulos
Desde `/admin/` → **Gestión de Usuarios** se pueden crear cuentas `@cnc.gob.gt` con roles `admin` o `data_operator`, asignando acceso granular a:
`canales`, `directorio`, `tableros`, `riesgo`, `vehiculos`, `portal`, `visits`, `chatbot`, `users`, `audit`, `database`, `guide`.

---

## 4. Inicialización Rápida y Comandos Oficiales

1. **Instalar dependencias:**
   ```bash
   npm ci --omit=dev
   ```
2. **Inicializar directorios, `.env` y archivos de configuración operativos (idempotente, no sobrescribe datos existentes):**
   ```bash
   node admin/scripts/init_pia_config.js --generate-secret
   # o mediante npm:
   npm run setup:init
   ```
3. **Verificar integridad inicial de configuración y datasets JSON:**
   ```bash
   npm run setup:check
   ```
4. **Inicializar MySQL/MariaDB (opcional, si usará modalidad `sql` o `hybrid`):**
   ```bash
   mysql -u pia_app_user -p < sql/01_schema_mysql.sql
   mysql -u pia_app_user -p < sql/02_seed_initial_config.sql
   # O en un solo paso junto con la carga masiva de los JSON:
   node admin/scripts/migrate_json_to_sql.js --init-schema --include-portal
   ```
5. **Iniciar el servidor y validar seguridad:**
   ```bash
   npm start
   npm run lint
   npm test
   ```

---

## 5. Despliegue en Servidores Institucionales

### Opción A: Windows Server con IIS + ARR (Recomendado en entorno Microsoft)
1. Ejecutar PowerShell **como Administrador** en la ruta del proyecto (`C:\inetpub\wwwroot\PIA`):
   ```powershell
   .\deploy-iis.ps1
   # Si MySQL/MariaDB ya está configurado en .env y desea crear las 18 tablas automáticamente:
   .\deploy-iis.ps1 -InitSql
   ```
2. El script valida Node.js >= 18, crea `C:\PIA_Data` (`backups`, `migration_logs`) y `uploads\backgrounds` con ACLs NTFS restringidas, genera `.env` y `PIA_SESSION_SECRET`, ejecuta `init_pia_config.js`, configura el AppPool `PiaAppPool` y valida los endpoints de salud.
3. En IIS → nodo del servidor → *Application Request Routing Cache* → *Server Proxy Settings*: habilitar **Enable proxy**. El archivo `web.config` enruta `/api/*`, `/admin/*`, `/uploads/backgrounds/*` y los JSON híbridos hacia `http://127.0.0.1:3000`, permitiendo cargas de imágenes de hasta 20 MB y bloqueando `.env`, `.sql`, `.ps1`, `.sh`, `data/`, `db/`, `sql/`, `docs/` y `admin/scripts/`.
4. Registrar el servicio permanente con **PM2** o **NSSM**.

### Opción B: Linux Server (Ubuntu / Debian / RHEL) con Systemd + Nginx
1. Ejecutar el instalador oficial:
   ```bash
   chmod +x deploy-linux.sh
   sudo ./deploy-linux.sh --install-systemd
   # Con inicialización SQL automática:
   sudo ./deploy-linux.sh --install-systemd --init-sql
   ```
2. Configurar Nginx utilizando la plantilla impresa por el script (con `client_max_body_size 20M;` y bloqueo de rutas sensibles) y certificado TLS en el puerto `443`.

### Opción C: Modo Local / Portátil (Solo JSON)
El sistema arranca 100% funcional con `PIA_STORAGE_MODE=json` sin requerir base de datos SQL instalada, sirviendo todos los módulos y configuraciones desde JSON con respaldos atómicos.

---

## 6. Arquitectura Híbrida JSON + SQL (18 Tablas)

El Portal PIA soporta tres modalidades configurables desde `/admin/` → **Almacenamiento y BD** o mediante `.env` (`PIA_STORAGE_MODE`):

1. **`json` (Predeterminada):** Opera con `data_directorio.json`, `data_acceso.json`, `data_tableros.json`, `riesgo/datos.json`, `vehiculos/vehiculos.json`, `data_portal.json` y los JSON de configuración en `PIA_DATA_DIR`.
2. **`sql`:** Persistencia completa en MySQL 8.0+ / MariaDB 10.6+ sobre las **18 tablas** definidas en `sql/01_schema_mysql.sql`.
3. **`hybrid`:** Selección individual (`json` o `sql`) por cada uno de los 6 módulos de datos manteniendo una única fuente autoritativa.

Para el detalle completo de instalación paso a paso y arquitectura, consulte:
- `docs/GUIA_INSTALACION_WINDOWS_SQL.md`
- `docs/ARQUITECTURA_V2_Y_MIGRACION_SQL.md`
