$ErrorActionPreference = 'Stop'
$wordpressRoot = Split-Path -Parent $PSScriptRoot
$packageOutput = Join-Path $wordpressRoot 'dist'
New-Item -ItemType Directory -Force -Path $packageOutput | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function New-WordPressPackage($source, $destination, $requiredFiles) {
    $sourceRoot = (Resolve-Path -LiteralPath $source).Path
    $folderName = Split-Path -Leaf $sourceRoot
    $files = @(Get-ChildItem -LiteralPath $sourceRoot -File -Recurse)
    $temporary = "$destination.tmp"
    $stream = [System.IO.File]::Open($temporary, [System.IO.FileMode]::Create)
    $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
    try {
        foreach ($file in $files) {
            # Windows PowerShell Compress-Archive writes backslash entry names.
            # ZIP paths must use forward slashes for WordPress on Linux.
            $relative = $file.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/')
            $entryName = "$folderName/$relative"
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally { $archive.Dispose(); $stream.Dispose() }

    $check = [System.IO.Compression.ZipFile]::OpenRead($temporary)
    try {
        if ($check.Entries.Count -ne $files.Count) { throw 'Archive file count does not match the source.' }
        foreach ($entry in $check.Entries) {
            if ($entry.FullName.Contains('\') -or !$entry.FullName.StartsWith("$folderName/")) {
                throw "Invalid WordPress ZIP path: $($entry.FullName)"
            }
        }
        foreach ($required in $requiredFiles) {
            $entry = $check.GetEntry("$folderName/$required")
            if (!$entry -or $entry.Length -eq 0) { throw "Missing required package file: $folderName/$required" }
        }
    } finally { $check.Dispose() }
    Move-Item -LiteralPath $temporary -Destination $destination -Force
    Write-Output "Verified $folderName archive: $($files.Count) files with portable ZIP paths."
}

New-WordPressPackage (Join-Path $wordpressRoot 'plugins/matinf-core') (Join-Path $packageOutput 'matinf-core.zip') @('matinf-core.php', 'includes/rest.php', 'includes/push.php', 'includes/push-admin.php', 'includes/catalog.php', 'includes/editor.php', 'includes/schedule.php', 'includes/student-life.php', 'assets/editor.js', 'assets/catalog-import.js', 'data/catalog.json')
New-WordPressPackage (Join-Path $wordpressRoot 'themes/matinf') (Join-Path $packageOutput 'matinf-theme.zip') @('style.css', 'index.php', 'functions.php')
Write-Output "Upload packages created in $packageOutput"
