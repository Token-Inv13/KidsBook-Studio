$ErrorActionPreference = 'Stop'

$exePath = Join-Path $PSScriptRoot '..\dist\win-unpacked\KidsBook Studio.exe'
$exePath = [System.IO.Path]::GetFullPath($exePath)

if (-not [System.IO.File]::Exists($exePath)) {
  throw "Packaged executable not found: $exePath. Run `npm run dist:dir` first."
}

$chromiumProfileDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "kidsbook-electron-profile-$([System.Guid]::NewGuid().ToString('N'))")
[System.IO.Directory]::CreateDirectory($chromiumProfileDir) | Out-Null

$process = Start-Process -FilePath $exePath -ArgumentList "--user-data-dir=$chromiumProfileDir" -WorkingDirectory (Split-Path $exePath) -PassThru
Write-Output "Started KidsBook Studio (pid $($process.Id)) from $exePath"
Wait-Process -Id $process.Id
