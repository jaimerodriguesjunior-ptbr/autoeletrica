-- Separa a numeracao NFC-e por ambiente e cria historico de inutilizacoes.

alter table public.nfce_sequences
    add column if not exists environment text not null default 'production';

alter table public.nfce_sequences
    drop constraint if exists nfce_sequences_organization_id_serie_key;

create unique index if not exists uq_nfce_sequences_org_serie_env
    on public.nfce_sequences (organization_id, serie, environment);

drop function if exists public.get_next_nfce_number(uuid, integer);
drop function if exists public.get_next_nfce_number(uuid, integer, text);

create or replace function public.get_next_nfce_number(
    p_org_id uuid,
    p_serie integer,
    p_environment text default 'production'
)
returns integer as $$
declare
    v_next_number integer;
begin
    update public.nfce_sequences
    set last_number = last_number + 1
    where organization_id = p_org_id
      and serie = p_serie
      and environment = p_environment
    returning last_number into v_next_number;

    if v_next_number is null then
        insert into public.nfce_sequences (organization_id, serie, environment, last_number)
        values (p_org_id, p_serie, p_environment, 1)
        on conflict (organization_id, serie, environment)
        do update set last_number = public.nfce_sequences.last_number + 1
        returning last_number into v_next_number;
    end if;

    return v_next_number;
end;
$$ language plpgsql security definer;

create table if not exists public.fiscal_inutilizations (
    id bigserial primary key,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    environment text not null check (environment in ('production', 'homologation')),
    model text not null default 'NFCe',
    year integer not null,
    serie integer not null,
    numero_inicial integer not null,
    numero_final integer not null,
    justificativa text not null,
    protocol text null,
    external_id text null,
    status text null,
    response_json jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_fiscal_inutilizations_org_year
    on public.fiscal_inutilizations (organization_id, year, environment);

create unique index if not exists uq_fiscal_inutilizations_external
    on public.fiscal_inutilizations (external_id)
    where external_id is not null;

create or replace function public.set_updated_at_fiscal_inutilizations()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_set_updated_at_fiscal_inutilizations on public.fiscal_inutilizations;
create trigger trg_set_updated_at_fiscal_inutilizations
before update on public.fiscal_inutilizations
for each row execute function public.set_updated_at_fiscal_inutilizations();
