# ARQUITECTURA TÉCNICA DEL PORTAL DE INTEGRIDAD ACTIVA (PIA)
## ESTABILIZACIÓN DE LA VERSIÓN 1 Y HOJA DE RUTA ARQUITECTÓNICA PARA LA VERSIÓN 2
### Gobierno de Guatemala — Comisión Nacional contra la Corrupción (CNC)

---

## 1. INFORME DE HALLAZGOS SOBRE LA ARQUITECTURA ACTUAL (VERSIÓN 1)

### 1.1 Diagnóstico de la Incidencia del Asistente Virtual Lupita
Durante la auditoría de ejecución en navegador de la Versión 1, se identificó la causa exacta por la cual el Asistente Virtual Lupita no era visible en las páginas públicas:
1. **Error de referencia fatal en tiempo de carga (`ReferenceError`)**: En `/js/pia-chatbot.js`, en el bloque de exposición global `window.PIA_CHATBOT = { rateMessage, copyMessageText, deleteKbItem: deleteWidgetKbItem };`, el identificador `deleteWidgetKbItem` no estaba declarado ni definido en el ámbito del script. Al evaluarse dicha propiedad dentro del IIFE (Inmediatly Invoked Function Expression), el motor de JavaScript del navegador arrojaba un `Uncaught ReferenceError: deleteWidgetKbItem is not defined`, deteniendo inmediatamente la ejecución del archivo antes de alcanzar el bloque de inicialización DOM (`document.addEventListener('DOMContentLoaded', initChatbot)` / `initChatbot()`). Como consecuencia directa, los elementos del DOM (`#piaChatbotTrigger` y `#piaChatbotWindow`) nunca llegaban a crearse ni insertarse en el árbol del documento.
2. **Omisiones y anomalías en etiquetas HTML**:
   - `/canales-por-la-integridad/index.html` carecía por completo de la inclusión del script `/js/pia-chatbot.js`.
   - `/directorio/index.html` y `/gobierno_en_numeros/index.html` presentaban etiquetas de cierre `</script>` espurias y duplicadas al final del documento.
   - Las hojas de estilo `/css/pia-chatbot.css` no estaban vinculadas directamente en el `<head>` de varias páginas públicas, dependiendo exclusivamente de una inyección dinámica asíncrona que generaba retrasos visuales.
3. **Solución implementada**:
   - Se eliminó la referencia errónea a `deleteWidgetKbItem` y se exportaron métodos limpios y seguros (`toggleChatbot`, `openChatbot`, `closeChatbot`, `rateMessage`, `copyMessageText`).
   - Se agregó salvaguarda para verificar la existencia de `document.body` antes de cualquier manipulación del DOM.
   - Se elevó el `z-index` de `.pia-chatbot-trigger` a `99999` y del contenedor `.pia-chatbot-window` a `100000`, evitando que quede oculto tras modales, reproductores de audio o elementos flotantes.
   - Se incluyó `<link rel="stylesheet" href="/css/pia-chatbot.css">` en el `<head>` y `<script src="/js/pia-chatbot.js" defer></script>` antes del cierre de `</body>` en todos los módulos públicos (`/`, `/canales-por-la-integridad/`, `/directorio/`, `/gobierno_en_numeros/`, `/riesgo/`).
   - Se conservó y perfeccionó el mecanismo de doble fallback heurístico: si el backend no dispone de `GEMINI_API_KEY` o no hay conexión de red, Lupita responde instantáneamente con orientación oficial en el cliente y en el servidor, sin revelar claves ni emitir errores al visitante.

---

### 1.2 Diagnóstico del Almacenamiento Persistente en Archivos JSON (V1)
La Versión 1 opera actualmente con archivos JSON almacenados en disco, con las siguientes características técnicas auditadas:
- **Escrituras Atómicas**: La función `atomicWriteJson(filePath, data, expectedHash, user)` escribe primero en un archivo temporal con sufijo `.tmp.[timestamp].[rand]` y ejecuta `fs.renameSync` para reemplazar el archivo de forma atómica a nivel del sistema de archivos del sistema operativo, previniendo la corrupción de datos ante interrupciones de energía o bloqueos.
- **Control de Concurrencia Optimista (OCC)**: Cada lectura de módulo genera un encabezado HTTP `ETag` basado en el hash criptográfico SHA-256 del contenido del archivo en disco. Las operaciones mutativas (`PUT`, `POST`, `DELETE`) evalúan el encabezado `If-Match` o el campo `_expectedHash`. Si otro operador modificó el archivo previamente, el backend rechaza la operación con código HTTP `409 Conflict` (`CONCURRENCY_CONFLICT`), impidiendo sobreescrituras silenciosas (lost updates).
- **Copias de Respaldo Rotativas**: Ante cada mutación exitosa, se genera una copia de seguridad timestamped en el directorio `/data/backups/` (o `$PIA_DATA_DIR\backups` en Windows Server), manteniendo un historial de hasta 30 versiones anteriores por módulo.
- **Aislamiento de Seguridad**: Las rutas `/api/raw-json` y `/api/users` se encuentran bloqueadas con `requireAuth` y `requireOperator`, impidiendo que usuarios no autenticados o externos lean o modifiquen archivos del sistema.

---

### 1.3 Modelo de Acceso Cerrado para Dos Operadores Institucionales
La Versión 1 ha erradicado completamente la complejidad de RBAC arbitrario, formularios de registro y contraseñas locales:
- **Capacidad**: Exactamente **dos identidades operativas autorizadas** en todo el sistema.
- **Mecanismo de Autorización**: La autorización se fundamenta exclusivamente en la coincidencia del identificador inmutable de objeto (`oid` - GUID) y del identificador de arrendatario (`tid`) emitidos en el token JWT criptográficamente validado por Microsoft Entra ID (mediante el endpoint público JWKS de Microsoft).
- **Carácter Informativo del Correo / UPN**: Los correos institucionales asignados:
  - Operador 1: `deteccionydenuncia@cnc.gob.gt` ("Dirección de Apoyo en la Gestión de Irregularidades - DAGI")
  - Operador 2: `apoyogi@cnc.gob.gt` ("Apoyo GI - CNC")
  actúan exclusivamente como metadatos informativos y de trazabilidad en las bitácoras; **en ningún caso se utilizan como llave única de autorización ni se admiten contraseñas en el frontend**.
- **Cero Administración desde el Navegador**: La asignación de operadores solo puede realizarse mediante variables de entorno del servidor (`PIA_OPERATOR_1_OID`, `PIA_OPERATOR_2_OID`) o a través del archivo de configuración protegido `authorized_operators.json`. Ningún usuario web puede crear cuentas ni elevar privilegios.
- **Modo Seguro Pendiente de Configuración**: Si faltan `ENTRA_TENANT_ID` o `ENTRA_CLIENT_ID`, el módulo administrativo permanece herméticamente bloqueado (HTTP 401 `configPending: true`), permitiendo al mismo tiempo el funcionamiento público ininterrumpido de todos los módulos ciudadanos.

---

## 2. LISTA DE CORRECCIONES NECESARIAS PARA COMPLETAR LA VERSIÓN 1

| Componente | Archivo(s) | Corrección Realizada | Justificación Técnica |
| :--- | :--- | :--- | :--- |
| **Chatbot Lupita** | `/js/pia-chatbot.js` | Eliminación de `deleteWidgetKbItem` en exportación global; comprobación de `document.body`. | Erradica `ReferenceError` que impedía la inicialización y el renderizado del botón flotante y ventana de chat. |
| **Estilos Lupita** | `/css/pia-chatbot.css` | Elevación de `z-index` de `.pia-chatbot-trigger` a `99999` y `.pia-chatbot-window` a `100000`. | Evita que el asistente quede solapado bajo modales, pies de página o barras de navegación con alta prioridad z. |
| **Módulos Públicos** | `/canales-por-la-integridad/index.html`<br>`/directorio/index.html`<br>`/gobierno_en_numeros/index.html`<br>`/riesgo/index.html`<br>`/index.html` | Vinculación explícita de `/css/pia-chatbot.css` en `<head>` y `/js/pia-chatbot.js` defer antes de `</body>`. Corrección de `</script>` duplicados. | Garantiza la disponibilidad ubicua del chatbot en todo el ecosistema digital sin errores de sintaxis HTML. |
| **Carga de Operadores** | `/server.js` | Ajuste en `getAuthorizedOperators()` para leer hasta 2 operadores por índice desde `authorized_operators.json`. | Evita que se omita el segundo operador cuando ambos se encuentran en estado de plantilla o configuración pendiente. |
| **Endpoint Operadores** | `/server.js` | Mapeo dinámico de `displayName`, `upn`, `status`, `notes` y máscara OID en `/api/admin/operators-status`. | Refleja con precisión el estado institucional real de los operadores 1 y 2 en el panel de control administrativo. |
| **Protección Endpoints** | `/server.js` | Inclusión estricta de `requireAuth, requireOperator` en `/api/users` y `/api/raw-json`. | Garantiza que cualquier petición no autenticada sea rechazada con HTTP 401 en lugar de exponer estructuras internas. |
| **Filtro IIS** | `/web.config` | Creación de reglas de reescritura, supresión de `Server` y `X-Powered-By`, y bloqueo de segmentos ocultos (`.env`, `data`, `.git`). | Cumple con los estándares de endurecimiento y hosting seguro en servidores físicos institucionales con IIS. |
| **Instalación IIS** | `/deploy-iis.ps1` | Script automatizado en PowerShell con control de ACLs NTFS en `C:\PIA_Data`, verificación de Node.js y healthchecks. | Proporciona un procedimiento determinista, auditable y repetible para el equipo de infraestructura de TI. |

---

## 3. PRUEBAS EJECUTADAS Y RESULTADOS REALES

Se ejecutó la batería automatizada integral de seguridad, concurrencia y regresión (`test_security_suite.js`), arrojando un resultado de **24 pruebas superadas sobre 24 ejecutadas (100% de efectividad)**:

```text
=============================================================
 INICIANDO BATERÍA DE PRUEBAS DE SEGURIDAD Y REGRESIÓN PIA
=============================================================
  ✅ [PASSED] 1.1 Rechazo de POST /api/canales sin autenticación (401)
  ✅ [PASSED] 1.2 Rechazo de PUT /api/canales/1 sin autenticación (401)
  ✅ [PASSED] 1.3 Rechazo de DELETE /api/canales/1 sin autenticación (401)
  ✅ [PASSED] 1.4 Rechazo de GET /api/raw-json sin autenticación (401)
  ✅ [PASSED] 1.5 Rechazo de POST /api/raw-json sin autenticación (401)
  ✅ [PASSED] 1.6 Rechazo de GET /api/users sin autenticación (401)
  ✅ [PASSED] 1.7 Rechazo de GET /api/audit sin autenticación (401)
  ✅ [PASSED] 2.1 Rechazo de Bearer token aleatorio / falso (401)
  ✅ [PASSED] 3.1 Token backdoor pia-admin-valid-token-detector25 bloqueado (401)
  ✅ [PASSED] 3.2 Credenciales maestras admin123 no admitidas (404 o 401)
  ✅ [PASSED] 4.1 Path Traversal bloqueado en raw-json (401 o 403)
  ✅ [PASSED] 5.1 Bloqueo de adición de conocimiento sin credenciales (401)
  ✅ [PASSED] 5.2 Bloqueo de eliminación de conocimiento sin credenciales (401)
  ✅ [PASSED] 5.3 Bloqueo de alteración de configuración de IA sin credenciales (401)
  ✅ [PASSED] 6.1 Consulta ciudadana a Lupita responde con información oficial
  ✅ [PASSED] 6.2 Endpoint público de configuración de Lupita activo
  ✅ [PASSED] 7.1 Carpeta de respaldos automáticos /data/backups/ inicializada
  ✅ [PASSED] 7.2 Archivo protegido /data/users_roles.json inicializado fuera de wwwroot
  ✅ [PASSED] 8.1 Lectura pública de /api/canales (200 OK con registros)
  ✅ [PASSED] 8.2 Lectura pública de /api/directorio (200 OK con registros)
  ✅ [PASSED] 8.3 Lectura pública de /api/tableros (200 OK con registros)
  ✅ [PASSED] 8.4 Lectura pública de /api/riesgo (200 OK con registros)
  ✅ [PASSED] 8.5 Lectura pública de /api/vehiculos (200 OK con registros)
  ✅ [PASSED] 9.1 Ningún secreto o clave privada expuesta en endpoint /api/auth/entra-config
=============================================================
 RESUMEN DE PRUEBAS: 24 SUPERADAS / 0 FALLIDAS (100% OK)
=============================================================
```

Adicionalmente, se verificó mediante script de integración que:
- Las páginas `/`, `/canales-por-la-integridad/`, `/directorio/`, `/gobierno_en_numeros/` y `/riesgo/` devuelven código HTTP `200 OK` e incorporan los artefactos del chatbot.
- La ruta `/vehiculos` redirige de manera controlada y transparente con código HTTP `302 Found` hacia `/`, manteniendo el módulo no visible mientras el equipo institucional concluye su validación de datos.

---

## 4. ESTRUCTURA DEL PAQUETE INSTALABLE PARA WINDOWS SERVER CON IIS

El paquete comprimido o clon del repositorio destinado a la instalación en el servidor físico institucional contiene los siguientes elementos organizados:

```text
C:\inetpub\wwwroot\PIA\                 <-- Raíz del sitio en IIS
├── admin/                              <-- Interfaz administrativa SPA
│   ├── css/admin.css
│   ├── js/
│   │   ├── app.js                      <-- Controlador principal y navegación
│   │   ├── crud.js                     <-- Consumo de API con control ETag
│   │   ├── user-manager.js             <-- Visor de Estado de Identidades y Seguridad
│   │   ├── chatbot-manager.js          <-- Gestión de base de conocimiento Lupita
│   │   └── technical-guide.js          <-- Documentación interactiva del sistema
│   └── index.html
├── canales-por-la-integridad/          <-- Módulo ciudadano de Canales
├── directorio/                         <-- Módulo ciudadano de Directorio
├── gobierno_en_numeros/                <-- Módulo ciudadano de Tableros
├── riesgo/                             <-- Módulo ciudadano de Gestión de Riesgo
├── css/
│   └── pia-chatbot.css                 <-- Hoja de estilos del Asistente Lupita
├── js/
│   ├── pia-chatbot.js                  <-- Cliente frontend del Asistente Lupita
│   └── pia-i18n.js                     <-- Traducción reactiva multilingüe (Español / Lenguas Mayas)
├── img/                                <-- Recursos gráficos, escudos e iconografía
├── docs/                               <-- Documentación técnica y arquitectura
│   └── ARQUITECTURA_V2_Y_MIGRACION_SQL.md
├── server.js                           <-- Backend API Node.js Express institucional
├── package.json                        <-- Manifiesto de dependencias de producción
├── web.config                          <-- Configuración IIS (Filtros, MIME, Reverse Proxy)
├── deploy-iis.ps1                      <-- Script automatizado de despliegue en PowerShell
├── test_security_suite.js              <-- Batería de pruebas de verificación institucional
└── .env.example                        <-- Plantilla de variables de entorno institucional
```

Directorio de datos protegido (fuera de `wwwroot`):
```text
C:\PIA_Data\                            <-- Almacenamiento persistente aislado
├── authorized_operators.json           <-- Identidades autorizadas (si no están en .env)
├── data_portal.json
├── data_canales.json
├── data_directorio.json
├── data_tableros.json
├── datos_riesgo.json
├── audit_logs.json                     <-- Bitácora inmutable de eventos administrativos
├── chatbot_knowledge.json              <-- Base de conocimientos de Lupita
├── chatbot_settings.json               <-- Configuración operativa de IA
└── backups/                            <-- Historial de respaldos automáticos
```

---

## 5. DOCUMENTO DE ARQUITECTURA OBJETIVO PARA LA VERSIÓN 2 (SIN MIGRAR TODAVÍA)

Para evolucionar a la Versión 2 con soporte de Microsoft SQL Server o Azure SQL Database sin traumatizar la operación actual ni requerir reescrituras innecesarias en el frontend, se define una **Arquitectura en Tres Capas Limpias con Patrón Storage Adapter**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        CAPA 1: PRESENTACIÓN                            │
│  - Portales Públicos Ciudadanos (HTML5, Vanilla JS, CSS3, SVG)         │
│  - Módulo Administrativo Institucional (SPA con MSAL Browser)          │
│  - Asistente Virtual Lupita (Widget de consulta pública y fallback)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Peticiones HTTP / JSON + ETags
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   CAPA 2: SERVICIOS Y DOMINIO DE NEGOCIO               │
│  - Endpoints REST Normalizados (/api/:module, /api/auth, /api/audit)   │
│  - Middleware de Seguridad (requireAuth, verifyEntraToken vía JWKS)    │
│  - Motor de Control de Concurrencia Optimista (OCC con SHA-256 / Hash) │
│  - Bitácora de Auditoría Centralizada (Trazabilidad por OID)           │
│  - Proxy Seguro de Asistente Virtual (Rate limiting y Fallback)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Invoca interfaz abstracta
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   CAPA 3: ADAPTADOR DE PERSISTENCIA                    │
│                        <<IStorageAdapter>>                             │
│       - getModuleRecords(module): Promise<Array>                       │
│       - saveModuleRecords(module, records, user, hash): Promise<Result>│
│       - logAudit(entry): Promise<void>                                 │
│       - getOperators(): Promise<Array>                                 │
│       - getChatbotKnowledge(): Promise<Array>                          │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
        (Versión 1 - Actual)             (Versión 2 - Futura)
                    ▼                                ▼
     ┌─────────────────────────────┐  ┌─────────────────────────────┐
     │   JsonFileStorageAdapter    │  │   SqlServerStorageAdapter   │
     │ - Escrituras atómicas (.tmp)│  │ - Conexión Pool 'mssql'     │
     │ - Control de hash de disco  │  │ - Transacciones ACID        │
     │ - Respaldos en C:\PIA_Data  │  │ - Concurrencia ROWVERSION   │
     └─────────────────────────────┘  └─────────────────────────────┘
```

### 5.1 Principios de Diseño de la Versión 2
1. **Desacoplamiento Absoluto de la Presentación**: Ningún archivo del frontend (ni en módulos públicos ni en el panel administrativo) lee o escribe directamente archivos físicos; la totalidad de operaciones continuará canalizándose a través de `/api/:module`. De este modo, el cambio de motor de persistencia es 100% transparente para el cliente web.
2. **Normalización de Respuestas del Backend**:
   - Éxito en lectura: Array de objetos JSON normalizados, con identificador numérico o alfanumérico uniforme `id`, y encabezado `ETag`.
   - Éxito en mutación: Código HTTP `200 OK` o `201 Created` con el objeto procesado y el nuevo `ETag`.
   - Conflicto de concurrencia: Código HTTP `409 Conflict` con payload `{ error: "...", code: "CONCURRENCY_CONFLICT" }`.
   - Error de validación: Código HTTP `400 Bad Request` con mensajes institucionalmente amigables.
3. **Persistencia Polimórfica mediante Inyección de Dependencias**: El archivo del servidor inicializa la instancia de persistencia según la variable de entorno `PIA_STORAGE_DRIVER`:
   - `PIA_STORAGE_DRIVER=json` -> Carga `JsonFileStorageAdapter` (Versión 1).
   - `PIA_STORAGE_DRIVER=sqlserver` -> Carga `SqlServerStorageAdapter` (Versión 2).

---

## 6. MODELO DE DATOS FUTURO Y PLAN DE MIGRACIÓN DE JSON A SQL SERVER / AZURE SQL

### 6.1 Mapeo Relacional de Entidades Actuales

| Archivo JSON Actual (V1) | Módulo PIA | Tabla(s) Propuesta(s) en SQL Server (V2) | Descripción |
| :--- | :--- | :--- | :--- |
| `canales-por-la-integridad/data_directorio.json` | Canales por la Integridad | `Pia_InstitucionesCanales`, `Pia_CanalesDetalle` | Directorio de dependencias del Ejecutivo y sus canales activos de denuncia. |
| `directorio/data_acceso.json` | Directorio Ejecutivo | `Pia_DirectorioEjecutivo`, `Pia_MecanismosAcceso` | Entidades del Ejecutivo, autoridades, unidades de información y direcciones. |
| `gobierno_en_numeros/data_tableros.json` | Gobierno en Números | `Pia_TablerosGestion`, `Pia_CategoriasTablero` | Indicadores de gestión, enlaces a tableros analíticos y fuentes de datos. |
| `riesgo/datos.json` | Riesgo en la Mira | `Pia_EvaluacionesRiesgo`, `Pia_PeriodosRiesgo` | Semáforo de cumplimiento institucional en prevención de corrupción. |
| `data_portal.json` | Portal Home (Métricas) | `Pia_MetricasGenerales` | Contadores consolidados de probidad, denuncias y plataformas activas. |
| `authorized_operators.json` | Identidades Administrativas | `Pia_OperadoresAutorizados` | Registro inmutable de los dos OID/TID con permisos de operador. |
| `audit_logs.json` | Bitácora de Trazabilidad | `Pia_BitacoraAuditoria` | Registro particionado de auditoría administrativa con sello de tiempo e IP. |
| `chatbot_knowledge.json` | Asistente Virtual Lupita | `Pia_ChatbotConocimiento` | Base de conocimiento institucional para respuestas aumentadas (RAG). |

---

### 6.2 Definición DDL (Transact-SQL) para SQL Server / Azure SQL

```sql
-- ========================================================
-- ESQUEMA RELACIONAL INSTITUCIONAL - PORTAL PIA (VERSIÓN 2)
-- Base de Datos: PiaDb_Produccion
-- Motor Compatible: Microsoft SQL Server 2019/2022 o Azure SQL
-- ========================================================

CREATE SCHEMA pia AUTHORIZATION dbo;
GO

-- 1. Catálogo Institucional y Canales de Denuncia
CREATE TABLE pia.InstitucionesCanales (
    InstitucionId INT IDENTITY(1,1) PRIMARY KEY,
    NombreInstitucion NVARCHAR(250) NOT NULL,
    Siglas NVARCHAR(50) NULL,
    Sector NVARCHAR(100) NOT NULL DEFAULT 'Organismo Ejecutivo',
    Telefono NVARCHAR(100) NULL,
    CorreoElectronico NVARCHAR(150) NULL,
    FormularioWeb NVARCHAR(500) NULL,
    AtencionPresencial NVARCHAR(250) NULL,
    HorarioAtencion NVARCHAR(150) NULL,
    Direccion NVARCHAR(350) NULL,
    TieneProtocolo BIT NOT NULL DEFAULT 0,
    EstadoRegistro NVARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    RowVersion ROWVERSION -- Control de Concurrencia Optimista nativo
);
GO

-- 2. Directorio de Acceso al Ejecutivo
CREATE TABLE pia.DirectorioEjecutivo (
    DirectorioId INT IDENTITY(1,1) PRIMARY KEY,
    InstitucionNombre NVARCHAR(250) NOT NULL,
    Siglas NVARCHAR(50) NULL,
    Sector NVARCHAR(100) NULL,
    CorreoAcceso NVARCHAR(150) NULL,
    TelefonoAcceso NVARCHAR(100) NULL,
    SitioWeb NVARCHAR(500) NULL,
    SolicitudEnLinea BIT NOT NULL DEFAULT 0,
    InformacionOficio BIT NOT NULL DEFAULT 1,
    DireccionFisica NVARCHAR(350) NULL,
    HorarioAtencion NVARCHAR(150) NULL,
    UltimaActualizacion NVARCHAR(50) NULL,
    RowVersion ROWVERSION
);
GO

-- 3. Tu Gobierno en Números (Tableros de Rendición de Cuentas)
CREATE TABLE pia.TablerosGestion (
    TableroId INT IDENTITY(1,1) PRIMARY KEY,
    Titulo NVARCHAR(200) NOT NULL,
    InstitucionResponsable NVARCHAR(250) NOT NULL,
    Categoria NVARCHAR(100) NOT NULL,
    Descripcion NVARCHAR(1000) NULL,
    UrlTablero NVARCHAR(500) NOT NULL,
    UrlFuenteDatos NVARCHAR(500) NULL,
    EsDestacado BIT NOT NULL DEFAULT 0,
    RowVersion ROWVERSION
);
GO

-- 4. Riesgo en la Mira (Semaforización Institucional)
CREATE TABLE pia.EvaluacionesRiesgo (
    EvaluacionId INT IDENTITY(1,1) PRIMARY KEY,
    InstitucionNombre NVARCHAR(250) NOT NULL,
    AnioFiscal INT NOT NULL DEFAULT 2025,
    NivelRiesgo NVARCHAR(20) NOT NULL, -- 'BAJO', 'MEDIO', 'ALTO'
    PuntajeCumplimiento DECIMAL(5,2) NOT NULL,
    Observaciones NVARCHAR(1000) NULL,
    RowVersion ROWVERSION
);
GO

-- 5. Operadores Institucionales Autorizados (Modelo Cerrado de 2 Identidades)
CREATE TABLE pia.OperadoresAutorizados (
    OperadorId INT IDENTITY(1,1) PRIMARY KEY,
    OperatorIndex INT NOT NULL UNIQUE CHECK (OperatorIndex IN (1, 2)),
    EntraObjectId UNIQUEIDENTIFIER NOT NULL UNIQUE,
    EntraTenantId UNIQUEIDENTIFIER NOT NULL,
    DisplayName NVARCHAR(150) NOT NULL,
    UserPrincipalName NVARCHAR(150) NOT NULL,
    RoleName NVARCHAR(50) NOT NULL DEFAULT 'data_operator',
    Estado NVARCHAR(30) NOT NULL DEFAULT 'pending_configuration',
    NotasAuditoria NVARCHAR(500) NULL,
    CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
GO

-- 6. Bitácora de Auditoría Inmutable
CREATE TABLE pia.BitacoraAuditoria (
    AuditoriaId BIGINT IDENTITY(1,1) PRIMARY KEY,
    UserOid UNIQUEIDENTIFIER NULL,
    UserPrincipalName NVARCHAR(150) NOT NULL,
    UserRole NVARCHAR(50) NOT NULL,
    Accion NVARCHAR(50) NOT NULL, -- 'CREACIÓN', 'ACTUALIZACIÓN', 'ELIMINACIÓN'
    ModuloAfectado NVARCHAR(50) NOT NULL,
    RegistroId NVARCHAR(100) NULL,
    DetallesOperacion NVARCHAR(MAX) NULL,
    DireccionIp NVARCHAR(45) NOT NULL,
    FechaEvento DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
GO

-- 7. Base de Conocimiento de Lupita
CREATE TABLE pia.ChatbotConocimiento (
    ConocimientoId NVARCHAR(50) PRIMARY KEY,
    Titulo NVARCHAR(200) NOT NULL,
    Categoria NVARCHAR(100) NOT NULL DEFAULT 'General',
    Contenido NVARCHAR(MAX) NOT NULL,
    PalabrasClave NVARCHAR(500) NULL,
    EnlaceReferencia NVARCHAR(300) NULL,
    UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
GO

-- Índices de Rendimiento y Búsqueda
CREATE NONCLUSTERED INDEX IX_Auditoria_Fecha ON pia.BitacoraAuditoria (FechaEvento DESC);
CREATE NONCLUSTERED INDEX IX_Auditoria_User ON pia.BitacoraAuditoria (UserPrincipalName);
CREATE NONCLUSTERED INDEX IX_Instituciones_Nombre ON pia.InstitucionesCanales (NombreInstitucion);
GO
```

---

### 6.3 Estrategia de Pruebas de Migración (Verificación de Integridad)

Cuando la CNC decida ejecutar la migración física de datos a SQL Server en la Etapa 2, se deberá ejecutar el siguiente protocolo de prueba automatizado:

1. **Prueba de Reconciliación de Cardinalidad (Record Count)**:
   - Contar registros en cada archivo JSON: `count(JSON)`.
   - Contar filas en cada tabla SQL: `SELECT COUNT(*) FROM pia.<Tabla>`.
   - Criterio de Aceptación: `count(JSON) == count(SQL)` (0 registros omitidos).
2. **Prueba de Integridad de Campos Clave (Field Checksum)**:
   - Concatenar y calcular hash SHA-256 de campos normalizados antes y después de la carga.
   - Criterio de Aceptación: Conciliación del 100% en identificadores, nombres de institución, números de teléfono y URLs oficiales.
3. **Prueba de Concurrencia Optimista (OCC Test)**:
   - Simular dos peticiones concurrentes de actualización sobre el mismo registro utilizando el `RowVersion` de SQL Server.
   - Criterio de Aceptación: La primera petición debe retornar `200 OK` actualizando el registro; la segunda debe fallar con `409 Conflict`, replicando exactamente el comportamiento de la Versión 1.
4. **Prueba de Rollback Transaccional**:
   - Forzar un fallo intencional en la inserción de un lote de instituciones.
   - Criterio de Aceptación: La transacción SQL debe ejecutar `ROLLBACK TRANSACTION` completo sin dejar registros huérfanos ni inconsistencias.

---

## 7. LISTA DE DEPENDENCIAS QUE REQUIEREN INTERVENCIÓN INSTITUCIONAL (TI CNC)

Para la puesta en marcha definitiva en el servidor de producción, se requiere que el equipo de Tecnología de la Información de la CNC proporcione o configure los siguientes parámetros:

1. **Registro de Aplicación en Microsoft Entra ID (Azure AD)**:
   - **`ENTRA_TENANT_ID`**: Identificador GUID del Directorio (Tenant ID) institucional de la CNC.
   - **`ENTRA_CLIENT_ID`**: Identificador GUID de la Aplicación (Application/Client ID) registrada con tipo SPA (Single-Page Application).
   - **`ENTRA_REDIRECT_URI`**: URI autorizada de redirección (ej. `https://pia.gob.gt/admin/`).
2. **Identificadores Inmutables de los Dos Operadores (OIDs)**:
   - **`PIA_OPERATOR_1_OID`**: Object ID real emitido en Entra ID para la cuenta `deteccionydenuncia@cnc.gob.gt`.
   - **`PIA_OPERATOR_2_OID`**: Object ID real emitido en Entra ID para la cuenta `apoyogi@cnc.gob.gt`.
3. **Clave de Inteligencia Artificial Google Gemini (Backend)**:
   - **`GEMINI_API_KEY`**: Clave API de Google Cloud con permisos sobre el modelo `gemini-2.5-flash`. (Nota: Si no se dispone de ella al momento del despliegue, Lupita funcionará en contingencia mediante sus motores de respuesta heurística sin bloquear ninguna función).
4. **Almacenamiento en Servidor**:
   - Creación del directorio protegido `C:\PIA_Data` en el servidor físico con los permisos NTFS generados por `deploy-iis.ps1`.
5. **Certificados de Seguridad y Enrutamiento**:
   - Certificado digital SSL/TLS (`https://pia.gob.gt`) instalado en IIS.
   - Activación de Microsoft URL Rewrite Module 2.1 y Application Request Routing (ARR) en IIS.
