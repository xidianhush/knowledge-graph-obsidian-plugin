$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$target = 'D:\obsidian_vault\hush-ob-bucket\.obsidian\plugins\knowledge-graph-smoke'
$expectedTarget = [IO.Path]::GetFullPath($target)
if ((Resolve-Path -LiteralPath $target).Path -ne $expectedTarget) { throw 'Unexpected install directory' }
$release = Join-Path $repoRoot '.local/releases/knowledge-graph-smoke-0.0.6/knowledge-graph-smoke'
$lock = Get-Content -LiteralPath (Join-Path $repoRoot '.local/releases/release-lock-0.0.6.json') -Raw | ConvertFrom-Json
$files = @('main.js','manifest.json','styles.css')
foreach ($name in $files) {
    if ((Get-FileHash -LiteralPath (Join-Path $release $name)).Hash.ToLowerInvariant() -ne $lock.files.$name) { throw "Release hash mismatch: $name" }
}
$oldManifest = Get-Content -LiteralPath (Join-Path $target 'manifest.json') -Raw | ConvertFrom-Json
if ($oldManifest.version -ne '0.0.3' -or $oldManifest.id -ne 'knowledge-graph-smoke') { throw 'Expected daily 0.0.3; inspect before upgrading' }
$backup = Join-Path $repoRoot ('.local/backups/daily-before-0.0.6-' + (Get-Date -Format 'yyyyMMddTHHmmssfff'))
New-Item -ItemType Directory -Path $backup | Out-Null
$before = @{}
foreach ($name in ($files + @('data.json'))) {
    $installed = Join-Path $target $name
    $before[$name] = (Get-FileHash -LiteralPath $installed).Hash.ToLowerInvariant()
    Copy-Item -LiteralPath $installed -Destination (Join-Path $backup $name)
    if ((Get-FileHash -LiteralPath (Join-Path $backup $name)).Hash.ToLowerInvariant() -ne $before[$name]) { throw "Backup mismatch: $name" }
}
try {
    foreach ($name in $files) {
        if ((Get-FileHash -LiteralPath (Join-Path $target $name)).Hash.ToLowerInvariant() -ne $before[$name]) { throw "Installed file changed during preparation: $name" }
    }
    foreach ($name in $files) { Copy-Item -LiteralPath (Join-Path $release $name) -Destination (Join-Path $target $name) }
    foreach ($name in $files) {
        if ((Get-FileHash -LiteralPath (Join-Path $target $name)).Hash.ToLowerInvariant() -ne $lock.files.$name) { throw "Installed hash mismatch: $name" }
    }
} catch {
    foreach ($name in $files) { Copy-Item -LiteralPath (Join-Path $backup $name) -Destination (Join-Path $target $name) }
    throw
}
$dataAfter = (Get-FileHash -LiteralPath (Join-Path $target 'data.json')).Hash.ToLowerInvariant()
$receipt = [ordered]@{ version='0.0.6'; previousVersion='0.0.3'; installedAt=(Get-Date -Format o); target=$target; backup=$backup; before=$before; installed=$lock.files; dataBefore=$before['data.json']; dataAfter=$dataAfter; dataUnchanged=($before['data.json'] -eq $dataAfter); runtimeReload='pending user reload'; notesTouched=$false }
$receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $repoRoot '.local/daily-upgrade-0.0.6-receipt.json') -Encoding utf8
$receipt | ConvertTo-Json -Depth 6
if (-not $receipt.dataUnchanged) { throw 'Configuration changed concurrently; it was not overwritten. Inspect receipt.' }
