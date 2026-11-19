-- Registro de chamadas à Cosmos. Execute antes de publicar o código.
CREATE TABLE IF NOT EXISTS public.cosmos_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  ean text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('found', 'not_found', 'error')),
  http_status integer,
  duration_ms integer NOT NULL
);
CREATE INDEX IF NOT EXISTS cosmos_usage_org_date_idx ON public.cosmos_usage (organization_id, created_at);
ALTER TABLE public.cosmos_usage ENABLE ROW LEVEL SECURITY;
-- Escrita apenas pelo servidor; leitura apenas pelo responsável da organização.
DROP POLICY IF EXISTS cosmos_usage_owner_select ON public.cosmos_usage;
CREATE POLICY cosmos_usage_owner_select ON public.cosmos_usage FOR SELECT TO authenticated
USING (organization_id = public.get_my_organization_id() AND EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND cargo = 'owner'
));
GRANT SELECT ON public.cosmos_usage TO authenticated;

GRANT INSERT ON public.cosmos_usage TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.cosmos_usage_id_seq TO service_role;
