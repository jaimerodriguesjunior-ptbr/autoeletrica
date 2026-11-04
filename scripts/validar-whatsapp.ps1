$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    Write-Host 'Validando o adaptador WhatsApp...'
    node --test services/whatsapp-bridge/server.test.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Os testes do adaptador falharam.' }
    Write-Host 'Validando TypeScript...'
    node node_modules/typescript/bin/tsc --noEmit --pretty false
    if ($LASTEXITCODE -ne 0) { throw 'A validacao TypeScript falhou.' }
    Write-Host 'Compilando a aplicacao...'
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'A compilacao falhou.' }
    Write-Host 'Validacoes concluidas. Nenhum deploy foi realizado.'
} finally {
    Pop-Location
}
