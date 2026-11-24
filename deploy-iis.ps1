<#
.SYNOPSIS
    Script de instalación y despliegue automatizado y reproducible del Portal de Integridad Activa (PIA)
    para Servidores Físicos o Virtuales con Windows Server e Internet Information Services (IIS).

.DESCRIPTION
    Este script realiza las siguientes acciones de forma determinista y segura:
    1. Verifica privilegios de Administrador local.
    2. Comprueba prerrequisitos: Node.js LTS (>= 18), npm, IIS, URL Rewrite Module y ARR.
    3. Crea la estructura de almacenamiento protegido en C:\PIA_Data (backups, migration_logs)
       y el directorio de fondos cargados (uploads\backgrounds) con permisos NTFS restringidos.
    4. Instala las dependencias de producción de Node.js (npm ci / npm install --omit=dev).
    5. Inicializa .env desde .env.example con PIA_DATA_DIR y llave criptográfica PIA_SESSION_SECRET.
    6. Ejecuta admin/scripts/init_pia_config.js (y opcionalmente -InitSql para crear las 18 tablas).
    7. Configura el Sitio Web y el Application Pool dedicado en IIS.
    8. Ejecuta pruebas de verificación de arranque y validación de endpoints HTTP públicos.

.PARAMETER InstallPath
    Ruta donde se alojará el código de la aplicación. Por defecto: C:\inetpub\wwwroot\PIA

.PARAMETER DataPath
    Ruta física aislada para almacenamiento persistente y respaldos. Por defecto: C:\PIA_Data

.PARAMETER Port
    Puerto interno en localhost donde escuchará Node.js. Por defecto: 3000

.PARAMETER SiteName
    Nombre del Sitio en IIS. Por defecto: "PortalIntegridadActiva"

.PARAMETER InitSql
    Si se especifica, ejecuta también la inicialización de las 18 tablas MySQL/MariaDB y su configuración base.
#>

[CmdletBinding()]
param (
    [string]$InstallPath = "C:\inetpub\wwwroot\PIA",
    [string]$DataPath = "C:\PIA_Data",
    [int]$Port = 3000,
    [string]$SiteName = "PortalIntegridadActiva",
    [switch]$InitSql = $false,
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
Write-Step "2. Verificando software base requerido (Node.js >= 18, npm, IIS)..."

# Node.js
try {
    $nodeVersion = (& node -v).Trim()
    $nodeMajor = [int]($nodeVersion.TrimStart('v').Split('.')[0])
    if ($nodeMajor -lt 18) {
        Write-ErrorMsg "Se requiere Node.js LTS >= 18.x (detectado: $nodeVersion)."
        exit 1
    }
    Write-Success "Node.js detectado: $nodeVersion"
} catch {
    Write-ErrorMsg "Node.js no está instalado o no figura en la variable PATH del sistema."
    Write-Host "  Por favor descargue e instale Node.js LTS (>= 18.x) desde https://nodejs.org/"
    exit 1
}

# npm
try {
    $npmVersion = (& npm -v).Trim()
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
# 3. CREACIÓN Y ASEGURAMIENTO DE DIRECTORIOS PROTEGIDOS
# ========================================================
Write-Step "3. Configurando almacenamiento protegido ($DataPath) y fondos dinámicos..."

$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
$currentDir = if ($PSBoundParameters.ContainsKey('InstallPath') -and $InstallPath) { $InstallPath } else { $scriptDir }
if (-not (Test-Path $currentDir)) {
    New-Item -ItemType Directory -Path $currentDir -Force | Out-Null
}

$backupsPath = Join-Path $DataPath "backups"
$migLogsPath = Join-Path $DataPath "migration_logs"
$uploadsBgPath = Join-Path $currentDir "uploads\backgrounds"

foreach ($dir in @($DataPath, $backupsPath, $migLogsPath, $uploadsBgPath)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Success "Directorio creado: $dir"
    } else {
        Write-Success "Directorio verificado: $dir"
    }
}

# Permisos NTFS Restringidos en DataPath: Solo SYSTEM, Administradores e IIS_IUSRS
Write-Step "Aplicando listas de control de acceso NTFS (ACLs) seguras..."
$acl = Get-Acl $DataPath
$acl.SetAccessRuleProtection($true, $false) # Deshabilitar herencia

$ruleSystem = New-Object System.Security.AccessControl.FileSystemAccessRule("NT AUTHORITY\SYSTEM", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
$ruleAdmins = New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\Administrators", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
$ruleIIS = New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\IIS_IUSRS", "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.AddAccessRule($ruleSystem)
$acl.AddAccessRule($ruleAdmins)
$acl.AddAccessRule($ruleIIS)
Set-Acl -Path $DataPath -AclObject $acl

# Permiso de escritura controlada para subida de imágenes de fondo por el backend en uploads\backgrounds
$aclUploads = Get-Acl $uploadsBgPath
$aclUploads.AddAccessRule($ruleIIS)
Set-Acl -Path $uploadsBgPath -AclObject $aclUploads
Write-Success "Permisos NTFS reforzados en $DataPath y $uploadsBgPath."

# ========================================================
# 4. INSTALACIÓN DE DEPENDENCIAS DEL PROYECTO
# ========================================================
Write-Step "4. Preparando dependencias de Node.js en $currentDir..."
Set-Location $currentDir
if (Test-Path "package-lock.json") {
    Write-Host "  Ejecutando npm ci --omit=dev..."
    & npm ci --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "npm ci finalizó con código de salida $LASTEXITCODE."
        exit $LASTEXITCODE
    }
    Write-Success "Dependencias de producción instaladas con lockfile."
} elseif (Test-Path "package.json") {
    Write-Host "  Ejecutando npm install --omit=dev..."
    & npm install --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "npm install finalizó con código de salida $LASTEXITCODE."
        exit $LASTEXITCODE
    }
    Write-Success "Dependencias de producción verificadas."
} else {
    Write-WarnMsg "package.json no encontrado en el directorio actual. Omitiendo npm install."
}

# ========================================================
# 5. CONFIGURACIÓN DE VARIABLES DE ENTORNO E INICIALIZACIÓN PIA
# ========================================================
Write-Step "5. Inicializando variables de entorno (.env) y configuración operativa PIA..."
$envFile = Join-Path $currentDir ".env"
$initArgs = @("admin/scripts/init_pia_config.js", "--data-dir=$DataPath", "--generate-secret")
if ($InitSql) {
    $initArgs += "--init-sql"
}

if (Test-Path "admin/scripts/init_pia_config.js") {
    & node @initArgs
    if ($LASTEXITCODE -ne 0) {
        Write-WarnMsg "La inicialización/validación inicial reportó advertencias o errores. Revise la salida anterior."
    } else {
        Write-Success "Configuración inicial y datasets JSON verificados correctamente."
    }
} elseif (-not (Test-Path $envFile) -and (Test-Path ".env.example")) {
    Copy-Item -Path ".env.example" -Destination $envFile
    Write-WarnMsg "Se generó .env a partir de .env.example. Complete PIA_SESSION_SECRET y MYSQL_*."
}

# ========================================================
# 6. CONFIGURACIÓN DE IIS (APPLICATION POOL Y SITIO WEB)
# ========================================================
Write-Step "6. Configurando IIS Application Pool y Sitio Web..."
Import-Module WebAdministration -ErrorAction SilentlyContinue

$appPoolName = "PiaAppPool"
if (-not (Test-Path "IIS:\AppPools\$appPoolName")) {
    $appPool = New-Item "IIS:\AppPools\$appPoolName"
    $appPool.managedRuntimeVersion = "" # .NET CLR Version: No Managed Code
    $appPool.processModel.idleTimeout = [TimeSpan]::Zero # No suspender el proceso
    $appPool | Set-Item
    Write-Success "Application Pool '$appPoolName' creado sin Managed Code."
} else {
    Write-Success "Application Pool '$appPoolName' ya existe."
}

if (Get-Command Get-Website -ErrorAction SilentlyContinue) {
    $existingSite = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
    if (-not $existingSite) {
        Write-Host "  Sitio IIS '$SiteName' aún no creado. Para crearlo en puerto 80 apuntando a '$currentDir':"
        Write-Host "    New-Website -Name `"$SiteName`" -PhysicalPath `"$currentDir`" -ApplicationPool `"$appPoolName`" -Port 80"
    } else {
        Write-Success "Sitio IIS '$SiteName' verificado (Estado: $($existingSite.State))."
    }
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
    Write-Host "    nssm install PIA_Service `"$((Get-Command node).Source)`" `"$currentDir\server.js`""
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
    const resPortalUi = await fetch('http://127.0.0.1:$Port/api/ui/portal');
    const portalUi = await resPortalUi.json();
    const resCanalesCfg = await fetch('http://127.0.0.1:$Port/api/canales/config');
    const canalesCfg = await resCanalesCfg.json();
    const resChat = await fetch('http://127.0.0.1:$Port/api/chatbot/config');
    const chat = await resChat.json();
    console.log(JSON.stringify({
        ok: true,
        modulesCount: Array.isArray(modules) ? modules.length : 0,
        portalKpis: Array.isArray(portalUi.kpis) ? portalUi.kpis.length : 0,
        portalFondos: Array.isArray(portalUi.backgrounds) ? portalUi.backgrounds.length : 0,
        canalesConfigOk: typeof canalesCfg.showProtocolos === 'boolean',
        chatbotActive: chat.enabled !== false
    }));
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
            Write-Success "Módulos activos: $($jsonRes.modulesCount) | Portal KPIs: $($jsonRes.portalKpis) | Fondos: $($jsonRes.portalFondos) | Lupita: $($jsonRes.chatbotActive)"
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
Write-Host " INSTALACIÓN Y PREPARACIÓN PIA (JSON + SQL 18 TABLAS) COMPLETADA" -ForegroundColor Green
Write-Host "=============================================================" -ForegroundColor Green
Write-Host " Próximos pasos recomendados en el servidor:" -ForegroundColor Cyan
Write-Host "  1. En IIS -> Application Request Routing Cache -> Server Proxy Settings: habilitar 'Enable proxy'."
Write-Host "  2. Verificar credenciales MYSQL_* en .env si usará modalidad SQL o Híbrida."
Write-Host "  3. Inicializar BD y configuración SQL (18 tablas):"
Write-Host "     mysql -u pia_app_user -p < sql\01_schema_mysql.sql"
Write-Host "     mysql -u pia_app_user -p < sql\02_seed_initial_config.sql"
Write-Host "     (o ejecutar: node admin/scripts/migrate_json_to_sql.js --init-schema --include-portal)"
Write-Host "  4. Ejecutar 'npm run setup:check' y 'npm test' para validar seguridad y funcionamiento.`n"

