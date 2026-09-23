$ErrorActionPreference = 'Stop'
$wordpressRoot = Split-Path -Parent $PSScriptRoot
$localSite = Join-Path $wordpressRoot '.runtime/site'
if (-not (Test-Path -LiteralPath (Join-Path $localSite 'wp-config.php'))) { throw 'Start local WordPress once before making a backup.' }
if (Get-NetTCPConnection -State Listen -LocalPort 9400 -ErrorAction SilentlyContinue) { throw 'Stop local WordPress (Ctrl+C in its terminal) before backing up its SQLite database.' }
$backupRoot = Join-Path $wordpressRoot ('.runtime/backups/' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backupRoot | Out-Null
Copy-Item -LiteralPath $localSite -Destination (Join-Path $backupRoot 'site') -Recurse
foreach ($folder in @('plugins/matinf-core', 'themes/matinf')) {
    $targetParent = Join-Path $backupRoot ('site/wp-content/' + (Split-Path -Parent $folder))
    New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
    Copy-Item -LiteralPath (Join-Path $wordpressRoot $folder) -Destination $targetParent -Recurse -Force
}
Copy-Item -LiteralPath (Join-Path $wordpressRoot '.runtime/local-admin.json') -Destination $backupRoot
Copy-Item -LiteralPath (Join-Path $wordpressRoot 'package.json'), (Join-Path $wordpressRoot 'package-lock.json') -Destination $backupRoot
Write-Output "Complete local backup created at $backupRoot"
Write-Output 'Keep this folder private: it contains the database and local login. It is not a hosting upload package.'
