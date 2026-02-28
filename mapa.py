$root = "g:\projetos\autoeletrica"
$dest = Join-Path $root "_notebooklm_agendamento"

$files = @(
  "app\(admin)\agendamentos\page.tsx",
  "app\(admin)\agendamentos\_components\RescheduleModal.tsx",
  "app\(admin)\agendamentos\_components\MonthCalendarPopover.tsx",
  "src\components\GlobalAppointmentAlert.tsx",
  "app\api\agendamentos\alertas\route.ts",
  "app\api\agendamentos\alertas\adiar\route.ts",
  "app\(admin)\atendimento\nova-os\page.tsx",
  "app\(admin)\os\detalhes\[id]\page.tsx",
  "app\acompanhar\page.tsx",
  "app\api\portal\os\route.ts",
  "app\api\portal\confirmar-presenca\route.ts",
  "app\api\portal\aprovar\route.ts",
  "migration_appointments.sql",
  "migration_add_confirmado_status.sql",
  "migration_add_alerta_adiado_ate.sql"
)

Remove-Item -LiteralPath $dest -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $dest | Out-Null

foreach ($f in $files) {
  $src = Join-Path $root $f
  $out = Join-Path $dest $f
  $outDir = Split-Path $out -Parent
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
  Copy-Item -LiteralPath $src -Destination $out -Force
}

$zip = Join-Path $root "notebooklm-agendamento.zip"
if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }
Compress-Archive -Path (Join-Path $dest "*") -DestinationPath $zip -Force

Write-Host "ZIP gerado em: $zip"
