$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $repoRoot '.local-server.json'
if (!(Test-Path -LiteralPath $statePath)) { Write-Output 'No owned server is recorded.'; exit 0 }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$owned = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $state.pid)
if ($owned -and $owned.CommandLine.Contains($state.entry)) { Stop-Process -Id $state.pid; Write-Output 'Stopped this app server.' }
else { Write-Output 'Recorded PID is not this app server. It was left untouched.' }
