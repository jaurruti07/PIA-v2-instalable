# Guía Institucional de Instalación y Configuración Híbrida (JSON + MySQL/MariaDB)
## Portal de Integridad Activa (PIA) — Windows Server + Node.js

---

## 1. Arquitectura de Almacenamiento Soportada

El Portal de Integridad Activa (PIA) implementa una capa de acceso a datos híbrida que permite operar sin modificaciones en el código fuente bajo tres modalidades:

| Modalidad | Descripción | Cuándo utilizarla |
|---|---|---|
| **A. `json` (Predeterminada)** | Todos los módulos leen y escriben sobre los archivos JSON originales en disco con escrituras atómicas, control `ETag` y respaldos automáticos en `data/backups/`. | Instalación rápida, operación sin motor SQL o entornos locales descargados. |
| **B. `sql`** | Todos los módulos leen y escriben en tablas relacionales **MySQL 8.0+ / MariaDB 10.6+** mediante transacciones ACID y consultas parametrizadas. | Infraestructura institucional con base de datos centralizada. |
| **C. `hybrid`** | Permite seleccionar individualmente qué módulos utilizan **JSON** y cuáles **SQL**. Cada módulo tiene **una única fuente autoritativa** para evitar inconsistencias. | Migración gradual por etapas o convivencia institucional controlada. |

> **Compatibilidad garantizada:** Las páginas públicas (`/`, `/canales-por-la-integridad/`, `/directorio/`, `/gobierno_en_numeros/`, `/riesgo/`) no requieren cambios. Cuando un módulo opera en SQL, el servidor Express responde dinámicamente las rutas JSON públicas y `/api/:module` desde MySQL/MariaDB manteniendo exactamente la estructura esperada.

---

## 2. Requisitos del Servidor (Windows Server)

1. **Sistema Operativo:** Windows Server 2019 / 2022 (o Windows 10/11 para pruebas locales).
2. **Node.js:** Versión **LTS 18.x, 20.x o 22.x** (`node -v`, `npm -v`).
3. **Motor SQL (Opcional para modalidades `sql` o `hybrid`):**
   - **MySQL Server 8.0+** o **MariaDB Server 10.6+** con motor `InnoDB` y juego de caracteres `utf8mb4`.
4. **Servidor Web / Reverse Proxy (Recomendado en producción):**
   - **IIS** con módulos **URL Rewrite 2.1** y **Application Request Routing (ARR)** (archivo `web.config` incluido), o **PM2 / NSSM** ejecutando `server.js` en el puerto `3000`.

---

## 3. Procedimiento de Instalación Paso a Paso

### Paso 1: Ubicar el Proyecto e Instalar Dependencias
Copiar o clonar el proyecto en la ruta institucional (por ejemplo `C:\inetpub\wwwroot\PIA`) y ejecutar en PowerShell (Administrador):

```powershell
cd C:\inetpub\wwwroot\PIA
npm install --omit=dev
```

*(También puede ejecutar `.\deploy-iis.ps1` para automatizar la creación de `C:\PIA_Data`, permisos NTFS e IIS).*

### Paso 2: Crear Archivo `.env` desde `.env.example`
Copiar `.env.example` a `.env` en la raíz del proyecto (este archivo **nunca** debe publicarse ni subirse al navegador):

```powershell
Copy-Item .env.example .env
```

Editar `.env` con las credenciales reales del servidor:

```env
PORT=3000
ENVIRONMENT=production
PIA_SESSION_SECRET=GENERAR_LLAVE_ALEATORIA_SEGURA_DE_64_CARACTERES
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
```

> **Nota de Seguridad:** Nunca almacene contraseñas de base de datos en archivos dentro de `/admin/`, `/js/`, ni en archivos JSON públicos.

### Paso 3: Crear Usuario SQL con Privilegios Mínimos (Recomendado en MySQL/MariaDB)
En MySQL/MariaDB (como `root` o DBA), crear la base de datos y una cuenta dedicada para PIA:

```sql
CREATE DATABASE IF NOT EXISTS `pia_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'pia_app_user'@'localhost' IDENTIFIED BY 'CONTRASEÑA_SEGURA_AQUI';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER
  ON `pia_db`.* TO 'pia_app_user'@'localhost';
FLUSH PRIVILEGES;
```

### Paso 4: Inicializar Estructura de Tablas SQL
Puede realizarse de **dos maneras equivalentes**:

- **Opción A (Manual vía script SQL oficial):**
  ```powershell
  mysql -u pia_app_user -p < sql\01_schema_mysql.sql
  ```
- **Opción B (Desde el Panel Administrativo — Proceso Controlado):**
  1. Inicie el servidor Node.js (`node server.js`).
  2. Ingrese a `http://localhost:3000/admin/` con su cuenta `@cnc.gob.gt`.
  3. Vaya a **Almacenamiento y BD** → pestaña **Almacenamiento Híbrido y SQL**.
  4. Haga clic en **Probar Conexión SQL** y luego en **Inicializar / Verificar Tablas SQL**.

---

## 4. Tablas Relacionales Generadas (`sql/01_schema_mysql.sql`)

Todas las tablas conservan íntegros los campos, llaves, relaciones e índices de los archivos JSON originales:

1. `pia_canales_integridad` ← `canales-por-la-integridad/data_directorio.json`
2. `pia_directorio_acceso` + `pia_directorio_enlaces` (FK `ON DELETE CASCADE`) ← `directorio/data_acceso.json`
3. `pia_tableros_gobierno` ← `gobierno_en_numeros/data_tableros.json`
4. `pia_riesgo_ciclos` + `pia_riesgo_instituciones` (FK `ON DELETE CASCADE`) + `pia_riesgo_frecuentes` ← `riesgo/datos.json`
5. `pia_vehiculos_instituciones` + `pia_vehiculos_institucion_criterios` + `pia_vehiculos_institucion_documentos` + `pia_vehiculos` + `pia_vehiculos_historial` (FK `ON DELETE CASCADE`) ← `vehiculos/vehiculos.json`
6. `pia_portal_metricas` ← `data_portal.json`
7. `pia_storage_migrations` ← Bitácora técnica de importaciones y exportaciones JSON ↔ SQL.

---

## 5. Migración Inicial de los Archivos JSON a SQL

1. En `/admin/` → **Almacenamiento y BD** → **Almacenamiento Híbrido y SQL**, verifique que las 14 tablas aparezcan con estado **Verificada**.
2. Haga clic en **Importar JSON → SQL**.
3. Seleccione todos los módulos (o los deseados) y elija la política de duplicados:
   - **Omitir duplicados existentes (Seguro):** recomendado para evitar sobrescrituras accidentales.
   - **Sobrescribir registros existentes:** requiere marcar la casilla de autorización explícita; genera respaldo previo automático en `data/backups/migration_.../`.
4. Revise el reporte de resultados (`Insertados`, `Actualizados`, `Omitidos`, `Errores`) y verifique que el conteo de filas SQL coincida con los archivos JSON.
5. En la sección **Modalidad de Convivencia**, seleccione `Solo SQL` o `Híbrido` (escogiendo qué módulos usan SQL y cuáles JSON) y presione **Aplicar Configuración**.

---

## 6. Ejecución Permanente en Windows Server con Node.js

### Opción 1: PM2 como Servicio Windows
```powershell
npm install -g pm2 pm2-windows-service
pm2-service-install -n PIA_Portal
pm2 start server.js --name pia-backend
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

Ejecute las pruebas integrales del proyecto para validar endpoints públicos, seguridad, permisos y operación híbrida:

```powershell
npm test
```

Checklist rápido tras instalar:
- [ ] `GET http://127.0.0.1:3000/api/modules` responde HTTP `200 OK`.
- [ ] El portal público carga en `http://127.0.0.1:3000/` sin errores en consola.
- [ ] El módulo **Almacenamiento y BD** en `/admin/` muestra conexión SQL, conteo por tabla y modalidad activa.
- [ ] No existen credenciales SQL en respuestas HTTP ni en archivos del frontend.
- [ ] Las operaciones mutativas crean respaldo en `C:\PIA_Data\backups` y registro en `audit_logs.json`.
