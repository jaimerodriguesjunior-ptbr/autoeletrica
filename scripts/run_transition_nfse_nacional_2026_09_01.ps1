$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$node = "D:\Program Files\nodejs\node.exe"
$tsxCli = Join-Path $rootDir "node_modules\tsx\dist\cli.mjs"
$transition = Join-Path $PSScriptRoot "transition_nfse_nacional_2026_09_01.ts"

& $node $tsxCli $transition
exit $LASTEXITCODE
