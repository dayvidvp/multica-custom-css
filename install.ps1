# Patches Multica Desktop so ~/.multica/custom.css and custom.js get injected. Re-run after every Multica update.
# Revert: .\install.ps1 -Uninstall
param([switch]$Uninstall)

$install = Join-Path $env:LOCALAPPDATA "Programs\@multicadesktop"
$asar = Join-Path $install "resources\app.asar"
if (-not (Test-Path $asar)) { throw "Multica not found in $install" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is required (https://nodejs.org)" }

# Seed the user stylesheet and script on first install; never overwrite existing ones
if (-not $Uninstall) {
    foreach ($name in "custom.css", "custom.js") {
        $target = Join-Path $env:USERPROFILE ".multica\$name"
        if (-not (Test-Path $target)) {
            New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
            Copy-Item (Join-Path $PSScriptRoot $name) $target
        }
    }
}

# Close every Multica window process (main, renderer, gpu, ...), which all keep app.asar open.
# The agent daemon and CLI run from app.asar.unpacked under another path, so they keep running.
$exe = Join-Path $install "Multica.exe"
$windowProcesses = { Get-CimInstance Win32_Process -Filter "Name='Multica.exe'" | Where-Object { $_.ExecutablePath -eq $exe } }
& $windowProcesses | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
for ($i = 0; $i -lt 20 -and (& $windowProcesses); $i++) { Start-Sleep -Milliseconds 500 }
if (& $windowProcesses) { throw "Multica is still running; close it and run install.ps1 again" }

if ($Uninstall) { node (Join-Path $PSScriptRoot "patch-asar.mjs") $asar --restore }
else { node (Join-Path $PSScriptRoot "patch-asar.mjs") $asar }
$patchExit = $LASTEXITCODE

Start-Process $exe
if ($patchExit -ne 0) { throw "Patching failed; Multica was started unchanged" }
