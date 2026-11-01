$ErrorActionPreference = 'Stop'
$projectRoot = 'D:\what_i_am_doing\Project\knowledge-graph-obsidian-plugin'
foreach ($relative in @('src\plugin.js','src\adapters\browser.js','src\adapters\hud.js','src\adapters\obsidian-native.js','scripts\build.mjs','styles.css','scripts\native_check.py')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $relative) -Destination (Join-Path $projectRoot $relative) -Force
}
Push-Location -LiteralPath $projectRoot
try {
  & 'D:\node.js\node.exe' scripts\build.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
} finally { Pop-Location }
