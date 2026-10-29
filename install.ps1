# Patches Multica Desktop so ~/.multica/custom.css gets injected. Re-run after every Multica update.
# Revert: .\install.ps1 -Uninstall
param([switch]$Uninstall)

$install = Join-Path $env:LOCALAPPDATA "Programs\@multicadesktop"
$asar = Join-Path $install "resources\app.asar"
if (-not (Test-Path $asar)) { throw "Multica not found in $install" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is required (https://nodejs.org)" }

# Seed the user stylesheet on first install; never overwrite an existing one
$css = Join-Path $env:USERPROFILE ".multica\custom.css"
if (-not $Uninstall -and -not (Test-Path $css)) {
    New-Item -ItemType Directory -Force (Split-Path $css) | Out-Null
    Copy-Item (Join-Path $PSScriptRoot "custom.css") $css
}

# Close the Multica window (the agent daemon keeps running)
$ui = Get-CimInstance Win32_Process -Filter "Name='Multica.exe'" | Where-Object { $_.CommandLine -notmatch '--type=|daemon' }
$ui | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
if ($ui) { Start-Sleep -Seconds 3 }

if ($Uninstall) { node (Join-Path $PSScriptRoot "patch-asar.mjs") $asar --restore }
else { node (Join-Path $PSScriptRoot "patch-asar.mjs") $asar }

Start-Process (Join-Path $install "Multica.exe")
