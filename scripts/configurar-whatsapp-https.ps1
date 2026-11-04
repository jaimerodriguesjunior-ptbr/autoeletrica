# Acrescenta uma rota isolada no endereço HTTPS existente da VPS.
$ErrorActionPreference = 'Stop'
$remotePython = @'
import json, os, shutil, subprocess, time, urllib.request, urllib.error
from pathlib import Path

target = Path('/opt/mbgarage-whatsapp')
config = Path('/etc/nginx/sites-available/wa.mentebinaria.com')
backup = target / 'nginx-wa-original.conf'
zone = Path('/etc/nginx/conf.d/mbgarage-rate.conf')
if not target.is_dir() or not (target / '.env').is_file() or not config.is_file():
    raise SystemExit('Adaptador ou configuracao HTTPS nao encontrados; interrompido.')
if backup.exists() or zone.exists():
    raise SystemExit('Configuracao ou backup ja existem; interrompido para evitar sobrescrita.')
original = config.read_text()
marker = '    location / {'
if original.count(marker) != 1 or '/mbgarage/' in original or '127.0.0.1:8081' not in original:
    raise SystemExit('Configuracao HTTPS mudou; interrompido para revisao manual.')
env = dict(line.split('=', 1) for line in (target / '.env').read_text().splitlines() if '=' in line)
token = env.get('MB_WHATSAPP_BRIDGE_TOKEN', '')
if len(token) < 32:
    raise SystemExit('Credencial do adaptador indisponivel; interrompido.')
subprocess.run(['nginx', '-t'], check=True)
location = '''    location ^~ /mbgarage/ {
        limit_req zone=mbgarage_whatsapp burst=20 nodelay;
        limit_req_status 429;
        client_max_body_size 15m;
        proxy_pass http://127.0.0.1:3101/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
    }

'''
shutil.copy2(config, backup)
os.chmod(backup, 0o600)
changed = False
try:
    zone.write_text('limit_req_zone $binary_remote_addr zone=mbgarage_whatsapp:1m rate=30r/m;\n')
    changed = True
    config.write_text(original.replace(marker, location + marker, 1))
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    url = 'https://wa.mentebinaria.com/mbgarage/organizations/00000000-0000-0000-0000-000000000000/status'
    for i in range(8):
        try:
            request = urllib.request.Request(url, data=b'{}', headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, timeout=10) as response:
                result = json.load(response)
            if result.get('state') != 'missing':
                raise RuntimeError('Resposta inesperada para sessao inexistente.')
            break
        except (OSError, urllib.error.URLError):
            if i == 7: raise
            time.sleep(2)
    try:
        urllib.request.urlopen(urllib.request.Request(url, data=b'{}'), timeout=10)
        raise RuntimeError('A rota aceitou requisicao sem autenticacao.')
    except urllib.error.HTTPError as error:
        if error.code != 401: raise
    print('Rota HTTPS do MB Garage ativa; teste autenticado e bloqueio sem credencial confirmados.')
    print('A rota principal da otica foi preservada. Nenhuma sessao WhatsApp foi criada.')
except BaseException:
    if changed:
        config.write_text(original)
    if zone.exists():
        zone.unlink()
    check = subprocess.run(['nginx', '-t'])
    if check.returncode == 0:
        subprocess.run(['systemctl', 'reload', 'nginx'])
        print('Configuracao HTTPS anterior restaurada; nao execute novamente sem revisao.')
    else:
        print('ATENCAO: validacao da configuracao anterior falhou; revisar Nginx imediatamente.')
    raise
'@
$remotePython | ssh -o BatchMode=yes -o ConnectTimeout=10 root@191.252.205.29 python3 -
if ($LASTEXITCODE -ne 0) { throw 'A configuracao parou. Envie a saida para diagnostico antes de repetir.' }
