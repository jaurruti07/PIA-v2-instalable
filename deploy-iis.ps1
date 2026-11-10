<#
.SYNOPSIS
    Script de instalación y despliegue automatizado y reproducible del Portal de Integridad Activa (PIA)
    para Servidores Físicos o Virtuales con Windows Server e Internet Information Services (IIS).

.DESCRIPTION
    Este script realiza las siguientes acciones de forma determinista y segura:
    1. Verifica privilegios de Administrador local.
    2. Comprueba prerrequisitos: Node.js LTS (>= 22.9), npm, IIS, URL Rewrite Module y ARR.
    3. Crea la estructura de almacenamiento protegido en C:\PIA_Data con permisos NTFS restringidos.
    4. Inicializa el directorio de respaldos automáticos rotativos (C:\PIA_Data\backups).
    5. Instala las dependencias de producción de Node.js (npm ci / npm install --omit=dev).
    6. Valida la plantilla .env institucional sin almacenar contraseñas ni secretos en repositorio.
    7. Prepara un Application Pool dedicado; la creación del sitio y la habilitación de ARR se completan según la política de TI.
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
    $nodeVersion = & node -p "process.versions.node"
    if ([version]$nodeVersion -lt [version]"22.9.0") {
        throw "Se requiere Node.js 22.9 o superior. Versión detectada: $nodeVersion"
    }
    Write-Success "Node.js compatible detectado: v$nodeVersion"
} catch {
    Write-ErrorMsg $_.Exception.Message
    Write-Host "  Instale Node.js LTS 22.9 o superior desde https://nodejs.org/"
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
# 4. COPIA DEL PROYECTO E INSTALACIÓN DE DEPENDENCIAS
# ========================================================
Write-Step "4. Preparando la instalación en $InstallPath..."

$sourceDir = $PSScriptRoot
if (-not $sourceDir) { $sourceDir = (Get-Location).Path }
$sourceFullPath = [System.IO.Path]::GetFullPath($sourceDir)
$installFullPath = [System.IO.Path]::GetFullPath($InstallPath)

if (-not (Test-Path $installFullPath)) {
    New-Item -ItemType Directory -Path $installFullPath -Force | Out-Null
}

if ($sourceFullPath.TrimEnd('\') -ne $installFullPath.TrimEnd('\')) {
    Get-ChildItem -Path $sourceFullPath -Force |
        Where-Object { $_.Name -notin @('.git', 'node_modules', 'data', 'uploads', '.env') } |
        ForEach-Object { Copy-Item -Path $_.FullName -Destination $installFullPath -Recurse -Force }
    Write-Success "Archivos de aplicación copiados a $installFullPath."
} else {
    Write-Success "El script se ejecuta directamente desde el directorio de instalación."
}

$currentDir = $installFullPath
Set-Location $currentDir

if ($Port -lt 1024 -or $Port -gt 65535) {
    throw "El puerto de Node debe estar entre 1024 y 65535."
}
$webConfigPath = Join-Path $currentDir "web.config"
if (Test-Path $webConfigPath) {
    $webConfigContent = Get-Content -Path $webConfigPath -Raw
    $webConfigContent = [regex]::Replace($webConfigContent, '127\.0\.0\.1:\d+', "127.0.0.1:$Port")
    [System.IO.File]::WriteAllText($webConfigPath, $webConfigContent, [System.Text.UTF8Encoding]::new($false))
}

if (-not (Test-Path (Join-Path $currentDir "package.json"))) {
    throw "No se encontró package.json en $currentDir."
}
Write-Host "  Instalando dependencias de producción..."
& npm install --omit=dev --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "Falló npm install. Revise la conexión y las dependencias." }
Write-Success "Dependencias de producción instaladas."

# 5. CONFIGURACIÓN DE VARIABLES DE ENTORNO
# ========================================================
Write-Step "5. Configurando secretos y credenciales iniciales..."

$envFile = Join-Path $currentDir ".env"
$dataPathEnv = $DataPath -replace '\\', '/'

if (-not (Test-Path $envFile)) {
    Write-Host "  Se solicitarán dos contraseñas distintas de al menos 14 caracteres."
    $secure1 = Read-Host "Contraseña inicial de deteccionydenuncia@cnc.gob.gt" -AsSecureString
    $secure2 = Read-Host "Contraseña inicial de apoyogi@cnc.gob.gt" -AsSecureString
    $ptr1 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure1)
    $ptr2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure2)
    try {
        $password1 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr1)
        $password2 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr2)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr1)
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr2)
    }

    if ($password1.Length -lt 14 -or $password2.Length -lt 14 -or $password1 -eq $password2) {
        throw "Las contraseñas deben ser diferentes y contener al menos 14 caracteres."
    }
    if ($password1 -notmatch '^[A-Za-z0-9!@#$%^&*()_+=-]{14,256}$' -or $password2 -notmatch '^[A-Za-z0-9!@#$%^&*()_+=-]{14,256}$') {
        throw "Use contraseñas de 14 a 256 caracteres con letras, números y símbolos comunes; no incluya espacios ni comillas."
    }

    $sessionSecret = & node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
    $envLines = @(
        "NODE_ENV=production",
        "PORT=$Port",
        "PIA_DATA_DIR=$dataPathEnv",
        "PIA_SESSION_SECRET=$sessionSecret",
        "PIA_OPERATOR_1_PASSWORD=$password1",
        "PIA_OPERATOR_2_PASSWORD=$password2",
        "PIA_OPERATOR_1_NAME=Dirección de Apoyo en la Gestión de Irregularidades - DAGI",
        "PIA_OPERATOR_2_NAME=Apoyo a la Gestión de Irregularidades (CNC)",
        "FIREBASE_PROJECT_ID=pia-portal-integridad",
        "GEMINI_API_KEY="
    )
    [System.IO.File]::WriteAllLines($envFile, $envLines, [System.Text.UTF8Encoding]::new($false))
    $password1 = $null
    $password2 = $null
    Write-Success "Archivo .env generado con secreto aleatorio y credenciales iniciales."
} else {
    Write-Success "Archivo .env existente detectado. Conservando sus credenciales."
    $envContent = Get-Content -Path $envFile -Raw
    if ($envContent -notmatch '(?m)^PIA_SESSION_SECRET=.{64,}$') {
        throw "PIA_SESSION_SECRET no está configurado con al menos 64 caracteres. Corrija .env antes de continuar."
    }
    if ($envContent -notmatch '(?m)^PIA_OPERATOR_1_PASSWORD=.{14,}$' -or $envContent -notmatch '(?m)^PIA_OPERATOR_2_PASSWORD=.{14,}$') {
        Write-WarnMsg "Las contraseñas iniciales no están completas. Si ya existe users_roles.json, puede retirar estas variables; de lo contrario, defínalas antes del primer arranque."
    }
    if ($envContent -match '(?m)^PORT=.*    [System.IO.File]::WriteAllText($envFile, $envContent, [System.Text.UTF8Encoding]::new($false))
}

# Restringir lectura del archivo de secretos.
$envAcl = New-Object System.Security.AccessControl.FileSecurity
$envAcl.SetAccessRuleProtection($true, $false)
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("NT AUTHORITY\SYSTEM", "FullControl", "Allow")))
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\Administrators", "FullControl", "Allow")))
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\IIS_IUSRS", "Read", "Allow")))
Set-Acl -Path $envFile -AclObject $envAcl
Write-Success "Permisos NTFS del archivo .env restringidos."

# 6. CONFIGURACIÓN DE IIS (SITE Y APPLICATION POOL)
# ========================================================
Write-Step "6. Preparando IIS Application Pool..."
Import-Module WebAdministration -ErrorAction SilentlyContinue

$appPoolName = "PiaAppPool"
if (-not (Test-Path "IIS:\AppPools\$appPoolName")) {
    $appPool = New-Item "IIS:\AppPools\$appPoolName"
    $appPool.managedRuntimeVersion = "" # Sin runtime .NET (.NET CLR Version: No Managed Code)
    $appPool.processModel.idleTimeout = [TimeSpan]::Zero # No suspender el proceso
    $appPool | Set-Item
    Write-Success "Application Pool $appPoolName creado sin Managed Code."
} else {
    Write-Success "Application Pool $appPoolName ya existe."
}

# ========================================================
# 7. SERVICIO DE BACKGROUND PARA NODE.JS
# ========================================================
if (-not $SkipServiceCreation) {
    Write-Step "7. Configuración recomendada para proceso Node.js permanente..."
    Write-Host "  Asocie el sitio IIS a $currentDir y configure ARR/URL Rewrite según web.config." 
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
    const resHealth = await fetch('http://127.0.0.1:$Port/api/health');
    const health = await resHealth.json();
    const resChat = await fetch('http://127.0.0.1:$Port/api/chatbot/config');
    const chat = await resChat.json();
    console.log(JSON.stringify({ ok: resHealth.ok && health.status === 'ok', service: health.service, chatbotActive: chat.enabled !== false }));
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
            Write-Success "Backend Express saludable. Asistente Lupita: $($jsonRes.chatbotActive)"
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
Write-Host " PREPARACIÓN DEL ENTORNO PIA COMPLETADA" -ForegroundColor Green
Write-Host "=============================================================`n"
) {
        $envContent = [regex]::Replace($envContent, '(?m)^PORT=.*    [System.IO.File]::WriteAllText($envFile, $envContent, [System.Text.UTF8Encoding]::new($false))
}

# Restringir lectura del archivo de secretos.
$envAcl = New-Object System.Security.AccessControl.FileSecurity
$envAcl.SetAccessRuleProtection($true, $false)
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("NT AUTHORITY\SYSTEM", "FullControl", "Allow")))
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\Administrators", "FullControl", "Allow")))
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\IIS_IUSRS", "Read", "Allow")))
Set-Acl -Path $envFile -AclObject $envAcl
Write-Success "Permisos NTFS del archivo .env restringidos."

# 6. CONFIGURACIÓN DE IIS (SITE Y APPLICATION POOL)
# ========================================================
Write-Step "6. Preparando IIS Application Pool..."
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
    Write-Host "  Asocie el sitio IIS a $currentDir y configure ARR/URL Rewrite según web.config." 
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
    const resHealth = await fetch('http://127.0.0.1:$Port/api/health');
    const health = await resHealth.json();
    const resChat = await fetch('http://127.0.0.1:$Port/api/chatbot/config');
    const chat = await resChat.json();
    console.log(JSON.stringify({ ok: resHealth.ok && health.status === 'ok', service: health.service, chatbotActive: chat.enabled !== false }));
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
            Write-Success "Backend Express saludable. Asistente Lupita: $($jsonRes.chatbotActive)"
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
Write-Host " PREPARACIÓN DEL ENTORNO PIA COMPLETADA" -ForegroundColor Green
Write-Host "=============================================================`n"
, "PORT=$Port")
    } else {
        $envContent += "`r`nPORT=$Port`r`n"
    }
    if ($envContent -match '(?m)^PIA_DATA_DIR=.*    [System.IO.File]::WriteAllText($envFile, $envContent, [System.Text.UTF8Encoding]::new($false))
}

# Restringir lectura del archivo de secretos.
$envAcl = New-Object System.Security.AccessControl.FileSecurity
$envAcl.SetAccessRuleProtection($true, $false)
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("NT AUTHORITY\SYSTEM", "FullControl", "Allow")))
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\Administrators", "FullControl", "Allow")))
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\IIS_IUSRS", "Read", "Allow")))
Set-Acl -Path $envFile -AclObject $envAcl
Write-Success "Permisos NTFS del archivo .env restringidos."

# 6. CONFIGURACIÓN DE IIS (SITE Y APPLICATION POOL)
# ========================================================
Write-Step "6. Preparando IIS Application Pool..."
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
    Write-Host "  Asocie el sitio IIS a $currentDir y configure ARR/URL Rewrite según web.config." 
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
    const resHealth = await fetch('http://127.0.0.1:$Port/api/health');
    const health = await resHealth.json();
    const resChat = await fetch('http://127.0.0.1:$Port/api/chatbot/config');
    const chat = await resChat.json();
    console.log(JSON.stringify({ ok: resHealth.ok && health.status === 'ok', service: health.service, chatbotActive: chat.enabled !== false }));
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
            Write-Success "Backend Express saludable. Asistente Lupita: $($jsonRes.chatbotActive)"
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
Write-Host " PREPARACIÓN DEL ENTORNO PIA COMPLETADA" -ForegroundColor Green
Write-Host "=============================================================`n"
) {
        $envContent = [regex]::Replace($envContent, '(?m)^PIA_DATA_DIR=.*    [System.IO.File]::WriteAllText($envFile, $envContent, [System.Text.UTF8Encoding]::new($false))
}

# Restringir lectura del archivo de secretos.
$envAcl = New-Object System.Security.AccessControl.FileSecurity
$envAcl.SetAccessRuleProtection($true, $false)
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("NT AUTHORITY\SYSTEM", "FullControl", "Allow")))
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\Administrators", "FullControl", "Allow")))
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\IIS_IUSRS", "Read", "Allow")))
Set-Acl -Path $envFile -AclObject $envAcl
Write-Success "Permisos NTFS del archivo .env restringidos."

# 6. CONFIGURACIÓN DE IIS (SITE Y APPLICATION POOL)
# ========================================================
Write-Step "6. Preparando IIS Application Pool..."
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
    Write-Host "  Asocie el sitio IIS a $currentDir y configure ARR/URL Rewrite según web.config." 
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
    const resHealth = await fetch('http://127.0.0.1:$Port/api/health');
    const health = await resHealth.json();
    const resChat = await fetch('http://127.0.0.1:$Port/api/chatbot/config');
    const chat = await resChat.json();
    console.log(JSON.stringify({ ok: resHealth.ok && health.status === 'ok', service: health.service, chatbotActive: chat.enabled !== false }));
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
            Write-Success "Backend Express saludable. Asistente Lupita: $($jsonRes.chatbotActive)"
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
Write-Host " PREPARACIÓN DEL ENTORNO PIA COMPLETADA" -ForegroundColor Green
Write-Host "=============================================================`n"
, "PIA_DATA_DIR=$dataPathEnv")
    } else {
        $envContent += "`r`nPIA_DATA_DIR=$dataPathEnv`r`n"
    }
    [System.IO.File]::WriteAllText($envFile, $envContent, [System.Text.UTF8Encoding]::new($false))
}

# Restringir lectura del archivo de secretos.
$envAcl = New-Object System.Security.AccessControl.FileSecurity
$envAcl.SetAccessRuleProtection($true, $false)
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("NT AUTHORITY\SYSTEM", "FullControl", "Allow")))
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\Administrators", "FullControl", "Allow")))
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\IIS_IUSRS", "Read", "Allow")))
Set-Acl -Path $envFile -AclObject $envAcl
Write-Success "Permisos NTFS del archivo .env restringidos."

# 6. CONFIGURACIÓN DE IIS (SITE Y APPLICATION POOL)
# ========================================================
Write-Step "6. Preparando IIS Application Pool..."
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
    Write-Host "  Asocie el sitio IIS a $currentDir y configure ARR/URL Rewrite según web.config." 
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
    const resHealth = await fetch('http://127.0.0.1:$Port/api/health');
    const health = await resHealth.json();
    const resChat = await fetch('http://127.0.0.1:$Port/api/chatbot/config');
    const chat = await resChat.json();
    console.log(JSON.stringify({ ok: resHealth.ok && health.status === 'ok', service: health.service, chatbotActive: chat.enabled !== false }));
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
            Write-Success "Backend Express saludable. Asistente Lupita: $($jsonRes.chatbotActive)"
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
Write-Host " PREPARACIÓN DEL ENTORNO PIA COMPLETADA" -ForegroundColor Green
Write-Host "=============================================================`n"
