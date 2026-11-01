$ErrorActionPreference = 'Stop'
$stageRoot = $PSScriptRoot
$projectRoot = 'D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin'
foreach ($relative in @('src\pipeline','src\adapters')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot $relative) | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $stageRoot $relative) -Filter '*.js' | Copy-Item -Destination (Join-Path $projectRoot $relative) -Force
}
foreach ($relative in @('src\plugin.js','styles.css','scripts\build.mjs','scripts\export_pipeline_golden.py','scripts\pipeline_check.mjs','scripts\pipeline_browser_check.py','scripts\vault_pipeline_check.py','scripts\pipeline_contract_check.mjs','scripts\smoke_check.py','scripts\browser_core_check.py')) {
    Copy-Item -LiteralPath (Join-Path $stageRoot $relative) -Destination (Join-Path $projectRoot $relative) -Force
}
Push-Location -LiteralPath $projectRoot
try {
    & 'D:\node.js\node.exe' scripts\build.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
} finally { Pop-Location }
