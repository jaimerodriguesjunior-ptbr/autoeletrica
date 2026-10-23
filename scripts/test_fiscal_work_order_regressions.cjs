// Testes isolados: sem .env, rede, banco real ou chamadas ao provedor fiscal.
// Executar: node --test scripts/test_fiscal_work_order_regressions.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(source, dependencies = {}) {
    const code = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', code)(
        (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module, module.exports);
    return module.exports;
}
const read = (file) => fs.readFileSync(file, 'utf8');
const fiscal = load(read('src/lib/work-order-fiscal.ts'));
function extract(file, name) {
    const source = read(file);
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let found;
    function visit(node) {
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(ast);
        if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = node.initializer.getText(ast);
        ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.ok(found, `Declaration ${name}`);
    return found;
}
function expression(source, scope) {
    const js = ts.transpileModule(`const result = ${source}; return result;`, {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    }).outputText;
    return new Function(...Object.keys(scope), js)(...Object.values(scope));
}
function database(tables, fail = () => false) {
    const calls = [];
    return { calls, from(table) {
        const filters = [], orders = [];
        let from = 0, to = 999;
        const query = {
            select() { return query; },
            eq(key, value) { filters.push({ key, value, test: (row) => row[key] === value }); return query; },
            in(key, values) {
                if (key === 'work_order_id') assert.ok(values.length <= 200, 'IN deve usar lotes de ate 200 OS');
                filters.push({ key, value: values, test: (row) => values.includes(row[key]) }); return query;
            },
            not(key, operator, value) { filters.push({ key, value, test: (row) => row[key] !== value }); return query; },
            order(key, options = {}) { orders.push({ key, ascending: options.ascending !== false }); return query; },
            range(start, end) { from = start; to = Math.min(end, start + 999); return query; },
            limit(count) { to = from + count - 1; return query; },
            then(resolve, reject) {
                calls.push({ table, filters, from, to });
                let rows = (tables[table] || []).filter((row) => filters.every((filter) => filter.test(row)));
                rows = [...rows].sort((a, b) => {
                    for (const { key, ascending } of orders) {
                        if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1);
                    }
                    return 0;
                });
                return Promise.resolve(fail(table, from)
                    ? { data: null, error: { message: 'simulated query failure' } }
                    : { data: rows.slice(from, to + 1), error: null }).then(resolve, reject);
            },
        };
        return query;
    } };
}
function actions(db) {
    return load(read('src/actions/fiscal_db.ts'), {
        '@/src/utils/supabase/server': { createClient: () => db },
        '@/src/lib/nfe_xml': {}, '@/src/lib/work-order-fiscal': fiscal,
    });
}
const sale = { infNFe: { ide: { natOp: 'VENDA DE MERCADORIA', finNFe: 1, tpNF: 1 } } };
const remessa = { infNFe: { ide: { natOp: 'REMESSA PARA CONSERTO', finNFe: 1, tpNF: 1 } } };
const note = (id, type, status, os = 1, payload = sale) => ({
    id, tipo_documento: type, status, work_order_id: os, payload_json: payload,
    organization_id: 'org', environment: 'production', direction: 'output',
    numero: id, error_message: null, created_at: id,
});
const item = (os, tipo = 'peca', peca_cliente = false) => ({
    id: `${os}-${tipo}`, work_order_id: os, tipo, peca_cliente, total_price: 80,
});

test('paginacao completa, IN limitado e andamento separado de itens disponiveis', async () => {
    const work_orders = Array.from({ length: 1205 }, (_, i) => ({ id: i + 1, status: 'entregue', organization_id: 'org', created_at: i + 1, total: 160 }));
    const work_order_items = work_orders.flatMap((os) => [item(os.id), item(os.id, 'servico')]);
    work_order_items.push(...Array.from({ length: 1100 }, (_, i) => ({ ...item(1), id: `extra-${i}` })));
    const db = database({ work_orders, work_order_items, fiscal_invoices: [
        note('a', 'NFCe', 'processing', 1205), note('b', 'NFSe', 'authorized', 1205),
        note('c', 'NFCe', 'draft', 1204), note('d', 'NFe', 'authorized', 1203, remessa),
    ] });
    const pending = await actions(db).getPendingWorkOrders('org', 'production');
    const processing = pending.find((os) => os.id === 1205);
    assert.deepEqual(processing.pending_documentos, []);
    assert.deepEqual(processing.documentos_em_andamento, ['NFCe/NFe']);
    assert.deepEqual(pending.find((os) => os.id === 1204).pending_documentos, ['NFSe']);
    assert.deepEqual(pending.find((os) => os.id === 1203).pending_documentos, ['NFCe/NFe', 'NFSe']);
    assert.ok(pending.some((os) => os.id === 1));
    assert.ok(db.calls.some((call) => call.table === 'work_order_items' && call.from >= 1000));
});

test('consulta por OS filtra no servidor e recupera mais de 1000 tentativas antigas', async () => {
    const other = Array.from({ length: 2000 }, (_, i) => note(`new-${i}`, 'NFSe', 'authorized', 999));
    const target = Array.from({ length: 1021 }, (_, i) => note(`old-${i}`, 'NFCe', 'error', 1343));
    const db = database({ fiscal_invoices: [...other, ...target,
        { ...note('hom', 'NFCe', 'authorized', 1343), environment: 'homologation' },
        { ...note('foreign', 'NFCe', 'authorized', 1343), organization_id: 'other' },
    ] });
    const rows = await actions(db).getFiscalInvoices('org', { workOrderId: 1343, environment: 'production' });
    assert.equal(rows.length, 1021);
    assert.ok(rows.every((row) => row.work_order_id === 1343 && row.environment === 'production' && row.organization_id === 'org'));
    assert.ok(db.calls.every((call) => call.filters.some((filter) => filter.key === 'work_order_id' && filter.value === 1343)));
    assert.equal((await actions(db).getFiscalInvoices('org')).length, 3022);
});

test('falha de pagina nunca vira sucesso parcial ou lista vazia', async () => {
    const db = database({ fiscal_invoices: Array.from({ length: 600 }, (_, i) => note(String(i), 'NFCe', 'authorized')) }, (table, from) => from === 500);
    await assert.rejects(actions(db).getFiscalInvoices('org'), /carregar/);
    const fail = database({}, () => true);
    await assert.rejects(actions(fail).getPendingWorkOrders('org', 'production'), /carregar/);
});

const guardSource = extract('src/actions/fiscal_emission.ts', 'ensureNoActiveInvoiceForWorkOrder');
const guard = load(`const { ACTIVE_FISCAL_STATUSES, isProductSaleInvoice } = require('fiscal');\n${guardSource}\nmodule.exports = ensureNoActiveInvoiceForWorkOrder;`, { fiscal });
test('backend cruza NFC-e/NF-e, preserva outras operacoes, ambiente e rejeicoes', async () => {
    const payload = { organization_id: 'org', work_order_id: 1 };
    for (const status of fiscal.ACTIVE_FISCAL_STATUSES) {
        assert.ok(await guard(database({ fiscal_invoices: [note('1', 'NFCe', status)] }), payload, 'NFe', 'production', true));
        assert.ok(await guard(database({ fiscal_invoices: [note('1', 'NFe', status)] }), payload, 'NFCe', 'production', true));
    }
    for (const row of [note('1', 'NFe', 'authorized', 1, remessa), note('1', 'NFCe', 'error'), note('1', 'NFCe', 'cancelled'),
        { ...note('1', 'NFCe', 'authorized'), environment: 'homologation' },
        { ...note('1', 'NFCe', 'authorized'), organization_id: 'other' }]) {
        assert.equal(await guard(database({ fiscal_invoices: [row] }), payload, 'NFCe', 'production', true), null);
    }
    assert.equal(fiscal.isProductSaleInvoice({ tipo_documento: 'NFe', payload_json: JSON.stringify(remessa) }), false);
    assert.equal(fiscal.isProductSaleInvoice({ tipo_documento: 'NFe', payload_json: { infNFe: { ide: { finNFe: 4 } } } }), false);
    assert.equal(fiscal.isProductSaleInvoice({ tipo_documento: 'NFe' }), true);
    await assert.rejects(guard(database({}, () => true), payload, 'NFCe', 'production', true));
});

test('backend pagina operacoes especiais antes de encontrar uma venda ativa', async () => {
    const rows = Array.from({ length: 600 }, (_, i) => note(`a-${i}`, 'NFe', 'authorized', 1, remessa));
    rows.push(note('z', 'NFCe', 'authorized'));
    assert.ok(await guard(database({ fiscal_invoices: rows }), { organization_id: 'org', work_order_id: 1 }, 'NFe', 'production', true));
});

test('cartao apresenta todas as notas, sem ocultar processamento ou erro por uma autorizada', () => {
    const React = require('react');
    const { renderToStaticMarkup } = require('react-dom/server');
    const invoices = [note('new-error', 'NFe', 'error'), note('new-processing', 'NFe', 'processing'), note('old-authorized', 'NFCe', 'authorized')];
    let index = 0;
    const states = [invoices, false, false, 0];
    const { WorkOrderFiscalCard } = load(read('components/os/WorkOrderFiscalCard.tsx'), {
        react: { ...React, useState: () => [states[index++], () => {}], useCallback: (fn) => fn, useEffect: () => {} },
        'next/link': ({ children, ...props }) => React.createElement('a', props, children),
        '@/src/lib/supabase': {}, '@/src/lib/work-order-fiscal': fiscal,
    });
    const html = renderToStaticMarkup(WorkOrderFiscalCard({ organizationId: 'org', workOrderId: 1, status: 'entregue', items: [item(1)] }));
    for (const row of invoices) assert.ok(html.includes(row.numero));
    assert.match(html, /Consultar NF-e/);
    assert.match(html, /Ver tentativa no fiscal/);
    assert.doesNotMatch(html, /documento=NFCe/);
});

function filterEffect() {
    const file = 'app/(admin)/fiscal/page.tsx', source = read(file);
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let effect;
    function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes('filtersBeforeOSRef.current')) effect = node.arguments[0].getText(ast);
        ts.forEachChild(node, visit);
    }
    visit(ast); assert.ok(effect);
    return effect;
}
test('sair do acompanhamento restaura mes padrao ou filtros anteriores completos', () => {
    const defaults = { startDate: '2026-10-01', endDate: '2026-10-31' };
    const base = { ...defaults, searchTerm: 'cliente', statusFilter: 'error', environment: 'homologation' };
    for (const initial of [true, false]) {
        const expected = initial ? { ...defaults, searchTerm: '', statusFilter: 'all', environment: 'production' } : base;
        const values = initial ? { ...expected, startDate: '', endDate: '' } : { ...base };
        const currentFiltersRef = { current: { ...values } };
        const context = { currentFiltersRef, filtersBeforeOSRef: { current: null }, previousLinkedOSRef: { current: initial ? undefined : '' }, defaultFiscalDates: () => defaults };
        for (const key of Object.keys(values)) context[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value) => { values[key] = value; };
        expression(filterEffect(), { ...context, linkedWorkOrder: '1343' })();
        assert.equal(values.startDate, ''); assert.equal(values.environment, 'production');
        currentFiltersRef.current = { ...values };
        expression(filterEffect(), { ...context, linkedWorkOrder: '' })();
        assert.deepEqual(values, expected);
    }
});

test('confirmacao revalida produtos e sucesso parcial nao reenviara produtos', async () => {
    const source = extract('app/(admin)/fiscal/emitir/page.tsx', 'handleEmitir');
    const state = { products: [{ valor_total: 220 }], services: [{ total_price: 80 }], error: null };
    let productCalls = 0, serviceCalls = 0;
    const scope = () => ({
        profile: { organization_id: 'org' }, selectedOS: { id: 1 }, environment: 'production',
        itens: state.products, itensServico: state.services, produtoDocumento: 'NFe',
        getNFCeVendaRapidaPendencias: () => [], getNFeVendaRapidaPendencias: () => [], getNFSePendencias: () => [],
        emissionLockRef: { current: false }, crypto: require('node:crypto'),
        setEmitting: () => {}, setEmissionError: (value) => { state.error = value; }, setEmissionErrorCopied: () => {},
        setItens: (value) => { state.products = value; }, setItensServico: (value) => { state.services = value; },
        clienteNome: 'Cliente', clienteDoc: '', clienteEmail: '', clienteTelefone: '', clienteEndereco: { logradouro: 'Rua' }, observacaoNfse: '',
        ACTIVE_FISCAL_STATUSES: fiscal.ACTIVE_FISCAL_STATUSES, isProductSaleInvoice: fiscal.isProductSaleInvoice,
        getFiscalInvoices: async () => [],
        emitirNFCe: async () => { productCalls++; return { success: true }; },
        emitirNFSe: async () => { serviceCalls++; return { success: false, error: 'simulated rejection' }; },
        router: { push: () => {} }, alert: () => {},
    });
    await expression(source, { ...scope(), getFiscalInvoices: async () => [note('active', 'NFCe', 'authorized')] })();
    assert.equal(productCalls, 0); assert.equal(serviceCalls, 0); assert.ok(state.error);
    await expression(source, scope())();
    assert.equal(productCalls, 1); assert.deepEqual(state.products, []); assert.equal(state.services.length, 1);
    await expression(source, scope())();
    assert.equal(productCalls, 1); assert.equal(serviceCalls, 2);
});

test('importacao manual explica categoria em andamento e mantem contexto para acompanhamento', async () => {
    const source = extract('app/(admin)/fiscal/emitir/page.tsx', 'loadWorkOrderForReview');
    const state = {};
    const setterNames = [...new Set([...source.matchAll(/\b(set[A-Z]\w*)\(/g)].map((match) => match[1]))];
    const db = database({ fiscal_invoices: [note('processing', 'NFCe', 'pending')], work_order_items: [item(1), item(1, 'servico')] });
    const scope = {
        ...Object.fromEntries(setterNames.map((name) => [name, (value) => { state[name] = value; }])),
        profile: { organization_id: 'org' }, environment: 'production', emitenteCnpj: '',
        ACTIVE_FISCAL_STATUSES: fiscal.ACTIVE_FISCAL_STATUSES, isProductSaleInvoice: fiscal.isProductSaleInvoice,
        require: () => ({ createClient: () => db }),
        getProductFiscalData: async () => null, getServiceFiscalData: async () => null,
    };
    const order = { id: 1, clients: { nome: 'Cliente' } };
    await expression(source, scope)(order);
    assert.deepEqual(state.setItens, []);
    assert.equal(state.setItensServico.length, 1);
    assert.match(state.setImportNotice, /Produtos/);
    assert.equal(state.setStep, 2);
    delete state.setStep;
    await assert.rejects(expression(source, scope)(order, 'NFCe'), /dispon/);
    assert.equal(state.setStep, undefined);
});

test('consulta antiga de outra OS nao sobrescreve o acompanhamento atual', async () => {
    const source = extract('app/(admin)/fiscal/page.tsx', 'fetchInvoices');
    const state = {};
    let resolveQuery, calls = 0;
    const invoiceScopeRef = { current: 'org:1343:production' };
    const scope = {
        profile: { organization_id: 'org' }, linkedWorkOrder: '1343', environment: 'production',
        invoiceRequestRef: { current: 0 }, invoiceScopeRef,
        setLoading: (value) => { state.loading = value; }, setLoadError: () => {},
        setInvoices: (value) => { state.invoices = value; },
        getFiscalInvoices: () => { calls++; return new Promise((resolve) => { resolveQuery = resolve; }); },
        backfillEntryInvoicesChave: () => { throw new Error('Nao deve alterar dados ao consultar uma OS'); },
    };
    const fetch = expression(source, scope);
    const pending = fetch();
    invoiceScopeRef.current = 'org:1344:production';
    resolveQuery([note('old', 'NFSe', 'authorized', 1343)]);
    await pending;
    assert.equal(state.invoices, undefined);
    await fetch();
    assert.equal(calls, 1);
});
