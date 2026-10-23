// PostgreSQL real e descartavel via Docker. Nao le .env nem conecta ao Supabase.
// Executar: node scripts/validate_fiscal_postgres.cjs
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const ts = require('typescript');

const image = 'postgres:17-alpine';
const label = 'autoeletrica.fiscal-validation=disposable';
const orgA = '00000000-0000-0000-0000-000000000001';
const orgB = '00000000-0000-0000-0000-000000000002';
const results = [];
let container, counter = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const literal = (value) => value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;

function processCommand(args, input, interactive = false) {
    const child = spawn('docker', args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const task = { child, stdout: '', stderr: '' };
    child.stdout.on('data', (chunk) => { task.stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { task.stderr += chunk.toString(); });
    task.done = new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code) => resolve({ code, stdout: task.stdout, stderr: task.stderr }));
    });
    // A rejeicao e acompanhada pelo chamador; evita avisos antes de aguardar.
    task.done.catch(() => {});
    if (!interactive) child.stdin.end(input || '');
    else if (input) child.stdin.write(input);
    return task;
}
async function docker(args, input) {
    const result = await processCommand(args, input).done;
    if (result.code !== 0) throw new Error(`docker ${args[0]}: ${result.stderr || result.stdout}`);
    return result.stdout.trim();
}
function connection(sql, interactive = false) {
    return processCommand(['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t', '-U', 'postgres', '-d', 'fiscal_validation', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], sql, interactive);
}
async function sql(query) {
    const result = await connection(query).done;
    if (result.code !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
}
const asApp = (query, org = orgA) => `SET ROLE fiscal_app_test; SET app.test_org=${literal(org)}; ${query}`;
const sale = { infNFe: { ide: { natOp: 'VENDA DE MERCADORIA', finNFe: 1, tpNF: 1 } } };
const special = (nature, finality = 1) => ({ infNFe: { ide: { natOp: nature, finNFe: finality, tpNF: 1 } } });
function insert({ os, type = 'NFCe', status = 'processing', org = orgA, environment = 'production', direction = 'output', payload = sale, id } = {}) {
    id ||= `10000000-0000-0000-0000-${(++counter).toString(16).padStart(12, '0')}`;
    return { id, query: `INSERT INTO public.fiscal_invoices(id,organization_id,work_order_id,tipo_documento,status,environment,direction,payload_json) VALUES (${literal(id)},${literal(org)},${os === null ? 'NULL' : os},${literal(type)},${literal(status)},${literal(environment)},${literal(direction)},${literal(JSON.stringify(payload))}::jsonb);` };
}
async function expectReject(query, code = '23505') {
    const result = await connection(query).done;
    assert.notEqual(result.code, 0, 'A operacao deve ser recusada');
    assert.ok(result.stderr.includes(code), `Esperado SQLSTATE ${code}; recebido: ${result.stderr}`);
}
async function scenario(name, run) {
    await run();
    results.push({ name, passed: true });
    console.log(`PASS ${name}`);
}
async function until(check, message, timeout = 15000) {
    const limit = Date.now() + timeout;
    while (Date.now() < limit) {
        if (await check()) return;
        await sleep(120);
    }
    throw new Error(message);
}

async function concurrent({ os, first = 'NFCe', second = 'NFe', rollback = false, status = 'processing' }) {
    const firstInsert = insert({ os, type: first, status });
    const secondInsert = insert({ os, type: second });
    const sessionA = connection(asApp(`SET application_name='fiscal_race_a'; BEGIN ISOLATION LEVEL READ COMMITTED; ${firstInsert.query}\n\\echo FIRST_INSERT_READY\n`), true);
    let sessionB;
    try {
        await until(async () => {
            if (sessionA.stderr) throw new Error(sessionA.stderr);
            return (await sql("SELECT count(*) FROM pg_catalog.pg_stat_activity WHERE application_name='fiscal_race_a' AND state='idle in transaction';")) === '1';
        }, 'Sessao A nao confirmou a primeira insercao');
        sessionB = connection(asApp(`SET application_name='fiscal_race_b'; BEGIN ISOLATION LEVEL READ COMMITTED; ${secondInsert.query} COMMIT;`));
        // Comprova espera real no advisory lock antes de liberar a primeira sessao.
        await until(async () => (await sql("SELECT count(*) FROM pg_catalog.pg_stat_activity WHERE application_name='fiscal_race_b' AND wait_event_type='Lock' AND lower(wait_event)='advisory';")) === '1',
            'Sessao B nao ficou bloqueada no advisory lock');
        sessionA.child.stdin.end(`${rollback ? 'ROLLBACK' : 'COMMIT'};\n`);
        const a = await sessionA.done;
        const b = await sessionB.done;
        assert.equal(a.code, 0, a.stderr);
        if (rollback) assert.equal(b.code, 0, b.stderr);
        else { assert.notEqual(b.code, 0); assert.ok(b.stderr.includes('23505'), b.stderr); }
        const count = await sql(`SELECT count(*) FROM public.fiscal_invoices WHERE work_order_id=${os};`);
        assert.equal(count, '1');
    } finally {
        if (!sessionA.child.stdin.destroyed && !sessionA.child.stdin.writableEnded) sessionA.child.stdin.end('ROLLBACK;\n');
        await sessionA.done;
        if (sessionB) await sessionB.done;
    }
}

async function main() {
    const name = `autoeletrica-fiscal-validation-${Date.now()}`;
    console.log('Criando PostgreSQL descartavel sem rede externa ou volumes...');
    container = await docker(['run', '--detach', '--rm', '--network', 'none', '--label', label, '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_DB=fiscal_validation', image]);
    assert.match(container, /^[a-f0-9]{64}$/);
    try {
        await until(async () => (await processCommand(['exec', container, 'pg_isready', '-U', 'postgres', '-d', 'fiscal_validation']).done).code === 0,
            'PostgreSQL nao iniciou', 45000);
        const version = await sql("SELECT current_setting('server_version');");
        const setup = `
CREATE ROLE fiscal_app_test NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE TABLE public.fiscal_invoices (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL, work_order_id bigint,
 tipo_documento text NOT NULL, status text DEFAULT 'draft', environment text DEFAULT 'production',
 direction text DEFAULT 'output', payload_json jsonb
);
CREATE FUNCTION public.get_my_organization_id() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('app.test_org',true),'')::uuid;
$$;
ALTER TABLE public.fiscal_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_select_fiscal_invoices ON public.fiscal_invoices FOR SELECT USING (organization_id=public.get_my_organization_id());
CREATE POLICY tenant_insert_fiscal_invoices ON public.fiscal_invoices FOR INSERT WITH CHECK (organization_id=public.get_my_organization_id());
CREATE POLICY tenant_update_fiscal_invoices ON public.fiscal_invoices FOR UPDATE USING (organization_id=public.get_my_organization_id());
CREATE POLICY tenant_delete_fiscal_invoices ON public.fiscal_invoices FOR DELETE USING (organization_id=public.get_my_organization_id());
GRANT USAGE ON SCHEMA public TO fiscal_app_test;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fiscal_invoices TO fiscal_app_test;
`;
        await sql(setup);
        await sql(fs.readFileSync('migration_prevent_duplicate_product_sale_per_os.sql', 'utf8'));
        await scenario('Instalacao da migracao e papel sem bypass de RLS', async () => {
            assert.equal(await sql(asApp("SELECT current_user || ':' || rolbypassrls::text FROM pg_catalog.pg_roles WHERE rolname=current_user;")), 'fiscal_app_test:false');
            assert.equal(await sql("SELECT count(*) FROM pg_catalog.pg_trigger WHERE tgrelid='public.fiscal_invoices'::regclass AND tgname='trg_prevent_duplicate_active_fiscal_invoice_per_os' AND tgenabled='O';"), '1');
        });
        await scenario('NFC-e e NF-e bloqueiam a outra venda nos quatro status ativos', async () => {
            let os = 100;
            for (const status of ['draft','pending','processing','authorized']) {
                for (const types of [['NFCe','NFe'],['NFe','NFCe']]) {
                    os++;
                    await sql(asApp(insert({ os, type: types[0], status }).query));
                    await expectReject(asApp(insert({ os, type: types[1] }).query));
                }
            }
        });
        await scenario('Concorrencia real: NFC-e primeiro, NF-e espera e e recusada', () => concurrent({ os: 201 }));
        await scenario('Concorrencia real: NF-e primeiro, NFC-e espera e e recusada', () => concurrent({ os: 202, first: 'NFe', second: 'NFCe' }));
        await scenario('Concorrencia real: rollback libera a segunda conexao', () => concurrent({ os: 203, rollback: true }));
        await scenario('Concorrencia real: duas NFS-e da mesma OS', () => concurrent({ os: 204, first: 'NFSe', second: 'NFSe' }));
        await scenario('Cancelamento/rejeicao permitem outra venda', async () => {
            let os = 300;
            for (const status of ['cancelled','error','rejected']) {
                os++;
                const first = insert({ os });
                await sql(asApp(first.query));
                await sql(asApp(`UPDATE public.fiscal_invoices SET status=${literal(status)} WHERE id=${literal(first.id)};`));
                await sql(asApp(insert({ os, type: 'NFe' }).query));
            }
        });
        await scenario('Reativar erro/cancelamento e mover OS/ambiente passam pela trava', async () => {
            await sql(asApp(insert({ os: 401, status: 'authorized' }).query));
            for (const status of ['error','rejected','cancelled']) {
                const inactive = insert({ os: 401, type: 'NFe', status });
                await sql(asApp(inactive.query));
                await expectReject(asApp(`UPDATE public.fiscal_invoices SET status='processing' WHERE id=${literal(inactive.id)};`));
            }
            const movingOS = insert({ os: 402, type: 'NFe' });
            const movingEnv = insert({ os: 401, type: 'NFe', environment: 'homologation' });
            await sql(asApp(movingOS.query + movingEnv.query));
            await expectReject(asApp(`UPDATE public.fiscal_invoices SET work_order_id=401 WHERE id=${literal(movingOS.id)};`));
            await expectReject(asApp(`UPDATE public.fiscal_invoices SET environment='production' WHERE id=${literal(movingEnv.id)};`));
        });
        await scenario('Isolamento de organizacao, ambiente e categoria de servico', async () => {
            await sql(asApp(insert({ os: 501 }).query));
            await sql(asApp(insert({ os: 501, type: 'NFe', environment: 'homologation' }).query));
            await sql(asApp(insert({ os: 501, type: 'NFe', org: orgB }).query, orgB));
            await sql(asApp(insert({ os: 501, type: 'NFSe' }).query));
            assert.equal(await sql(asApp('SELECT count(*) FROM public.fiscal_invoices WHERE work_order_id=501;')), '3');
            assert.equal(await sql(asApp('SELECT count(*) FROM public.fiscal_invoices WHERE work_order_id=501;', orgB)), '1');
            await expectReject(asApp(insert({ os: 502, org: orgB }).query), '42501');
        });
        await scenario('Remessas/retornos/devolucoes nao consomem a venda', async () => {
            let os = 600;
            for (const payload of [special('REMESSA PARA CONSERTO'), special('RETORNO DE GARANTIA'), special('TRANSFERENCIA'), special('BONIFICACAO'), special('DEVOLUCAO',4)]) {
                os++;
                await sql(asApp(insert({ os, type: 'NFe', payload }).query));
                await sql(asApp(insert({ os, type: 'NFCe' }).query));
                await expectReject(asApp(insert({ os, type: 'NFe' }).query));
                await sql(asApp(insert({ os, type: 'NFe', payload }).query));
            }
        });
        await scenario('Notas legadas duplicadas podem sincronizar, novas ficam bloqueadas', async () => {
            const a = insert({ os: 701, status: 'authorized' });
            const b = insert({ os: 701, type: 'NFe', status: 'processing' });
            await sql(`BEGIN; ALTER TABLE public.fiscal_invoices DISABLE TRIGGER trg_prevent_duplicate_active_fiscal_invoice_per_os; ${a.query} ${b.query} ALTER TABLE public.fiscal_invoices ENABLE TRIGGER trg_prevent_duplicate_active_fiscal_invoice_per_os; COMMIT;`);
            await sql(asApp(`UPDATE public.fiscal_invoices SET status='authorized' WHERE id=${literal(b.id)}; UPDATE public.fiscal_invoices SET payload_json=payload_json || '{"synced":true}'::jsonb WHERE id=${literal(a.id)};`));
            await expectReject(asApp(insert({ os: 701 }).query));
        });
        await scenario('Classificacao SQL corresponde ao TypeScript nos casos gravados', async () => {
            const module = { exports: {} };
            const code = ts.transpileModule(fs.readFileSync('src/lib/work-order-fiscal.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
            new Function('module','exports',code)(module,module.exports);
            const remessa = special('REMESSA PARA CONSERTO');
            const cases = [null, {}, sale, remessa, special('DEVOLUCAO',4), JSON.stringify(sale), JSON.stringify(remessa), 'invalid json', { infNFe: { ide: { natOp:'',tpNF:0 } } }];
            for (const type of ['NFCe','NFe','NFSe']) for (const payload of cases) {
                const expected = module.exports.isProductSaleInvoice({ tipo_documento:type, payload_json:payload });
                const actual = await sql(`SELECT public.fiscal_is_product_sale(${literal(type)},${literal(JSON.stringify(payload))}::jsonb)::text;`);
                assert.equal(actual,String(expected),`${type} ${JSON.stringify(payload)}`);
            }
        });
        const report = { completed_at: new Date().toISOString(), postgres_version: version, image, isolation: 'read committed', real_independent_connections: true, synthetic_role: 'fiscal_app_test NOBYPASSRLS', cases: results, passed: results.length, limitation: 'Fixture com as colunas do trigger e politicas por organizacao; nao reproduz PostgREST/JWT nem todos os constraints do Supabase.' };
        const directory = path.join(process.cwd(),'artifacts','fiscal-validation');
        fs.mkdirSync(directory,{recursive:true});
        fs.writeFileSync(path.join(directory,'postgres-tests.json'),JSON.stringify(report,null,2));
        console.log(JSON.stringify(report,null,2));
    } finally {
        const actualLabel = await docker(['inspect','--format','{{index .Config.Labels "autoeletrica.fiscal-validation"}}',container]);
        assert.equal(actualLabel,'disposable','Remocao permitida apenas para o container criado por este teste');
        await docker(['rm','--force',container]);
        console.log('PostgreSQL descartavel removido. Nenhum banco externo foi acessado pelo teste.');
    }
}
main().catch((error) => { console.error(error.stack || error.message); process.exitCode=1; });
