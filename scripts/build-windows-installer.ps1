param(
  [string]$OutputDir = "dist-installer"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$installerDir = Join-Path $root "installer"
$stageRoot = Join-Path $installerDir "stage"
$payloadRoot = Join-Path $stageRoot "KidsBook Studio"
$payloadZip = Join-Path $installerDir "payload.zip"
$publishDir = Join-Path $root $OutputDir
$installerName = "KidsBook Studio Setup.exe"
$installerExe = Join-Path $publishDir $installerName
$dotnetExe = (Get-Command dotnet -ErrorAction Stop).Source
$sdkVersion = & $dotnetExe --version
$legacyCsc = Join-Path $env:ProgramFiles "dotnet\sdk\$sdkVersion\Roslyn\bincore\csc.dll"
$framework = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319"

if (Test-Path $stageRoot) {
  Remove-Item -Recurse -Force $stageRoot
}
if (Test-Path $payloadZip) {
  Remove-Item -Force $payloadZip
}
if (Test-Path $publishDir) {
  Remove-Item -Recurse -Force $publishDir
}

New-Item -ItemType Directory -Force -Path $payloadRoot | Out-Null
New-Item -ItemType Directory -Force -Path $publishDir | Out-Null

$copyTargets = @(
  "build",
  "electron",
  "assets",
  "node_modules",
  "package.json",
  "package-lock.json"
)

foreach ($target in $copyTargets) {
  $source = Join-Path $root $target
  $destination = Join-Path $payloadRoot $target

  if (Test-Path $source) {
    if ((Get-Item $source).PSIsContainer) {
      Copy-Item -Path $source -Destination $destination -Recurse -Force
    }
    else {
      Copy-Item -Path $source -Destination $destination -Force
    }
  }
}

Push-Location $payloadRoot
try {
  npm prune --omit=dev
}
finally {
  Pop-Location
}

New-Item -ItemType Directory -Force -Path (Join-Path $payloadRoot "node_modules") | Out-Null
Copy-Item -Path (Join-Path $root "node_modules\electron") -Destination (Join-Path $payloadRoot "node_modules\electron") -Recurse -Force

$electronRuntime = Join-Path $payloadRoot "node_modules\electron\dist\electron.exe"
if (-not (Test-Path $electronRuntime)) {
  throw "Electron runtime missing from payload: $electronRuntime"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($payloadRoot, $payloadZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)

function Invoke-LegacyCompiler {
  if (-not (Test-Path $legacyCsc)) {
    throw "Legacy C# compiler not found: $legacyCsc"
  }

  $refs = @(
    (Join-Path $framework "mscorlib.dll"),
    (Join-Path $framework "System.dll"),
    (Join-Path $framework "System.Core.dll"),
    (Join-Path $framework "Microsoft.CSharp.dll"),
    (Join-Path $framework "System.Drawing.dll"),
    (Join-Path $framework "System.Windows.Forms.dll"),
    (Join-Path $framework "System.IO.Compression.dll"),
    (Join-Path $framework "System.IO.Compression.FileSystem.dll")
  )

  $cscArgs = @(
    "/nologo",
    "/target:winexe",
    "/platform:x64",
    "/langversion:latest",
    "/out:$installerExe",
    "/resource:$payloadZip,KidsBookStudioSetup.payload.zip"
  )

  foreach ($ref in $refs) {
    $cscArgs += "/reference:$ref"
  }

  $cscArgs += (Join-Path $installerDir "Program.cs")
  & $dotnetExe $legacyCsc @cscArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Legacy compiler failed with exit code $LASTEXITCODE"
  }
}

try {
  & $dotnetExe publish (Join-Path $installerDir "KidsBookInstaller.csproj") `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:PublishTrimmed=false `
    -p:EnableCompressionInSingleFile=true `
    -o $publishDir

  if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed with exit code $LASTEXITCODE"
  }

  $publishedExe = Join-Path $publishDir "KidsBookStudioSetup.exe"
  if (-not (Test-Path $publishedExe)) {
    throw "Published installer not found: $publishedExe"
  }

  if (Test-Path $installerExe) {
    Remove-Item -Force $installerExe
  }
  Move-Item -Path $publishedExe -Destination $installerExe
}
catch {
  Write-Warning "Self-contained publish failed; falling back to legacy compiler. $($_.Exception.Message)"
  if (Test-Path $publishDir) {
    Remove-Item -Recurse -Force $publishDir
  }
  New-Item -ItemType Directory -Force -Path $publishDir | Out-Null
  Invoke-LegacyCompiler
}

foreach ($path in @($stageRoot, $payloadZip)) {
  if (Test-Path $path) {
    Remove-Item -Recurse -Force $path
  }
}

Write-Host "Installer built at: $installerExe"
