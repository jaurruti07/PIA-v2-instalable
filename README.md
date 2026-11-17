# Portal de Integridad Activa (PIA)
### Comisión Nacional contra la Corrupción (CNC) — Presidencia de la República de Guatemala
**Documentación Técnica de Arquitectura, Despliegue y Entrega al Departamento de TI**

---

## 1. Resumen Ejecutivo y Arquitectura

El **Portal de Integridad Activa (PIA)** es la plataforma oficial del Organismo Ejecutivo de Guatemala orientada a centralizar y transparentar la información pública, canales de denuncia confidencial, directorio institucional, tableros de rendición de cuentas y gestión de riesgos de corrupción.

### Pila Tecnológica (Tech Stack)
- **Backend Principal (Producción TI):** Python 3.11+ con **Flask** y servidor WSGI **Gunicorn**.
- **Backend Secundario / Desarrollo:** Node.js con Express (motor dual compatible).
- **Frontend:** HTML5 semántico, CSS3 con variables nativas de diseño institucional, JavaScript ES6+ modular sin dependencias pesadas.
- **Seguridad Criptográfica:** Contraseñas encriptadas con sal PBKDF2-HMAC-SHA512 (10,000 iteraciones), tokens de sesión HMAC-SHA256, cabeceras estrictas (CSP, X-Frame-Options, ETag de concurrencia).
- **Almacenamiento Persistente:** Estructuras JSON protegidas fuera del document root con escrituras atómicas y respaldo automático versionado.

---

## 2. Estructura Estándar del Proyecto

```text
/
├── app.py                      # Backend principal en Python Flask (rutas, APIs, seguridad)
├── gunicorn.conf.py            # Configuración de producción para el servidor WSGI Gunicorn
├── requirements.txt            # Dependencias oficiales de Python
├── Dockerfile                  # Contenedor de producción con usuario no privilegiado
├── .env.example                # Plantilla de variables de entorno seguras
├── README.md                   # Manual técnico y guía de despliegue para TI
│
├── templates/                  # Plantillas HTML del portal
│   ├── index.html              # Portada del Portal PIA
│   ├── canales.html            # Canales por la Integridad
│   ├── directorio.html         # Directorio Acceso al Ejecutivo
│   ├── tableros.html           # Tu Gobierno en Números
│   ├── riesgo.html             # Riesgo en la Mira
│   ├── admin.html              # Panel Administrativo y de Gestión
│   └── 404.html                # Página de error 404 institucional
│
├── static/                     # Recursos estáticos organizados
│   ├── css/                    # Hojas de estilo generales y de módulos
│   ├── js/                     # Librerías cliente, internacionalización y utilidades
│   └── images/                 # Logos institucionales, infografías y fotografías
│
├── data/                       # Almacenamiento persistente protegido
│   ├── users_roles.json        # Identidades, contraseñas encriptadas y módulos autorizados
│   ├── authorized_operators.json # Metadatos de operadores
│   ├── audit_logs.json         # Bitácora inmutable de auditoría individualizada
│   ├── page_visits.json        # Contador y analítica de visitas reales
│   └── backups/                # Respaldos automáticos rotativos (hasta 30 versiones)
│
├── canales-por-la-integridad/  # Recursos específicos del módulo de denuncias
├── directorio/                 # Recursos específicos del directorio de autoridades
├── gobierno_en_numeros/        # Datos y tableros de rendición de cuentas
├── riesgo/                     # Matriz de riesgos de corrupción por institución
├── server.js                   # Servidor alternativo en Node.js para entornos Node
└── test_security_suite.js      # Suite automatizada de pruebas de seguridad (24/24)
```

---

## 3. Identidades Institucionales, Creación de Usuarios, Permisos y Contraseñas

### Cuentas Base Institucionales Protegidas
Por directriz institucional de la CNC, el portal cuenta con dos identidades operativas maestras preconfiguradas que están blindadas contra eliminación accidental o no autorizada:

| Usuario (Correo) | Rol Base | Contraseña Inicial | Mecanismo de Seguridad | Estado |
|---|---|---|---|---|
| `deteccionydenuncia@cnc.gob.gt` | Administrador Pleno | `12345` | Sal criptográfica PBKDF2/SHA-512 | Cuenta Base Protegida |
| `apoyogi@cnc.gob.gt` | Administrador Pleno | `12345` | Sal criptográfica PBKDF2/SHA-512 | Cuenta Base Protegida |

### Gestión Dinámica de Usuarios y Creación de Nuevas Cuentas
Desde el módulo **Gestión de Usuarios, Roles y Permisos** (`/admin/`), los administradores pueden crear nuevos usuarios institucionales haciendo clic en **"+ Agregar Nuevo Usuario"**:
1. **Validación y Encriptación Automática:** Se valida formato de correo institucional (`@cnc.gob.gt` o similar), nombre del funcionario y contraseña mínima de 4 caracteres. La contraseña es encriptada en el backend mediante derivación de clave **PBKDF2 con HMAC-SHA512** y sal aleatoria única de 16 bytes.
2. **Asignación Granular de Módulos:** El administrador puede seleccionar uno a uno los módulos a los que el usuario tendrá acceso (Canales, Directorio, Tableros, Riesgo, Métricas, Visitas, Usuarios, Auditoría, Base de Datos, Guía Técnica) o marcar **"Todos tienen permiso a todo"** por defecto.
3. **Roles Soportados:** `admin` (Administrador con privilegios completos) y `data_operator` (Operador de datos institucional con acceso restringido a los módulos autorizados).
4. **Protección de Cuentas Base:** Los nuevos usuarios pueden ser eliminados cuando concluya su gestión, mientras que las dos cuentas maestras institucionales cuentan con salvaguarda permanente a nivel de código y API.
5. **Cambio de Contraseña:** Cualquier usuario puede actualizar su clave desde el panel administrativo, regenerando la sal y hash en el almacenamiento persistente.

---

## 4. Catálogo Institucional Unificado (Canales por la Integridad)

El filtro por tipo de institución en la página pública de **Canales por la Integridad** (`/canales-por-la-integridad/`), el formulario de edición en el **Módulo Administrativo** (`/admin/`) y el archivo de datos (`data_directorio.json`) se encuentran **100% sincronizados**:

- **Catálogo Oficial:**
  1. `Ministerios` (14 instituciones ministeriales)
  2. `Secretarías` (15 secretarías y dependencias de apoyo presidencial)
  3. `Gobernaciones Departamentales` (22 gobernaciones departamentales de la República)
  4. `Otras dependencias` (Fondos sociales, comisiones ejecutivas y comités, ej. CNC, SAT)
  5. `Dependencias temporales` (Comisiones temporales y unidades transitorias)

- **Sincronización Bidireccional y Resiliencia:** El motor de filtrado detecta automáticamente cualquier variante histórica o institucional (ej. `Gobernaciones` ↔ `Gobernaciones Departamentales`), mapeándolos al catálogo oficial sin pérdida de datos ni discrepancias de filtrado.

---

## 5. Estado de Características Especiales

- **Chatbot (Asistente Virtual Lupita):** Inactivado de la interfaz visual del portal público por solicitud institucional (`CHATBOT_UI_ACTIVE = false`), manteniendo todo el código, componentes e integración con Gemini listos para reactivarse instantáneamente cuando la dirección lo disponga.
- **Guía Multilingüe de Denuncia Segura:** Inactivada y retirada de los elementos visibles de la interfaz (`#heroGuiaCTA`, selector en barra de accesibilidad y enlaces directos), preservando en el código todas las traducciones en idiomas mayas (K'iche', Q'eqchi', Kaqchikel, Mam), síntesis de voz y estructura para cuando deba volver a mostrarse.

---

## 6. Instrucciones de Despliegue para el Departamento de TI

### Opción A: Despliegue con Docker (Recomendado)

1. **Construir la imagen de contenedor:**
   ```bash
   docker build -t pia-portal:latest .
   ```

2. **Ejecutar el contenedor montando el volumen de datos persistentes:**
   ```bash
   docker run -d \
     --name pia-portal-app \
     -p 3000:3000 \
     -v /opt/pia/data:/app/data \
     --env-file .env \
     --restart unless-stopped \
     pia-portal:latest
   ```

### Opción B: Despliegue en Servidor Linux (Systemd + Gunicorn + Nginx)

1. **Instalar dependencias en el servidor:**
   ```bash
   sudo apt-get update && sudo apt-get install -y python3-pip python3-venv nginx
   ```

2. **Crear entorno virtual e instalar requerimientos:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Configurar servicio en Systemd (`/etc/systemd/system/pia.service`):**
   ```ini
   [Unit]
   Description=Portal de Integridad Activa (PIA) - CNC
   After=network.target

   [Service]
   User=www-data
   Group=www-data
   WorkingDirectory=/var/www/pia
   Environment="PATH=/var/www/pia/venv/bin"
   EnvironmentFile=/var/www/pia/.env
   ExecStart=/var/www/pia/venv/bin/gunicorn -c gunicorn.conf.py app:app
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

4. **Habilitar e iniciar el servicio:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable pia
   sudo systemctl start pia
   ```

5. **Configuración de Nginx Reverse Proxy (`/etc/nginx/sites-available/pia`):**
   ```nginx
   server {
       listen 80;
       server_name pia.gob.gt;
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name pia.gob.gt;

       ssl_certificate /etc/ssl/certs/pia_gob_gt.crt;
       ssl_certificate_key /etc/ssl/private/pia_gob_gt.key;

       # Cabeceras de seguridad institucional
       add_header X-Frame-Options "SAMEORIGIN" always;
       add_header X-Content-Type-Options "nosniff" always;
       add_header Referrer-Policy "strict-origin-when-cross-origin" always;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

---

### Opción C: Despliegue con Node.js + PM2 (Servidor Express)

1. **Instalar dependencias:**
   ```bash
   npm install --production
   ```

2. **Iniciar servicio en segundo plano con PM2:**
   ```bash
   npx pm2 start server.js --name "pia-portal" -i max
   npx pm2 save
   npx pm2 startup
   ```

### Opción D: Despliegue en Windows Server con IIS

1. Utilizar el script automatizado PowerShell provisto en la raíz:
   ```powershell
   .\deploy-iis.ps1
   ```
2. El archivo `web.config` preconfigurado en la raíz establece la reescritura de URLs hacia `http://localhost:3000` con compresión gzip y cabeceras de seguridad activas.

### Opción E: Modo Fuera de Línea / Descargado (Sin Backend)

El sistema cuenta con el motor de persistencia resiliente **PiaDataEngine**:
1. Si el portal se descarga o se ejecuta abriendo directamente `index.html` en un navegador (o mediante cualquier servidor estático liviano como `python3 -m http.server 8080`), el módulo administrativo detecta automáticamente el entorno estático.
2. Los datos se leen directamente de los archivos JSON locales y los cambios se almacenan en `localStorage` con bitácora de auditoría local.
3. No requiere Firebase ni dependencias externas para operar de forma completa.

---

## 7. Verificación de Seguridad y Pruebas Automatizadas

El proyecto incluye la suite completa de 28 pruebas de regresión y seguridad en `test_security_suite.js`.

Para verificar la integridad del portal:
```bash
node test_security_suite.js
```

**Resultado oficial:**
```text
=============================================================
RESUMEN DE PRUEBAS: 28 SUPERADAS / 0 FALLIDAS
=============================================================
```

Pruebas cubiertas:
- Rechazo estricto de accesos no autenticados en mutaciones (`POST`, `PUT`, `DELETE`).
- Bloqueo de path traversal (`../../`).
- Eliminación de credenciales genéricas/maestras no admitidas.
- Validación de persistencia, rotación de respaldos a 30 versiones y escrituras atómicas.
- Comprobación de endpoints públicos para visualización ciudadana (Canales, Directorio, Tableros, Riesgo, Vehículos).
- Creación dinámica de usuarios con encriptación PBKDF2/SHA-512 y asignación granular de módulos.
- Salvaguarda permanente de cuentas base institucionales contra borrado no autorizado.

---

## 8. Arquitectura Híbrida JSON + SQL (MySQL / MariaDB)

El Portal PIA soporta tres modalidades configurables sin modificar código fuente desde el panel administrativo (**Gestión de almacenamiento y base de datos**) o mediante `.env` (`PIA_STORAGE_MODE`):

1. **JSON (Predeterminado):** Mantiene la operación íntegra sobre los 5 archivos JSON del portal (`data_directorio.json`, `data_acceso.json`, `data_tableros.json`, `riesgo/datos.json`, `vehiculos/vehiculos.json`) y `data_portal.json`, totalmente funcional incluso sin motor SQL instalado.
2. **SQL (MySQL / MariaDB):** Persistencia relacional con transacciones ACID, consultas parametrizadas, llaves foráneas e índices definidos en `sql/01_schema_mysql.sql`.
3. **HÍBRIDO:** Selección por módulo (`json` o `sql`), manteniendo una única fuente autoritativa por módulo para evitar escrituras simultáneas conflictivas.

Para despliegue paso a paso en Windows Server + Node.js + MySQL/MariaDB, consulte `docs/GUIA_INSTALACION_WINDOWS_SQL.md`.

