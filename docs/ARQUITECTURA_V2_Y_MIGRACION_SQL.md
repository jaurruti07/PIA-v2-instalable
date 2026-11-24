# ARQUITECTURA TÉCNICA DEL PORTAL DE INTEGRIDAD ACTIVA (PIA)
## ARQUITECTURA FUNCIONAL VIGENTE Y PERSISTENCIA HÍBRIDA (JSON + MYSQL / MARIADB)
### Gobierno de Guatemala — Comisión Nacional contra la Corrupción (CNC)

---

## 1. VISIÓN GENERAL DE LA ARQUITECTURA EN PRODUCCIÓN

El **Portal de Integridad Activa (PIA)** opera bajo una arquitectura desacoplada en **Node.js LTS (18–22+) ESM + Express 4.19** con capa de acceso a datos híbrida (**JSON + MySQL 8.0+ / MariaDB 10.6+**), autenticación criptográfica institucional, personalización visual dinámica de módulos y asistente virtual **Lupita** impulsado por `@google/genai`.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                           CAPA 1: PRESENTACIÓN                             │
│  - Portales Públicos (/, canales, directorio, tableros, riesgo, vehiculos) │
│  - Panel Administrativo SPA (/admin/) con CRUD ETag, KPIs y Fondos Hero    │
│  - Asistente Virtual Lupita (Widget público + RAG local/Gemini)            │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │ HTTP / JSON + ETag + Bearer Token
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   CAPA 2: SERVICIOS, SEGURIDAD Y API REST                  │
│  - Express ESM (server.js en 127.0.0.1:3000 detrás de IIS ARR o Nginx)     │
│  - Autenticación PBKDF2-HMAC-SHA512 + HMAC-SHA256 + Firebase Auth opcional │
│  - Control de Concurrencia Optimista (ETag SHA-256 / If-Match -> 409)      │
│  - Validación binaria de imágenes por Magic Bytes (PNG/JPG/WEBP <= 5 MB)   │
│  - Bitácora Inmutable de Auditoría (audit_logs.json)                       │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│             CAPA 3: CAPA DE ACCESO A DATOS HÍBRIDA (db/)                   │
│  - StorageConfigManager (json | sql | hybrid por módulo)                   │
│  - Fuente única autoritativa por módulo (evita escrituras duales)          │
├─────────────────────────────────┬──────────────────────────────────────────┤
│      Motor JSON Atómico         │      Motor Relacional MySQL / MariaDB    │
│ - Escritura temporal + rename   │ - Pool mysql2 parametrizado (?)          │
│ - Respaldos rotativos (30 ver.) │ - Transacciones ACID + FK ON CASCADE     │
│ - Aislamiento en PIA_DATA_DIR   │ - 18 Tablas (01_schema + 02_seed SQL)    │
└─────────────────────────────────┴──────────────────────────────────────────┘
```

---

## 2. COMPONENTES FUNCIONALES PRINCIPALES

### 2.1 Capa de Datos Híbrida (`db/`) y Esquema de 18 Tablas (`sql/`)
- **`db/sqlClient.js`**: Pool de conexiones `mysql2/promise` configurado estrictamente desde `.env` (`MYSQL_*`), sin exponer credenciales al frontend.
- **`db/schemaInit.js`**: Inspector sobre `INFORMATION_SCHEMA` e inicializador idempotente que ejecuta:
  1. `sql/01_schema_mysql.sql` (**18 tablas** InnoDB `utf8mb4_unicode_ci`).
  2. `sql/02_seed_initial_config.sql` (semilla `INSERT IGNORE` de métricas base, banderas de Canales, KPIs iniciales, fondos Hero e imagen de sección del Portal).
- **`db/storageConfig.js`**: Administra `PIA_DATA_DIR/storage_config.json` para las modalidades `json`, `sql` e `hybrid` sobre los 6 módulos de datos (`canales`, `directorio`, `tableros`, `riesgo`, `vehiculos`, `portal`).
- **`db/sqlRepository.js`**: Mappers bidireccionales exactos `SQL <-> JSON`, consultas parametrizadas y cálculo de `ETag` SHA-256 consistente.
- **`db/migrationService.js`** y **`admin/scripts/migrate_json_to_sql.js`**: Migración controlada bidireccional (`json_to_sql` y `sql_to_json`) con respaldos automáticos previos y bitácoras por registro en `PIA_DATA_DIR/migration_logs/`.

### 2.2 Autenticación, RBAC y Cuentas Institucionales
- **Cuentas base protegidas**: `deteccionydenuncia@cnc.gob.gt` y `apoyogi@cnc.gob.gt` (salvaguarda contra borrado desde API).
- **Gestión dinámica**: Creación, edición, cambio de contraseña y asignación granular de módulos (`canales`, `directorio`, `tableros`, `riesgo`, `vehiculos`, `portal`, `visits`, `chatbot`, `users`, `audit`, `database`, `guide`) desde `/admin/` → **Gestión de Usuarios**.
- **Cifrado y sesiones**: Contraseñas con **PBKDF2-HMAC-SHA512** (10,000 iteraciones, sal 16 bytes) y tokens de sesión **HMAC-SHA256** (`pia_sess_*`) con expiración por inactividad y verificación opcional de tokens **Firebase Auth**.

### 2.3 Personalización Visual Dinámica y KPIs por Módulo
- **Métricas dinámicas del Portal (`/api/portal/metricas`, `/api/admin/portal/metricas`)**:
  - Creación, edición (valor, sufijo, título, texto descriptivo inferior e ícono FontAwesome) y eliminación de tarjetas métricas.
  - Carrusel automático en la página principal cuando existen más de 4 métricas activas (`carouselActive: true`).
  - Persistencia en `data_portal.json` y columna `metricas_json` en `pia_portal_metricas`.
- **KPIs, Carrusel de Fondos Hero e Imagen de Sección (`/api/ui/:module`, `/api/admin/ui/:module/*`)**:
  - Cada módulo (`portal`, `canales`, `directorio`, `tableros`, `riesgo`, `vehiculos`) administra sus propios KPIs (`auto` vinculados a conteos reales o `manual`), fondos de encabezado rotativos y la imagen *«¿Por qué existe?»* del Portal (`/img/wallpaperdirectorio.jpg` por defecto).
  - Subida segura de imágenes (`POST /api/admin/ui/backgrounds/upload`) con validación estricta de firma binaria (*magic bytes* PNG/JPEG/WEBP), rechazo de SVG/HTML y límite de 5 MB en `/uploads/backgrounds/`.
- **Canales por la Integridad (`/api/canales/config`, `/api/admin/canales/config`)**:
  - Control dinámico de visibilidad pública (`showProtocolos`, `showDashboardCnc`) persistido en `PIA_DATA_DIR/canales_settings.json` y `pia_canales_config`.

### 2.4 Asistente Virtual Lupita
- Proxy backend protegido en `server.js` (`/api/chatbot/ask`, `/api/chatbot/config`, `/api/chatbot/knowledge`) usando `@google/genai` (`GEMINI_API_KEY`) con base de conocimiento local (`chatbot_knowledge.json`) y fallback heurístico determinista cuando no existe llave API.

---

## 3. CATÁLOGO DE LAS 18 TABLAS SQL (`sql/01_schema_mysql.sql`)

| Módulo / Función | Tablas SQL | Relación JSON / Archivo Equivalente |
|---|---|---|
| **Canales por la Integridad** | `pia_canales_integridad`, `pia_canales_config` | `canales-por-la-integridad/data_directorio.json`, `data/canales_settings.json` |
| **Directorio Acceso al Ejecutivo** | `pia_directorio_acceso`, `pia_directorio_enlaces` | `directorio/data_acceso.json` |
| **Tu Gobierno en Números** | `pia_tableros_gobierno` | `gobierno_en_numeros/data_tableros.json` |
| **Riesgo en la Mira** | `pia_riesgo_ciclos`, `pia_riesgo_instituciones`, `pia_riesgo_frecuentes` | `riesgo/datos.json` |
| **Transparencia Vehicular** | `pia_vehiculos_instituciones`, `pia_vehiculos_institucion_criterios`, `pia_vehiculos_institucion_documentos`, `pia_vehiculos`, `pia_vehiculos_historial` | `vehiculos/vehiculos.json` |
| **Portal Principal** | `pia_portal_metricas` | `data_portal.json` |
| **UI Dinámica (KPIs / Fondos)** | `pia_modules_ui_kpis`, `pia_modules_ui_backgrounds`, `pia_modules_ui_section_images` | `data/modules_ui_config.json` |
| **Auditoría de Migraciones** | `pia_storage_migrations` | `data/migration_logs/` |

---

## 4. SCRIPTS OFICIALES DE INSTALACIÓN Y VERIFICACIÓN

| Script / Herramienta | Propósito |
|---|---|
| `admin/scripts/init_pia_config.js` | Inicializa de forma idempotente `PIA_DATA_DIR`, `backups/`, `migration_logs/`, `uploads/backgrounds/`, `.env` (con `--generate-secret`), JSON operativos y valida datasets (`npm run setup:init` / `npm run setup:check`). |
| `admin/scripts/migrate_json_to_sql.js` | Valida los JSON contra el esquema SQL e importa en lote hacia MySQL/MariaDB (`--dry-run`, `--init-schema`, `--include-portal`). |
| `deploy-iis.ps1` + `web.config` | Despliegue automatizado para Windows Server con IIS, URL Rewrite + ARR, ACLs NTFS restrictivas y healthcheck. |
| `deploy-linux.sh` | Despliegue automatizado para Linux (Ubuntu/Debian/RHEL) con permisos, `.env`, servicio `systemd` y plantilla Nginx. |
| `test_security_suite.js` | Suite integral de regresión, seguridad, RBAC, concurrencia ETag, UI dinámica y arquitectura SQL (`npm test`). |
