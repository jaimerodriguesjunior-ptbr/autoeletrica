-- Serie padrao de NF-e por empresa.
-- Mantem compatibilidade com o comportamento atual usando serie 1 como padrao.

alter table public.company_settings
    add column if not exists nfe_serie integer not null default 1;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'company_settings_nfe_serie_positive'
    ) then
        alter table public.company_settings
            add constraint company_settings_nfe_serie_positive
            check (nfe_serie > 0)
            not valid;
    end if;
end;
$$;

alter table public.company_settings
    validate constraint company_settings_nfe_serie_positive;
