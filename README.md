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

## 3. Identidades Institucionales, Permisos y Contraseñas

Por directriz de seguridad de la CNC, el acceso administrativo está restringido exclusivamente a **dos identidades operativas institucionales**:

| Usuario (Correo) | Rol por Defecto | Contraseña Inicial | Mecanismo de Seguridad |
|---|---|---|---|
| `deteccionydenuncia@cnc.gob.gt` | Administrador Pleno | `12345` | Sal PBKDF2/SHA-512 inmutable |
| `apoyogi@cnc.gob.gt` | Administrador Pleno | `12345` | Sal PBKDF2/SHA-512 inmutable |

### Control de Permisos por Módulo desde el Administrador
1. **Acceso a Todos los Módulos por Defecto:** Ambos usuarios disponen inicialmente de permisos completos para:
   - Canales por la Integridad (`canales`)
   - Directorio Acceso al Ejecutivo (`directorio`)
   - Tu Gobierno en Números (`tableros`)
   - Riesgo en la Mira (`riesgo`)
   - Métricas y Estadísticas del Portal (`portal`)
   - Contador de Visitas Reales (`visits`)
   - Asistente Virtual Lupita (`chatbot`)
   - Gestión de Usuarios y Permisos (`users`)
   - Bitácora de Auditoría (`audit`)
   - Mantenimiento de Base de Datos y Respaldos (`database`)
   - Guía Técnica del Sistema (`guide`)
2. **Personalización de Permisos:** Desde el módulo **Usuarios y Permisos**, el administrador puede marcar o desmarcar módulos específicos para cada usuario y guardar la configuración en tiempo real (`PUT /api/admin/users/:email/permissions`).
3. **Cambio de Contraseña desde el Administrador:** El botón **Cambiar Contraseña** en la tarjeta de cada usuario abre el diálogo de actualización segura, encriptando la nueva contraseña en el backend con una nueva sal criptográfica de 128 bits (`PUT /api/admin/users/:email/password`).

---

## 4. Estado de Características Especiales

- **Chatbot (Asistente Virtual Lupita):** Inactivado de la interfaz visual del portal público por solicitud institucional (`CHATBOT_UI_ACTIVE = false`), manteniendo todo el código, componentes e integración con Gemini listos para reactivarse instantáneamente cuando la dirección lo disponga.
- **Guía Multilingüe de Denuncia Segura:** Inactivada y retirada de los elementos visibles de la interfaz (`#heroGuiaCTA`, selector en barra de accesibilidad y enlaces directos), preservando en el código todas las traducciones en idiomas mayas (K'iche', Q'eqchi', Kaqchikel, Mam), síntesis de voz y estructura para cuando deba volver a mostrarse.

---

## 5. Instrucciones de Despliegue para el Departamento de TI

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

## 6. Verificación de Seguridad y Pruebas Automatizadas

El proyecto incluye la suite completa de 24 pruebas de regresión y seguridad en `test_security_suite.js`.

Para verificar la integridad del portal:
```bash
node test_security_suite.js
```

**Resultado esperado:**
```text
=============================================================
RESUMEN DE PRUEBAS: 24 SUPERADAS / 0 FALLIDAS
=============================================================
```

Pruebas cubiertas:
- Rechazo estricto de accesos no autenticados en mutaciones (`POST`, `PUT`, `DELETE`).
- Bloqueo de path traversal (`../../`).
- Eliminación de credenciales genéricas/maestras no admitidas.
- Validación de persistencia, rotación de respaldos a 30 versiones y escrituras atómicas.
- Comprobación de endpoints públicos para visualización ciudadana.
