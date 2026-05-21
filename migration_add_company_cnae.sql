-- Adiciona CNAE ao cadastro da empresa para uso na emissão de NFS-e.
-- Mantém formato esperado (7 dígitos) e faz backfill seguro para registros antigos.

alter table public.company_settings
    add column if not exists cnae text;

update public.company_settings
set cnae = '4520007'
where (cnae is null or btrim(cnae) = '');

