$ErrorActionPreference = 'Stop'
$wordpressRoot = Split-Path -Parent $PSScriptRoot
$packageOutput = Join-Path $wordpressRoot 'dist'
New-Item -ItemType Directory -Force -Path $packageOutput | Out-Null
Compress-Archive -LiteralPath (Join-Path $wordpressRoot 'plugins/matinf-core') -DestinationPath (Join-Path $packageOutput 'matinf-core.zip') -Force
Compress-Archive -LiteralPath (Join-Path $wordpressRoot 'themes/matinf') -DestinationPath (Join-Path $packageOutput 'matinf-theme.zip') -Force
Write-Output "Upload packages created in $packageOutput"
