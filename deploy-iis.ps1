<#
.SYNOPSIS
  Prepara PIA para instalación en Windows Server con Node.js e IIS.

.DESCRIPTION
  Copia el código limpio, comprueba Node.js 22.9+, instala dependencias,
  prepara el directorio privado y solicita las contraseñas iniciales.
  La creación del sitio IIS, ARR y el servicio Node permanente se completan
  según la política de infraestructura de TI.
#>

[CmdletBinding()]
param([string]$InstallPath = "C:\inetpub\wwwroot\PIA", [string]$DataPath = "C:\PIA_Data", [int]$Port = 3000, [string]$ServiceAccount = "NT AUTHORITY\SYSTEM")

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[PIA] $Message" -ForegroundColor Cyan
}
function Write-Success {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}
function Write-WarnMsg {
    param([string]$Message)
    Write-Host "  [AVISO] $Message" -ForegroundColor Yellow
}

# 1. Privilegios
Write-Step "Verificando privilegios de administrador..."
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    throw "Ejecute este script desde PowerShell como Administrador."
}
Write-Success "Privilegios confirmados."

# 2. Node.js y npm
Write-Step "Verificando Node.js y npm..."
$nodeVersionText = & node -p "process.versions.node"
if ($LASTEXITCODE -ne 0 -or [version]$nodeVersionText -lt [version]"22.9.0") {
    throw "Se requiere Node.js 22.9 o superior. Instale Node.js LTS desde https://nodejs.org/."
}
$npmVersion = & npm -v
if ($LASTEXITCODE -ne 0) {
    throw "npm no está disponible."
}
Write-Success "Node.js $nodeVersionText y npm $npmVersion detectados."

# 3. IIS y directorio de datos privado
Write-Step "Preparando IIS y almacenamiento privado..."
$iisService = Get-Service -Name W3SVC -ErrorAction SilentlyContinue
if (-not $iisService) {
    Install-WindowsFeature -Name Web-Server, Web-Static-Content, Web-Default-Doc, Web-Http-Errors, Web-Filtering -IncludeManagementTools
    $iisService = Get-Service -Name W3SVC
}
if (-not (Test-Path $DataPath)) {
    New-Item -ItemType Directory -Path $DataPath -Force | Out-Null
}
$backupPath = Join-Path $DataPath "backups"
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

$dataAcl = Get-Acl $DataPath
$dataAcl.SetAccessRuleProtection($true, $false)
$dataAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("NT AUTHORITY\SYSTEM", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")))
$dataAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\Administrators", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")))
$dataAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($ServiceAccount, "Modify", "ContainerInherit,ObjectInherit", "None", "Allow")))
Set-Acl -Path $DataPath -AclObject $dataAcl
Write-Success "Datos y respaldos preparados en $DataPath."

# 4. Copia limpia e instalación
Write-Step "Copiando la aplicación a $InstallPath..."
$sourceDir = $PSScriptRoot
if (-not $sourceDir) { $sourceDir = (Get-Location).Path }
$sourceFullPath = [System.IO.Path]::GetFullPath($sourceDir)
$installFullPath = [System.IO.Path]::GetFullPath($InstallPath)
New-Item -ItemType Directory -Path $installFullPath -Force | Out-Null

if ($sourceFullPath.TrimEnd('\') -ne $installFullPath.TrimEnd('\')) {
    Get-ChildItem -Path $sourceFullPath -Force |
        Where-Object { $_.Name -notin @(".git", "node_modules", "data", "uploads", ".env") } |
        ForEach-Object { Copy-Item -Path $_.FullName -Destination $installFullPath -Recurse -Force }
}
$currentDir = $installFullPath
Set-Location $currentDir

if (-not (Test-Path (Join-Path $currentDir "package.json"))) {
    throw "No se encontró package.json en $currentDir."
}
& npm install --omit=dev --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
    throw "Falló la instalación de dependencias npm."
}
Write-Success "Código copiado y dependencias instaladas."

# 5. Variables de entorno y credenciales de primer arranque
Write-Step "Configurando secretos y credenciales..."
$envFile = Join-Path $currentDir ".env"
$dataPathEnv = $DataPath -replace '\\', '/'

if (-not (Test-Path $envFile)) {
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
        throw "Las contraseñas deben ser diferentes y tener al menos 14 caracteres."
    }
    if ($password1 -notmatch '^[A-Za-z0-9!@#$%^&*()_+=-]{14,256}$' -or $password2 -notmatch '^[A-Za-z0-9!@#$%^&*()_+=-]{14,256}$') {
        throw "Use entre 14 y 256 caracteres, sin espacios ni comillas."
    }

    $sessionSecret = & node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
    if ($LASTEXITCODE -ne 0 -or $sessionSecret.Length -lt 64) {
        throw "No fue posible generar el secreto de sesión."
    }
    $envLines = @(
        "NODE_ENV=production",
        "PORT=$Port",
        "PIA_DATA_DIR=$dataPathEnv",
        "PIA_SESSION_SECRET=$sessionSecret",
        "PIA_OPERATOR_1_PASSWORD=$password1",
        "PIA_OPERATOR_2_PASSWORD=$password2",
        "PIA_OPERATOR_1_NAME=Dirección de Apoyo en la Gestión de Irregularidades - DAGI",
        "PIA_OPERATOR_2_NAME=Apoyo a la Gestión de Irregularidades (CNC)",
        "# Firebase Authentication es opcional; configurar solo si se utiliza.",
        "GEMINI_API_KEY="
    )
    [System.IO.File]::WriteAllLines($envFile, $envLines, [System.Text.UTF8Encoding]::new($false))
    $password1 = $null
    $password2 = $null
    Write-Success "Secreto y credenciales iniciales generados."
} else {
    $envContent = Get-Content -Path $envFile -Raw
    if ($envContent -notmatch '(?m)^PIA_SESSION_SECRET=.{64,}$') {
        throw "PIA_SESSION_SECRET debe contener al menos 64 caracteres."
    }
    if ($envContent -match '(?m)^PORT=.*$') {
        $envContent = [regex]::Replace($envContent, '(?m)^PORT=.*$', "PORT=$Port")
    } else {
        $envContent += [Environment]::NewLine + "PORT=$Port" + [Environment]::NewLine
    }
    if ($envContent -match '(?m)^PIA_DATA_DIR=.*$') {
        $envContent = [regex]::Replace($envContent, '(?m)^PIA_DATA_DIR=.*$', "PIA_DATA_DIR=$dataPathEnv")
    } else {
        $envContent += [Environment]::NewLine + "PIA_DATA_DIR=$dataPathEnv" + [Environment]::NewLine
    }
    [System.IO.File]::WriteAllText($envFile, $envContent, [System.Text.UTF8Encoding]::new($false))
    Write-Success "Configuración .env existente conservada y rutas sincronizadas."
}

$envAcl = New-Object System.Security.AccessControl.FileSecurity
$envAcl.SetAccessRuleProtection($true, $false)
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("NT AUTHORITY\SYSTEM", "FullControl", "Allow")))
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\Administrators", "FullControl", "Allow")))
$envAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($ServiceAccount, "Read", "Allow")))
Set-Acl -Path $envFile -AclObject $envAcl
Write-Success "Permisos del archivo .env restringidos a administradores y la cuenta de servicio ($ServiceAccount)."

# Sincronizar el puerto del proxy IIS con el puerto del backend.
$webConfigPath = Join-Path $currentDir "web.config"
if (Test-Path $webConfigPath) {
    $webConfigContent = Get-Content -Path $webConfigPath -Raw
    $webConfigContent = [regex]::Replace($webConfigContent, '127\.0\.0\.1:\d+', "127.0.0.1:$Port")
    [System.IO.File]::WriteAllText($webConfigPath, $webConfigContent, [System.Text.UTF8Encoding]::new($false))
}

# 6. Application Pool
Write-Step "Preparando Application Pool de IIS..."
Import-Module WebAdministration -ErrorAction SilentlyContinue
$appPoolName = "PiaAppPool"
if (-not (Test-Path "IIS:\AppPools\$appPoolName")) {
    $appPool = New-Item "IIS:\AppPools\$appPoolName"
    $appPool.managedRuntimeVersion = ""
    $appPool.processModel.idleTimeout = [TimeSpan]::Zero
    $appPool | Set-Item
}
Write-Success "Application Pool $appPoolName preparado. Asocie manualmente el sitio IIS a $currentDir."

# 7. Proceso Node permanente
Write-Step "Configuración del proceso Node permanente..."
Write-Host "Configure un servicio con NSSM o PM2 conforme a la política de TI."
Write-Host "Ejemplo NSSM: nssm install PIA_Service node.exe"
Write-Host "Directorio de trabajo: $currentDir"
Write-Host "Identidad de servicio prevista: $ServiceAccount"
Write-Host "Después del primer inicio correcto, elimine PIA_OPERATOR_1_PASSWORD y PIA_OPERATOR_2_PASSWORD del archivo .env."

# 8. Health check
Write-Step "Comprobando el endpoint de salud..."
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 5
    if ($health.status -eq "ok") {
        Write-Success "Backend Express saludable en el puerto $Port."
    } else {
        Write-WarnMsg "El endpoint respondió, pero no confirmó estado saludable."
    }
} catch {
    Write-WarnMsg "El backend aún no está iniciado. Compruebe /api/health después de configurar el servicio."
}

Write-Host "=============================================================" -ForegroundColor Green
Write-Host "PREPARACIÓN DEL ENTORNO PIA COMPLETADA" -ForegroundColor Green
Write-Host "=============================================================" -ForegroundColor Green
