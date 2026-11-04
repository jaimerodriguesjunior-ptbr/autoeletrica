# Envia a credencial da VPS diretamente para as variáveis de produção da Vercel.
# Não imprime o segredo, não cria arquivo local e não faz deploy.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$link = Get-Content -Raw -LiteralPath (Join-Path $projectRoot '.vercel\project.json') | ConvertFrom-Json
if ($link.projectId -ne 'prj_TlOS4P7lsoAzZzlRW7q2XpiY29fU' -or $link.orgId -ne 'team_Gjb9Pu926SDl1pg7aJIom335') {
    throw 'O projeto Vercel vinculado nao corresponde ao MB Garage confirmado.'
}
$remotePython = @'
from pathlib import Path
p = Path('/opt/mbgarage-whatsapp/.env')
print(next(x.split('=', 1)[1] for x in p.read_text().splitlines() if x.startswith('MB_WHATSAPP_BRIDGE_TOKEN=')))
'@
$bridgeToken = ($remotePython | ssh -o BatchMode=yes -o ConnectTimeout=10 root@191.252.205.29 python3 -)
if ($LASTEXITCODE -ne 0 -or $bridgeToken -isnot [string] -or $bridgeToken.Length -lt 32 -or $bridgeToken -notmatch '^[A-Za-z0-9_-]+$') {
    throw 'Nao foi possivel obter a credencial da VPS; nada foi enviado a Vercel.'
}
Push-Location $projectRoot
try {
    'https://wa.mentebinaria.com/mbgarage' | npx vercel env add MB_WHATSAPP_BRIDGE_URL production --type config --yes
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel adicionar a URL. Nenhum segredo foi enviado; verifique se a variavel ja existe.' }
    $bridgeToken | npx vercel env add MB_WHATSAPP_BRIDGE_TOKEN production --sensitive --yes
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel adicionar o segredo. A URL pode ter sido salva; nao repita sem revisao.' }
    Write-Host 'Configuracao de producao salva. Nenhum deploy foi realizado.'
} finally {
    Remove-Variable bridgeToken -ErrorAction SilentlyContinue
    Pop-Location
}
