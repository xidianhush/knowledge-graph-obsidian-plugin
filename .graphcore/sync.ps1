$ErrorActionPreference = 'Stop'
$stageRoot = $PSScriptRoot
$projectRoot = 'D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin'
foreach ($relative in @('src\core','src\adapters')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot $relative) | Out-Null
    Copy-Item -Path (Join-Path $stageRoot ($relative + '\*.js')) -Destination (Join-Path $projectRoot $relative) -Force
}
foreach ($relative in @('src\plugin.js','scripts\build.mjs','scripts\core_check.mjs','scripts\browser_core_check.py')) {
    Copy-Item -LiteralPath (Join-Path $stageRoot $relative) -Destination (Join-Path $projectRoot $relative) -Force
}
Push-Location -LiteralPath $projectRoot
try {
    & 'D:\node.js\node.exe' scripts\build.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
    & 'D:\node.js\node.exe' scripts\core_check.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Core checks failed' }
} finally { Pop-Location }
