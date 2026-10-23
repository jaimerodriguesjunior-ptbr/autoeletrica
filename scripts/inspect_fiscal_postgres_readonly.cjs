// Inspecao de catalogo: endpoint Supabase somente leitura. Nao consulta notas.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
require('dotenv').config({ path: '.env.local', quiet: true });

const query = `SELECT pg_catalog.jsonb_build_object(
 'server_version', current_setting('server_version'),
 'inspection_role', current_user,
 'inspection_default_isolation', current_setting('default_transaction_isolation'),
 'inspection_read_only', current_setting('transaction_read_only'),
 'transaction_defaults', (SELECT jsonb_agg(jsonb_build_object('name',name,'setting',setting,'source',source,'reset_value',reset_val))
   FROM pg_catalog.pg_settings WHERE name IN ('default_transaction_isolation','row_security')),
 'functions', (SELECT jsonb_agg(jsonb_build_object('name',p.proname,'body',p.prosrc,'security_definer',p.prosecdef,'volatility',p.provolatile))
   FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('fiscal_is_product_sale','prevent_duplicate_active_fiscal_invoice_per_os','get_my_organization_id')),
 'triggers', (SELECT jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)))
   FROM pg_catalog.pg_trigger t WHERE t.tgrelid='public.fiscal_invoices'::regclass AND NOT t.tgisinternal),
 'policies', (SELECT jsonb_agg(jsonb_build_object('name',policyname,'roles',roles,'command',cmd,'using',qual,'check',with_check))
   FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='fiscal_invoices'),
 'table_security', (SELECT jsonb_build_object('rls',relrowsecurity,'force_rls',relforcerowsecurity)
   FROM pg_catalog.pg_class WHERE oid='public.fiscal_invoices'::regclass),
 'roles', (SELECT jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'bypass_rls',rolbypassrls))
   FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated','authenticator','service_role')),
 'role_settings', (SELECT jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'ALL'),'database',COALESCE(d.datname,'ALL'),'setting',c.setting))
   FROM pg_catalog.pg_db_role_setting s LEFT JOIN pg_catalog.pg_roles r ON r.oid=s.setrole
   LEFT JOIN pg_catalog.pg_database d ON d.oid=s.setdatabase
   CROSS JOIN LATERAL unnest(s.setconfig) c(setting)
   WHERE (s.setdatabase=0 OR d.datname=current_database())
     AND (s.setrole=0 OR r.rolname IN ('anon','authenticated','authenticator'))
     AND (c.setting LIKE '%transaction_isolation=%' OR c.setting LIKE 'row_security=%' OR c.setting LIKE 'pgrst.db_pre_request=%')),
 'indexes', (SELECT jsonb_agg(jsonb_build_object('name',indexname,'definition',indexdef))
   FROM pg_catalog.pg_indexes WHERE schemaname='public' AND tablename='fiscal_invoices'
   AND indexname IN ('idx_fiscal_active_product_sale_os','idx_fiscal_invoices_active_os_lookup'))
) AS catalog;`;

function normalize(body) {
    return body.replace(/--[^\r\n]*/g, '').replace(/\s+/g, ' ').trim();
}
async function main() {
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    if (!token) throw new Error('SUPABASE_ACCESS_TOKEN indisponivel; nenhuma consulta executada.');
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query/read-only`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    });
    if (!response.ok) throw new Error(`Inspecao somente leitura: HTTP ${response.status}.`);
    const data = await response.json();
    const catalog = data[0]?.catalog;
    assert.ok(catalog, 'Resposta de catalogo esperada');
    const migration = fs.readFileSync('migration_prevent_duplicate_product_sale_per_os.sql', 'utf8');
    const comparisons = [];
    for (const name of ['fiscal_is_product_sale', 'prevent_duplicate_active_fiscal_invoice_per_os']) {
        const pattern = new RegExp(`CREATE OR REPLACE FUNCTION ${name}\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`);
        const local = migration.match(pattern)?.[1];
        const installed = catalog.functions?.find((fn) => fn.name === name);
        comparisons.push({ name, found: !!installed, body_matches_local: !!local && !!installed && normalize(local) === normalize(installed.body) });
    }
    const installedTrigger = catalog.triggers?.find((entry) => entry.name === 'trg_prevent_duplicate_active_fiscal_invoice_per_os');
    assert.equal(installedTrigger?.enabled, 'O', 'Trigger instalado deve estar habilitado para operacoes normais');
    assert.match(installedTrigger.definition, /ON public\.fiscal_invoices FOR EACH ROW EXECUTE FUNCTION/);
    assert.equal(catalog.functions.find((entry) => entry.name === 'fiscal_is_product_sale')?.volatility, 'i');
    assert.equal(catalog.functions.find((entry) => entry.name === 'prevent_duplicate_active_fiscal_invoice_per_os')?.volatility, 'v');
    assert.equal(catalog.table_security?.rls, true);
    assert.ok(catalog.policies?.some((entry) => entry.command === 'SELECT' && entry.using?.includes('get_my_organization_id()')));
    assert.ok(catalog.indexes?.some((entry) => entry.name === 'idx_fiscal_active_product_sale_os'));
    const result = { inspected_at: new Date().toISOString(), mode: 'read-only catalog; no fiscal rows read or changed', comparisons, catalog };
    const directory = path.join(process.cwd(), 'artifacts', 'fiscal-validation');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'installed-catalog.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ comparisons, version: catalog.server_version, transaction_defaults: catalog.transaction_defaults, table_security: catalog.table_security, relevant_role_settings: catalog.role_settings, triggers: catalog.triggers, policies: catalog.policies, roles: catalog.roles, index_names: catalog.indexes?.map((entry) => entry.name) }, null, 2));
    assert.ok(comparisons.every((entry) => entry.body_matches_local), 'As funcoes instaladas devem corresponder a migracao local');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
