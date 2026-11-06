$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$listener = Get-NetTCPConnection -State Listen -LocalPort 5181 -ErrorAction SilentlyContinue
if ($listener) { Write-Output 'Port 5181 is already in use. Existing processes were left running.'; exit 1 }
$nodePath = (Get-Command node).Source
$entryPath = Join-Path $repoRoot 'server\index.mjs'
$process = Start-Process -FilePath $nodePath -ArgumentList ('"' + $entryPath + '"') -WorkingDirectory $repoRoot -RedirectStandardOutput (Join-Path $repoRoot 'local-server.log') -RedirectStandardError (Join-Path $repoRoot 'local-server.err.log') -WindowStyle Hidden -PassThru
@{pid=$process.Id;port=5181;entry=$entryPath} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $repoRoot '.local-server.json')
Write-Output ('Motorfolio: http://127.0.0.1:5181 (PID ' + $process.Id + ')')
