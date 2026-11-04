# Instala somente o adaptador isolado. Não altera Nginx, a Evolution ou a ótica.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bridgePath = Join-Path $projectRoot 'services\whatsapp-bridge'
$paths = @('server.mjs', 'Dockerfile', 'compose.example.yml')
$payload = @{}
foreach ($name in $paths) {
    $file = Join-Path $bridgePath $name
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Arquivo ausente: $file" }
    $payload[$name] = [Convert]::ToBase64String([IO.File]::ReadAllBytes($file))
}
$payloadJson = $payload | ConvertTo-Json -Compress
$payloadBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payloadJson))
$remotePython = @'
import base64, json, os, re, secrets, socket, subprocess, time, urllib.request, urllib.error
from pathlib import Path

payload = json.loads(base64.b64decode("__PAYLOAD__").decode("utf-8"))
target = Path('/opt/mbgarage-whatsapp')
if target.exists():
    raise SystemExit('Diretorio do adaptador ja existe; interrompido para nao sobrescrever dados.')
with socket.socket() as sock:
    if sock.connect_ex(('127.0.0.1', 3101)) == 0:
        raise SystemExit('Porta 3101 ja esta em uso; instalacao interrompida.')
info = json.loads(subprocess.check_output(['docker', 'inspect', 'evolution_api']))[0]
networks = info['NetworkSettings']['Networks']
if 'deploy_evolution' not in networks or not info['State']['Running']:
    raise SystemExit('Rede ou estado da Evolution mudou; instalacao interrompida.')
values = dict(item.split('=', 1) for item in info['Config']['Env'] if '=' in item)
key = values.get('AUTHENTICATION_API_KEY')
if not key or not re.fullmatch(r'[A-Za-z0-9_.-]+', key):
    raise SystemExit('Chave interna da Evolution ausente ou em formato nao suportado; instalacao interrompida.')
if values.get('WEBHOOK_GLOBAL_ENABLED', '').lower() != 'false':
    raise SystemExit('Webhook global nao esta explicitamente desativado; instalacao interrompida.')
target.mkdir(mode=0o700)
for name in ('server.mjs', 'Dockerfile', 'compose.example.yml'):
    (target / name).write_bytes(base64.b64decode(payload[name], validate=True))
token = secrets.token_urlsafe(48)
fd = os.open(target / '.env', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write('EVOLUTION_URL=http://evolution_api:8080\n')
    f.write('EVOLUTION_API_KEY=' + key + '\n')
    f.write('MB_WHATSAPP_BRIDGE_TOKEN=' + token + '\n')
    f.write('PORT=3101\n')
env = os.environ.copy()
env['EVOLUTION_DOCKER_NETWORK'] = 'deploy_evolution'
print('Instalando adaptador isolado; isso pode levar alguns minutos.', flush=True)
subprocess.run(['docker', 'compose', '-f', 'compose.example.yml', 'up', '-d', '--build'], cwd=target, env=env, check=True)
url = 'http://127.0.0.1:3101/organizations/00000000-0000-0000-0000-000000000000/status'
for attempt in range(15):
    try:
        request = urllib.request.Request(url, data=b'{}', headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=5) as response:
            result = json.load(response)
        if result.get('state') != 'missing':
            raise RuntimeError('Resposta inesperada para sessao inexistente.')
        break
    except (OSError, urllib.error.URLError):
        if attempt == 14: raise
        time.sleep(2)
try:
    urllib.request.urlopen(urllib.request.Request(url, data=b'{}'), timeout=5)
    raise RuntimeError('O adaptador aceitou requisicao sem autenticacao.')
except urllib.error.HTTPError as e:
    if e.code != 401: raise
print('Adaptador ativo e autenticacao testada. Nenhuma sessao WhatsApp foi criada.')
print('A rota HTTPS e a configuracao da Vercel ainda nao foram instaladas.')
'@
$remotePython = $remotePython.Replace('__PAYLOAD__', $payloadBase64)
$remotePython | ssh -o BatchMode=yes -o ConnectTimeout=10 root@191.252.205.29 python3 -
if ($LASTEXITCODE -ne 0) { throw 'A instalacao parou. Envie a saida para diagnostico antes de repetir.' }
