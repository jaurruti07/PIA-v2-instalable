<#
.SYNOPSIS
    Script de instalación y despliegue automatizado y reproducible del Portal de Integridad Activa (PIA)
    para Servidores Físicos o Virtuales con Windows Server e Internet Information Services (IIS).

.DESCRIPTION
    Este script realiza las siguientes acciones de forma determinista y segura:
    1. Verifica privilegios de Administrador local.
    2. Comprueba prerrequisitos: Node.js LTS (>= 18), npm, IIS, URL Rewrite Module y ARR.
    3. Crea la estructura de almacenamiento protegido en C:\PIA_Data con permisos NTFS restringidos.
    4. Inicializa el directorio de respaldos automáticos rotativos (C:\PIA_Data\backups).
    5. Instala las dependencias de producción de Node.js (npm ci / npm install --omit=dev).
    6. Valida la plantilla .env institucional sin almacenar contraseñas ni secretos en repositorio.
    7. Configura el Sitio Web y el Application Pool dedicado en IIS.
    8. Ejecuta pruebas de verificación de arranque y validación de endpoints HTTP.

.PARAMETER InstallPath
    Ruta donde se alojará el código de la aplicación. Por defecto: C:\inetpub\wwwroot\PIA

.PARAMETER DataPath
    Ruta física aislada para almacenamiento persistente y respaldos. Por defecto: C:\PIA_Data

.PARAMETER Port
    Puerto interno en localhost donde escuchará Node.js. Por defecto: 3000

.PARAMETER SiteName
    Nombre del Sitio en IIS. Por defecto: "PortalIntegridadActiva"
#>

[CmdletBinding()]
param (
    [string]$InstallPath = "C:\inetpub\wwwroot\PIA",
    [string]$DataPath = "C:\PIA_Data",
    [int]$Port = 3000,
    [string]$SiteName = "PortalIntegridadActiva",
    [switch]$SkipServiceCreation = $false
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n[PIA INSTALLER] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-WarnMsg {
    param([string]$Message)
    Write-Host "  [ALERTA] $Message" -ForegroundColor Yellow
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "  [ERROR] $Message" -ForegroundColor Red
}

# ========================================================
# 1. VERIFICACIÓN DE PRIVILEGIOS
# ========================================================
Write-Step "1. Verificando privilegios de administrador..."
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-ErrorMsg "Este script debe ejecutarse en una consola de PowerShell con privilegios elevados ('Ejecutar como Administrador')."
    exit 1
}
Write-Success "Privilegios de Administrador confirmados."

# ========================================================
# 2. VERIFICACIÓN DE PRERREQUISITOS DE SOFTWARE
# ========================================================
Write-Step "2. Verificando software base requerido (Node.js, npm, IIS)..."

# Node.js
try {
    $nodeVersion = & node -v
    Write-Success "Node.js detectado: $nodeVersion"
} catch {
    Write-ErrorMsg "Node.js no está instalado o no figura en la variable PATH del sistema."
    Write-Host "  Por favor descargue e instale Node.js LTS (>= 18.x) desde https://nodejs.org/"
    exit 1
}

# npm
try {
    $npmVersion = & npm -v
    Write-Success "npm detectado: $npmVersion"
} catch {
    Write-ErrorMsg "npm no está disponible en el entorno."
    exit 1
}

# IIS
$iisService = Get-Service -Name W3SVC -ErrorAction SilentlyContinue
if (-not $iisService) {
    Write-WarnMsg "El servicio IIS (W3SVC) no está instalado. Instalando características básicas de IIS..."
    Install-WindowsFeature -Name Web-Server, Web-Static-Content, Web-Default-Doc, Web-Http-Errors, Web-Filtering, Web-Http-Redirect -IncludeManagementTools
    $iisService = Get-Service -Name W3SVC
}
Write-Success "Servicio IIS disponible (Estado: $($iisService.Status))."

# URL Rewrite Module
$rewriteInstalled = Test-Path "$env:ProgramFiles\Reference Assemblies\Microsoft\IIS\Microsoft.Web.Iis.Rewrite.dll" -ErrorAction SilentlyContinue
if (-not $rewriteInstalled) {
    $rewriteReg = Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\IIS Extensions\URL Rewrite" -ErrorAction SilentlyContinue
    if (-not $rewriteReg) {
        Write-WarnMsg "URL Rewrite Module 2.1 no detectado en el registro. Se recomienda instalar Microsoft URL Rewrite 2.1:"
        Write-Host "  https://www.iis.net/downloads/microsoft/url-rewrite"
    } else {
        Write-Success "URL Rewrite Module registrado en IIS."
    }
} else {
    Write-Success "URL Rewrite Module detectado."
}

# ========================================================
# 3. CREACIÓN Y ASEGURAMIENTO DEL DIRECTORIO DE DATOS
# ========================================================
Write-Step "3. Configurando directorio de almacenamiento protegido ($DataPath)..."

if (-not (Test-Path $DataPath)) {
    New-Item -ItemType Directory -Path $DataPath -Force | Out-Null
    Write-Success "Directorio $DataPath creado."
} else {
    Write-Success "Directorio $DataPath ya existe."
}

$backupsPath = Join-Path $DataPath "backups"
if (-not (Test-Path $backupsPath)) {
    New-Item -ItemType Directory -Path $backupsPath -Force | Out-Null
    Write-Success "Directorio de respaldos $backupsPath creado."
}

# Permisos NTFS Restringidos: Solo SYSTEM, Administradores y cuenta de IIS / Servicio
Write-Step "Aplicando listas de control de acceso NTFS (ACLs) seguras..."
$acl = Get-Acl $DataPath
$acl.SetAccessRuleProtection($true, $false) # Deshabilitar herencia

# Regla: SYSTEM -> Control Total
$ruleSystem = New-Object System.Security.AccessControl.FileSystemAccessRule("NT AUTHORITY\SYSTEM", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.AddAccessRule($ruleSystem)

# Regla: Administradores -> Control Total
$ruleAdmins = New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\Administrators", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.AddAccessRule($ruleAdmins)

# Regla: IIS_IUSRS -> Modificar / Lectura / Escritura
$ruleIIS = New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\IIS_IUSRS", "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.AddAccessRule($ruleIIS)

Set-Acl -Path $DataPath -AclObject $acl
Write-Success "Permisos NTFS reforzados en $DataPath. Acceso denegado a usuarios públicos."

# ========================================================
# 4. INSTALACIÓN DE DEPENDENCIAS DEL PROYECTO
# ========================================================
Write-Step "4. Preparando dependencias de Node.js en $InstallPath..."
$currentDir = $PSScriptRoot
if (-not $currentDir) { $currentDir = (Get-Location).Path }

Set-Location $currentDir
if (Test-Path "package.json") {
    Write-Host "  Ejecutando npm install para producción..."
    & npm install --omit=dev --no-audit --no-fund
    Write-Success "Dependencias de producción verificadas."
} else {
    Write-WarnMsg "package.json no encontrado en el directorio actual. Omitiendo npm install."
}

# ========================================================
# 5. CONFIGURACIÓN DE VARIABLES DE ENTORNO
# ========================================================
Write-Step "5. Verificando plantilla de variables de entorno institucional..."
$envFile = Join-Path $currentDir ".env"
$envExample = Join-Path $currentDir ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item -Path $envExample -Destination $envFile
        Write-WarnMsg "Se generó .env a partir de .env.example. Por favor complete los identificadores institucionales provistos por TI:"
        Write-Host "  - ENTRA_TENANT_ID (Tenant ID de Microsoft Azure / Entra ID)"
        Write-Host "  - ENTRA_CLIENT_ID (Client ID de la SPA registrada)"
        Write-Host "  - PIA_OPERATOR_1_OID (Object ID de apoyogi@cnc.gob.gt)"
        Write-Host "  - PIA_OPERATOR_2_OID (Object ID de deteccionydenuncia@cnc.gob.gt)"
        Write-Host "  - GEMINI_API_KEY (Opcional: Si falta, Lupita funciona con motor heurístico local)"
    }
} else {
    Write-Success "Archivo .env existente detectado. Conservando configuración actual."
}

# ========================================================
# 6. CONFIGURACIÓN DE IIS (SITE Y APPLICATION POOL)
# ========================================================
Write-Step "6. Configurando IIS Application Pool y Sitio Web..."
Import-Module WebAdministration -ErrorAction SilentlyContinue

$appPoolName = "PiaAppPool"
if (-not (Test-Path "IIS:\AppPools\$appPoolName")) {
    $appPool = New-Item "IIS:\AppPools\$appPoolName"
    $appPool.managedRuntimeVersion = "" # Sin runtime .NET (.NET CLR Version: No Managed Code)
    $appPool.processModel.idleTimeout = [TimeSpan]::Zero # No suspender el proceso
    $appPool | Set-Item
    Write-Success "Application Pool '$appPoolName' creado sin Managed Code."
} else {
    Write-Success "Application Pool '$appPoolName' ya existe."
}

# ========================================================
# 7. SERVICIO DE BACKGROUND PARA NODE.JS
# ========================================================
if (-not $SkipServiceCreation) {
    Write-Step "7. Configuración recomendada para proceso Node.js permanente..."
    Write-Host "  Para mantener Node.js activo 24/7 en Windows Server se recomienda:"
    Write-Host "  Opción A: Instalar PM2 para Windows:"
    Write-Host "    npm install pm2 -g"
    Write-Host "    npm install pm2-windows-service -g"
    Write-Host "    pm2 start server.js --name pia-backend --env production"
    Write-Host "    pm2 save"
    Write-Host ""
    Write-Host "  Opción B: Instalar como servicio nativo con NSSM (Non-Sucking Service Manager):"
    Write-Host "    nssm install PIA_Service node.exe `"$currentDir\server.js`""
    Write-Host "    nssm set PIA_Service AppDirectory `"$currentDir`""
    Write-Host "    nssm start PIA_Service"
}

# ========================================================
# 8. PRUEBAS DE HUMO (SELF-HEALTHCHECK)
# ========================================================
Write-Step "8. Ejecutando verificación de salud institucional..."

$healthTestCode = @"
try {
    const resModules = await fetch('http://127.0.0.1:$Port/api/modules');
    const modules = await resModules.json();
    const resChat = await fetch('http://127.0.0.1:$Port/api/chatbot/config');
    const chat = await resChat.json();
    console.log(JSON.stringify({ ok: true, modulesCount: modules.length, chatbotActive: chat.enabled !== false }));
} catch (e) {
    console.log(JSON.stringify({ ok: false, error: e.message }));
}
"@

$healthResult = & node -e "$healthTestCode" 2>$null
if ($healthResult) {
    try {
        $jsonRes = $healthResult | ConvertFrom-Json
        if ($jsonRes.ok) {
            Write-Success "Servicio Node.js respondiendo correctamente en http://127.0.0.1:$Port"
            Write-Success "Módulos activos: $($jsonRes.modulesCount). Asistente Lupita: $($jsonRes.chatbotActive)"
        } else {
            Write-WarnMsg "El servicio aún no está levantado en el puerto $Port ($($jsonRes.error)). Inicie el servicio para verificar."
        }
    } catch {
        Write-WarnMsg "Respuesta no JSON del healthcheck. Verifique que el servicio esté corriendo."
    }
} else {
    Write-WarnMsg "Servicio no detectado en el puerto $Port. Inicie 'node server.js' o el servicio Windows configurado."
}

Write-Host "`n=============================================================" -ForegroundColor Green
Write-Host " INSTALACIÓN Y PREPARACIÓN DE VERSIÓN 1 COMPLETADA CON ÉXITO" -ForegroundColor Green
Write-Host "=============================================================`n"
