-- Controle atomico de numeracao de NF-e por organizacao, serie e ambiente.
-- Execute esta migration antes de emitir novas NF-e em producao.

create table if not exists public.nfe_sequences (
    id bigserial primary key,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    serie integer not null default 1,
    environment text not null default 'production' check (environment in ('production', 'homologation')),
    last_number integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uq_nfe_sequences_org_serie_env
    on public.nfe_sequences (organization_id, serie, environment);

alter table public.nfe_sequences enable row level security;

drop policy if exists "Permitir leitura para membros da mesma org" on public.nfe_sequences;
create policy "Permitir leitura para membros da mesma org" on public.nfe_sequences
    for select
    using (
        organization_id in (
            select organization_id
            from public.profiles
            where id = auth.uid()
        )
    );

drop policy if exists "Permitir alteracao para membros da mesma org" on public.nfe_sequences;
create policy "Permitir alteracao para membros da mesma org" on public.nfe_sequences
    for all
    using (
        organization_id in (
            select organization_id
            from public.profiles
            where id = auth.uid()
        )
    )
    with check (
        organization_id in (
            select organization_id
            from public.profiles
            where id = auth.uid()
        )
    );

create or replace function public.set_updated_at_nfe_sequences()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_set_updated_at_nfe_sequences on public.nfe_sequences;
create trigger trg_set_updated_at_nfe_sequences
before update on public.nfe_sequences
for each row execute function public.set_updated_at_nfe_sequences();

-- Inicializa a sequencia a partir das NF-e de saida ja gravadas.
insert into public.nfe_sequences (organization_id, serie, environment, last_number)
select
    organization_id,
    case
        when coalesce(serie, '') ~ '^[0-9]+$' then serie::integer
        else 1
    end as serie,
    coalesce(environment, 'production') as environment,
    max(numero::integer) as last_number
from public.fiscal_invoices
where tipo_documento = 'NFe'
  and direction = 'output'
  and coalesce(numero, '') ~ '^[0-9]+$'
group by
    organization_id,
    case
        when coalesce(serie, '') ~ '^[0-9]+$' then serie::integer
        else 1
    end,
    coalesce(environment, 'production')
on conflict (organization_id, serie, environment)
do update set
    last_number = greatest(public.nfe_sequences.last_number, excluded.last_number),
    updated_at = now();

drop function if exists public.get_next_nfe_number(uuid, integer);
drop function if exists public.get_next_nfe_number(uuid, integer, text);

create or replace function public.get_next_nfe_number(
    p_org_id uuid,
    p_serie integer,
    p_environment text default 'production'
)
returns integer
language plpgsql
security definer
as $$
declare
    v_next_number integer;
begin
    update public.nfe_sequences
    set last_number = last_number + 1
    where organization_id = p_org_id
      and serie = p_serie
      and environment = p_environment
    returning last_number into v_next_number;

    if v_next_number is null then
        insert into public.nfe_sequences (organization_id, serie, environment, last_number)
        values (p_org_id, p_serie, p_environment, 1)
        on conflict (organization_id, serie, environment)
        do update set
            last_number = public.nfe_sequences.last_number + 1,
            updated_at = now()
        returning last_number into v_next_number;
    end if;

    return v_next_number;
end;
$$;
