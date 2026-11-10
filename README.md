# Portal de Integridad Activa (PIA)
### Comisión Nacional contra la Corrupción (CNC) — Guatemala

Versión de distribución basada en **Node.js + Express**. El servidor Express es el único backend de ejecución previsto para esta entrega. Los archivos históricos de Flask se conservan temporalmente para revisión y no forman parte del arranque oficial.

## Requisitos

- Node.js 22.9 o superior (recomendado Node.js 22 LTS).
- npm 10 o superior.
- Para contenedor: Docker Engine y Docker Compose v2.
- Un directorio de datos persistente, fuera de la carpeta pública del portal.

## Instalación local en Windows o Linux

1. Descargar o clonar el repositorio y abrir una terminal en la carpeta raíz.
2. Instalar dependencias:

   ```bash
   npm install
   ```

3. Crear la configuración local:

   **Windows PowerShell**
   ```powershell
   Copy-Item .env.example .env
   ```

   **Linux**
   ```bash
   cp .env.example .env
   chmod 600 .env
   ```

4. Editar `.env` y configurar obligatoriamente:
   - `PIA_SESSION_SECRET`: secreto aleatorio de al menos 64 caracteres.
   - `PIA_OPERATOR_1_PASSWORD` y `PIA_OPERATOR_2_PASSWORD`: contraseñas diferentes de al menos 14 caracteres.
   - `PIA_DATA_DIR`: directorio persistente fuera del proyecto. En Windows se recomienda `C:/PIA_Data`; en Linux, `/var/lib/pia/data`. El script `deploy-iis.ps1` prepara la carpeta de instalación, el directorio privado y las variables iniciales; la ejecución permanente del proceso Node y la configuración de ARR/IIS deben completarse según la política de TI.

   Para generar un secreto aleatorio con Node.js:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   No utilizar las contraseñas de ejemplo ni compartir el archivo `.env`. En Linux, limitar sus permisos al usuario del servicio.

5. Iniciar el servidor:

   ```bash
   npm start
   ```

6. Abrir el portal en `http://localhost:3000` y el panel administrativo en `http://localhost:3000/admin`.

En el primer arranque, si no existe el archivo de identidades en el directorio de datos, el servidor crea las dos cuentas institucionales únicamente si las dos contraseñas de inicialización están configuradas. Los hashes se almacenan en el directorio de datos. Si las variables no están configuradas, el sistema no crea usuarios ni permite iniciar sesión.

## Preparación en Windows Server con IIS

Desde PowerShell ejecutado como Administrador, en la carpeta del repositorio:

```powershell
.\deploy-iis.ps1 -InstallPath "C:\inetpub\wwwroot\PIA" -DataPath "C:\PIA_Data" -Port 3000
```

El script comprueba Node.js 22.9+, copia el código sin archivos operativos ni secretos, crea el directorio privado, solicita las dos contraseñas iniciales de forma protegida, genera el secreto de sesión y prepara las dependencias. No instala automáticamente un gestor de procesos ni habilita ARR: TI debe configurar el proceso Node persistente (por ejemplo, NSSM o PM2) y el proxy inverso IIS/ARR conforme a la infraestructura del servidor. El archivo `web.config` contiene las reglas de proxy previstas.

Para una prueba inicial, desde la carpeta de instalación y con el archivo `.env` ya creado:

```powershell
npm start
```

Verificar `http://localhost:3000/api/health` antes de publicar el sitio.

## Instalación con Docker Compose

1. Copiar `.env.example` como `.env` y completar las variables obligatorias descritas anteriormente. No cambiar `PIA_DATA_DIR`: el contenedor utiliza `/var/lib/pia/data`.
2. Construir e iniciar:

   ```bash
   docker compose up -d --build
   ```

3. Consultar el estado:

   ```bash
   docker compose ps
   docker compose logs -f pia
   ```

4. Abrir `http://localhost:3000`.

Los datos operativos se conservan en el volumen Docker `pia_data`, independiente del ciclo de vida del contenedor. Antes de actualizar o trasladar el servicio, realizar un respaldo del volumen.

## Configuración de entorno

| Variable | Obligatoria | Descripción |
|---|---:|---|
| `PORT` | No | Puerto HTTP local; por defecto 3000 (el contenedor siempre usa 3000 internamente) |
| `HOST_PORT` | No | Puerto publicado en el host por Docker Compose; por defecto 3000 |
| `PIA_SESSION_SECRET` | Sí | Secreto HMAC de 64 caracteres o más |
| `PIA_DATA_DIR` | No | Ruta del almacenamiento persistente privado |
| `PIA_OPERATOR_1_PASSWORD` | Para primer arranque | Contraseña inicial del operador DAGI (mínimo 14 caracteres) |
| `PIA_OPERATOR_2_PASSWORD` | Para primer arranque | Contraseña inicial de Apoyo GI (mínimo 14 caracteres, distinta de la primera) |
| `GEMINI_API_KEY` | No | Clave para habilitar respuestas con Gemini |
| `FIREBASE_PROJECT_ID` | No | Proyecto de Firebase cuando se habilite autenticación federada |

Las cuentas administrativas autorizadas son:
- `deteccionydenuncia@cnc.gob.gt`
- `apoyogi@cnc.gob.gt`

La autorización se valida en el servidor. Los permisos por módulo se comprueban en las rutas administrativas y no dependen únicamente de ocultar opciones del menú.

## Almacenamiento y seguridad

- Los archivos de identidad, bitácora, visitas y respaldos deben residir fuera del directorio público.
- El servidor exige `PIA_SESSION_SECRET`; no existe una clave de firma predeterminada.
- No hay autenticación administrativa offline ni sesión local aceptada sin validación del servidor.
- Las cuentas iniciales se generan con contraseñas configuradas en el entorno; no se distribuyen contraseñas maestras.
- Los archivos operativos no deben incorporarse al repositorio. Esto incluye `audit_logs.json`, `page_visits.json`, `authorized_operators.json` y `users_roles.json`. El repositorio incluye reglas de exclusión y el servidor bloquea la entrega estática de archivos operativos heredados.
- Publicar el portal detrás de HTTPS y un proxy inverso institucional. No exponer el puerto de administración a Internet sin controles de red, monitoreo y revisión de seguridad.
- La clave API de Firebase usada por aplicaciones web no equivale a una clave privada de servicio; debe restringirse desde Google/Firebase y las reglas del proyecto deben revisarse.

## Migración desde una instalación anterior

Antes de actualizar una instalación existente:

1. Detener el proceso anterior y realizar una copia de seguridad completa del directorio de datos.
2. Copiar al nuevo `PIA_DATA_DIR`, según corresponda, `users_roles.json`, `authorized_operators.json`, `audit_logs.json`, `page_visits.json` y la carpeta `backups/`.
3. No copiar estos archivos al repositorio ni al directorio público. Deben permanecer en el almacenamiento privado.
4. Configurar el nuevo `.env` con un secreto de sesión aleatorio. Si el sistema anterior utilizó el secreto predeterminado incluido en versiones antiguas del código, debe considerarse comprometido y sustituirse.
5. Iniciar el servidor y validar el acceso administrativo antes de retirar el respaldo.

Los hashes PBKDF2 heredados de 10,000 iteraciones se aceptan temporalmente para permitir la migración y se actualizan a 310,000 iteraciones después de una autenticación correcta.

## Pruebas

Con el servidor activo en el puerto 3000:

```bash
npm run check
npm test
```

La suite `test_security_suite.js` realiza solicitudes HTTP contra el servidor local. No ejecutar pruebas de escritura contra datos institucionales reales: utilizar un directorio de datos de prueba y credenciales temporales.

Comprobación de disponibilidad:

```bash
curl http://localhost:3000/api/health
```

Respuesta esperada: JSON con `status: "ok"`.

## Estructura principal

- `server.js`: backend Express, API, autenticación y autorización.
- `admin/`: panel administrativo.
- `canales-por-la-integridad/`, `directorio/`, `gobierno_en_numeros/`, `riesgo/`, `vehiculos/`: módulos del portal y sus recursos.
- `css/`, `js/`, `img/`: recursos estáticos activos del portal.
- `data/`: únicamente plantilla de ejemplo no operativa; Express bloquea su acceso HTTP. No guardar ahí datos reales ni credenciales.
- Las copias duplicadas de `static/`, las plantillas antiguas de Flask y el lockfile obsoleto de Bun se retiraron de esta distribución.
- `PIA_DATA_DIR`: datos operativos privados, fuera del repositorio y del directorio web.
- `Dockerfile` y `docker-compose.yml`: despliegue contenerizado.
- El backend Flask, sus dependencias y sus plantillas fueron retirados de esta rama. Node.js + Express es el único backend incluido en la distribución.

## Estado de validación

Esta rama contiene ajustes de distribución y seguridad en curso. La instalación, la suite completa, la persistencia y todos los flujos del panel administrativo deben probarse en un entorno aislado antes de fusionar los cambios en `main` o distribuir una versión institucional.
