-- Configuração isolada por oficina. Escritas somente pelo backend autenticado.
create table if not exists public.whatsapp_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_settings enable row level security;
revoke all on public.whatsapp_settings from anon, authenticated;
grant all on public.whatsapp_settings to service_role;

-- Reserva persistente: uma repetição da mesma requisição nunca reenvia o PDF.
create table if not exists public.whatsapp_sends (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  document_type text not null,
  document_id text not null,
  status text not null check (status in ('pending', 'accepted', 'unknown')),
  provider_id text,
  created_at timestamptz not null default now()
);
alter table public.whatsapp_sends enable row level security;
revoke all on public.whatsapp_sends from anon, authenticated;
grant all on public.whatsapp_sends to service_role;
