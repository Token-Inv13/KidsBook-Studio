param()

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Windows.Forms

try {
  $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  $installRoot = Join-Path $env:LOCALAPPDATA "KidsBookStudio"
  $appFolder = Join-Path $installRoot "KidsBook Studio"
  $payloadZip = Join-Path $scriptRoot "payload.zip"
  $logFile = Join-Path $installRoot "install.log"

  New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
  function Write-Log {
    param([string]$Message)
    Add-Content -Path $logFile -Value "$(Get-Date -Format o) $Message"
  }

  if (-not (Test-Path $payloadZip)) {
    throw "Payload archive not found: $payloadZip"
  }

  Write-Log "Installer started from $scriptRoot"
  Write-Log "Payload archive: $payloadZip"
  New-Item -ItemType Directory -Force -Path $appFolder | Out-Null
  Write-Log "Extracting payload to $appFolder"
  Expand-Archive -Path $payloadZip -DestinationPath $appFolder -Force
  Write-Log "Extraction complete"

  $electronExe = Join-Path $appFolder "node_modules\electron\dist\electron.exe"
  if (-not (Test-Path $electronExe)) {
    throw "Electron executable not found after extraction: $electronExe"
  }
  Write-Log "Electron runtime found at $electronExe"

  $desktopShortcut = Join-Path ([Environment]::GetFolderPath("DesktopDirectory")) "KidsBook Studio.lnk"
  $startMenuFolder = Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs\KidsBook Studio"
  $startMenuShortcut = Join-Path $startMenuFolder "KidsBook Studio.lnk"
  New-Item -ItemType Directory -Force -Path $startMenuFolder | Out-Null
  Write-Log "Creating shortcuts"

  function New-Shortcut {
    param(
      [string]$ShortcutPath,
      [string]$TargetPath,
      [string]$Arguments,
      [string]$WorkingDirectory,
      [string]$IconPath
    )

    $shellType = [Type]::GetTypeFromProgID("WScript.Shell")
    if (-not $shellType) {
      throw "WScript.Shell COM component is not available."
    }

    $shell = [Activator]::CreateInstance($shellType)
    $shortcut = $shell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $TargetPath
    $shortcut.Arguments = $Arguments
    $shortcut.WorkingDirectory = $WorkingDirectory
    $shortcut.IconLocation = $IconPath
    $shortcut.Description = "KidsBook Studio"
    $shortcut.Save()
  }

  New-Shortcut -ShortcutPath $desktopShortcut -TargetPath $electronExe -Arguments "." -WorkingDirectory $appFolder -IconPath $electronExe
  New-Shortcut -ShortcutPath $startMenuShortcut -TargetPath $electronExe -Arguments "." -WorkingDirectory $appFolder -IconPath $electronExe
  Write-Log "Shortcuts created"

  Start-Process -FilePath $electronExe -ArgumentList "." -WorkingDirectory $appFolder | Out-Null
  Write-Log "Electron launch requested"
  [System.Windows.Forms.MessageBox]::Show("KidsBook Studio a ete installe.", "KidsBook Studio", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
}
catch {
  if ($logFile) {
    Add-Content -Path $logFile -Value "$(Get-Date -Format o) ERROR: $($_.Exception.Message)"
  }
  [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "KidsBook Studio - Installation error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
  exit 1
}
