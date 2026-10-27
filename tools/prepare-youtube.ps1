$ErrorActionPreference = 'Stop'
$vendor = Join-Path $PSScriptRoot 'vendor'
New-Item -ItemType Directory -Path $vendor -Force | Out-Null

function Ensure-Download($name, $url, $expectedHash) {
  $target = Join-Path $vendor $name
  if ((Test-Path -LiteralPath $target) -and
      (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ieq $expectedHash) {
    return $target
  }
  Invoke-WebRequest -Uri $url -OutFile $target
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ine $expectedHash) {
    throw "Checksum mismatch: $name"
  }
  return $target
}

$ytDlp = Ensure-Download 'yt-dlp.exe' `
  'https://github.com/yt-dlp/yt-dlp/releases/download/2026.10.26/yt-dlp.exe' `
  'f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d'
$nodeZip = Ensure-Download 'node-v22.23.4-win-x64.zip' `
  'https://nodejs.org/dist/v22.23.4/node-v22.23.4-win-x64.zip' `
  'cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20'

$node = Join-Path $vendor 'node.exe'
if (-not (Test-Path -LiteralPath $node) -or
    (Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash -ine
      'dccc52de28d8df2ee22d2062424f8c563070d95d8ad70c54c4bf01d590dec14f') {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($nodeZip)
  try {
    $entry = $archive.Entries | Where-Object FullName -eq 'node-v22.23.4-win-x64/node.exe'
    if (-not $entry) { throw 'node.exe is missing from the official archive.' }
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $node, $true)
  } finally {
    $archive.Dispose()
  }
  if ((Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash -ine
      'dccc52de28d8df2ee22d2062424f8c563070d95d8ad70c54c4bf01d590dec14f') {
    throw 'node.exe checksum mismatch.'
  }
}
Write-Output 'YouTube tools ready: yt-dlp 2026.10.26 and Node.js 22.23.4.'
