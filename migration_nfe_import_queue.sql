create table if not exists public.nfe_distribution_state (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cpf_cnpj text not null,
  ambiente text not null default 'producao',
  ultimo_nsu bigint not null default 0,
  max_nsu bigint,
  initial_sync_completed boolean not null default false,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, cpf_cnpj, ambiente)
);

create table if not exists public.nfe_import_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  chave_acesso text not null,
  nuvemfiscal_document_id text,
  nsu bigint,
  schema text,
  resumo boolean not null default false,
  status text not null default 'pending',
  xml_content text,
  error_message text,
  numero text,
  serie text,
  emitente_nome text,
  emitente_cnpj text,
  data_emissao timestamptz,
  valor_total numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  imported_at timestamptz,
  ignored_at timestamptz,
  unique (organization_id, chave_acesso)
);

create index if not exists nfe_import_queue_org_status_idx
  on public.nfe_import_queue (organization_id, status, data_emissao desc);

create index if not exists nfe_import_queue_org_nsu_idx
  on public.nfe_import_queue (organization_id, nsu);

alter table public.nfe_distribution_state enable row level security;
alter table public.nfe_import_queue enable row level security;

create policy "nfe_distribution_state_select_own_org"
  on public.nfe_distribution_state for select
  using (organization_id = public.get_my_organization_id());

create policy "nfe_distribution_state_insert_own_org"
  on public.nfe_distribution_state for insert
  with check (organization_id = public.get_my_organization_id());

create policy "nfe_import_queue_select_own_org"
  on public.nfe_import_queue for select
  using (organization_id = public.get_my_organization_id());

create policy "nfe_import_queue_insert_own_org"
  on public.nfe_import_queue for insert
  with check (organization_id = public.get_my_organization_id());

create policy "nfe_import_queue_update_own_org"
  on public.nfe_import_queue for update
  using (organization_id = public.get_my_organization_id())
  with check (organization_id = public.get_my_organization_id());
