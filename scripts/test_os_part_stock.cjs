// Isolated PostgreSQL regression tests. No application credentials or remote DB.
// npm install --prefix .tmp/os-stock-validation --no-audit --no-fund @electric-sql/pglite@0.5.11
// node scripts/test_os_part_stock.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(path.resolve(__dirname, '../.tmp/os-stock-validation/node_modules/@electric-sql/pglite'));

const org = '10000000-0000-0000-0000-000000000001';
const otherOrg = '10000000-0000-0000-0000-000000000002';
const actor = '20000000-0000-0000-0000-000000000001';
const product = '30000000-0000-0000-0000-000000000001';
const otherProduct = '30000000-0000-0000-0000-000000000002';
const db = new PGlite();

async function scalar(sql, args = []) {
  return Object.values((await db.query(sql, args)).rows[0])[0];
}
async function add(quantity = 1, price = 20, order = 1, part = product) {
  return scalar('select public.add_work_order_part_with_stock($1, $2, $3, $4)', [order, part, quantity, price]);
}
async function snapshot(id) {
  return scalar(`select jsonb_build_object('quantity', quantity, 'unit_price', unit_price,
    'product_id', product_id, 'tipo', tipo, 'peca_cliente', coalesce(peca_cliente, false))
    from work_order_items where id = $1`, [id]);
}
async function edit(id, quantity, price, expected, order = 1) {
  await db.query('select public.update_work_order_item_with_stock($1, $2, $3, $4, $5)',
    [order, id, quantity, price, JSON.stringify(expected)]);
}
async function reset() {
  await db.exec(`reset role;
    set test.reject_stock = 'off'; set test.reject_total = 'off';
    truncate work_order_items, products, work_orders, profiles;
    insert into profiles values ('${actor}', '${org}', true);
    insert into work_orders values (1, '${org}', 'orcamento', 0), (2, '${otherOrg}', 'orcamento', 0);
    insert into products values ('${product}', '${org}', 'Filtro', 'Teste', 10),
      ('${otherProduct}', '${otherOrg}', 'Outra oficina', null, 20);
    select set_config('request.jwt.claim.sub', '${actor}', false);
    set role authenticated;`);
}
let passed = 0;
async function test(name, run) {
  await reset();
  await run();
  passed++;
  process.stdout.write(`OK ${name}\n`);
}

async function main() {
  await db.exec(`
    create role authenticated; create role anon; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    create table profiles (id uuid primary key, organization_id uuid, ativo boolean);
    create table work_orders (id bigint primary key, organization_id uuid, status text, total numeric);
    create table products (id uuid primary key, organization_id uuid, nome text, marca text, estoque_atual numeric);
    create table work_order_items (
      id uuid primary key default gen_random_uuid(), organization_id uuid, work_order_id bigint references work_orders,
      product_id uuid references products, tipo text, name text, marca text, catalog_status text,
      quantity numeric, unit_price numeric, total_price numeric, peca_cliente boolean
    );
    create function public.test_org() returns uuid language sql stable security definer
      set search_path = pg_catalog, public as $$ select organization_id from profiles where id = auth.uid() $$;
    alter table profiles enable row level security;
    create policy self on profiles for select to authenticated using (id = auth.uid());
    grant select on profiles to authenticated;
    grant select, insert, update on work_orders, products, work_order_items to authenticated;
    create function public.fail_stock_test() returns trigger language plpgsql as $$ begin
      if current_setting('test.reject_stock', true) = 'on' then raise exception 'STOCK_TEST_FAILURE'; end if;
      return new;
    end $$;
    create trigger fail_stock before update on products for each row execute function public.fail_stock_test();
    create function public.fail_total_test() returns trigger language plpgsql as $$ begin
      if current_setting('test.reject_total', true) = 'on' then raise exception 'TOTAL_TEST_FAILURE'; end if;
      return new;
    end $$;
    create trigger fail_total before update on work_orders for each row execute function public.fail_total_test();
  `);
  for (const table of ['work_orders', 'products', 'work_order_items']) {
    await db.exec(`alter table ${table} enable row level security;
      create policy tenant on ${table} to authenticated
        using (organization_id = public.test_org()) with check (organization_id = public.test_org());`);
  }
  const migration = fs.readFileSync(path.resolve(__dirname, '../migration_os_part_stock.sql'), 'utf8');
  await db.exec(migration);

  await test('part inclusion debits exactly once and updates OS total', async () => {
    const id = await add();
    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.equal(Number(await scalar('select estoque_atual from products where id = $1', [product])), 9);
    assert.equal(Number(await scalar('select total from work_orders where id = 1')), 20);
    await add(2, 15);
    assert.equal(Number(await scalar('select estoque_atual from products where id = $1', [product])), 7);
    assert.equal(Number(await scalar('select total from work_orders where id = 1')), 50);
  });
  await test('new product with zero balance follows existing negative-stock policy', async () => {
    await db.query('update products set estoque_atual = 0 where id = $1', [product]);
    await add();
    assert.equal(Number(await scalar('select estoque_atual from products where id = $1', [product])), -1);
  });
  await test('fractional quantity preserves numeric precision', async () => {
    await add('1.25', '2.40');
    assert.equal(Number(await scalar('select estoque_atual from products where id = $1', [product])), 8.75);
    assert.equal(Number(await scalar('select total from work_orders where id = 1')), 3);
  });
  await test('another organization cannot supply the OS or product', async () => {
    await assert.rejects(add(1, 20, 2), /OS nao encontrada/);
    await assert.rejects(add(1, 20, 1, otherProduct), /Produto nao encontrado/);
    assert.equal(Number(await scalar('select count(*) from work_order_items')), 0);
  });
  await test('closed or unrecognized OS statuses reject inclusion', async () => {
    for (const status of ['entregue', 'cancelado', 'arquivado', 'desconhecido']) {
      await db.query('update work_orders set status = $1 where id = 1', [status]);
      await assert.rejects(add(), /nao permite alterar itens/);
    }
    assert.equal(Number(await scalar('select count(*) from work_order_items')), 0);
  });
  await test('invalid quantities and prices produce no writes', async () => {
    for (const qty of [null, 0, -1, 'NaN', 'Infinity', '-Infinity']) {
      await assert.rejects(add(qty), /Quantidade ou preco invalido/);
    }
    for (const price of [null, -1, 'NaN', 'Infinity', '-Infinity']) {
      await assert.rejects(add(1, price), /Quantidade ou preco invalido/);
    }
    assert.equal(Number(await scalar('select count(*) from work_order_items')), 0);
  });
  await test('inactive profile or absent user cannot mutate stock', async () => {
    await db.exec('reset role; update profiles set ativo = false; set role authenticated;');
    await assert.rejects(add(), /Sessao invalida/);
    await db.exec("select set_config('request.jwt.claim.sub', '', false);");
    await assert.rejects(add(), /Sessao invalida/);
  });
  await test('stock failure leaves no item or total behind', async () => {
    await db.exec("set test.reject_stock = 'on';");
    await assert.rejects(add(), /STOCK_TEST_FAILURE/);
    assert.equal(Number(await scalar('select count(*) from work_order_items')), 0);
    assert.equal(Number(await scalar('select total from work_orders where id = 1')), 0);
  });
  await test('total failure rolls back stock and item together', async () => {
    await db.exec("set test.reject_total = 'on';");
    await assert.rejects(add(), /TOTAL_TEST_FAILURE/);
    assert.equal(Number(await scalar('select estoque_atual from products where id = $1', [product])), 10);
    assert.equal(Number(await scalar('select count(*) from work_order_items')), 0);
  });
  await test('editing 1 to 2 debits only the extra unit; repeated save cannot debit twice', async () => {
    const id = await add();
    const expected = await snapshot(id);
    await edit(id, 2, 20, expected);
    assert.equal(Number(await scalar('select estoque_atual from products where id = $1', [product])), 8);
    assert.equal(Number(await scalar('select quantity from work_order_items where id = $1', [id])), 2);
    assert.equal(Number(await scalar('select total from work_orders where id = 1')), 40);
    await assert.rejects(edit(id, 2, 20, expected), /mudou em outra operacao/);
    assert.equal(Number(await scalar('select estoque_atual from products where id = $1', [product])), 8);
  });
  await test('quantity reduction and fractional edits apply only their difference', async () => {
    const id = await add(3, 10);
    await edit(id, 1, 10, await snapshot(id));
    assert.equal(Number(await scalar('select estoque_atual from products where id = $1', [product])), 9);
    await edit(id, '1.25', 10, await snapshot(id));
    assert.equal(Number(await scalar('select estoque_atual from products where id = $1', [product])), 8.75);
    assert.equal(Number(await scalar('select total from work_orders where id = 1')), 12.5);
  });
  await test('price-only edit performs no stock update', async () => {
    const id = await add();
    await db.exec("set test.reject_stock = 'on';");
    await edit(id, 1, 30, await snapshot(id));
    assert.equal(Number(await scalar('select total from work_orders where id = 1')), 30);
    assert.equal(Number(await scalar('select estoque_atual from products where id = $1', [product])), 9);
  });
  await test('services and customer-supplied parts never change store stock on edit', async () => {
    const id = await add();
    await db.query('update work_order_items set peca_cliente = true where id = $1', [id]);
    await db.exec("set test.reject_stock = 'on';");
    await edit(id, 2, 20, await snapshot(id));
    assert.equal(Number(await scalar('select total from work_orders where id = 1')), 0);
    await db.query("update work_order_items set tipo = 'servico', peca_cliente = false, product_id = null where id = $1", [id]);
    await edit(id, 3, 20, await snapshot(id));
    assert.equal(Number(await scalar('select total from work_orders where id = 1')), 60);
    assert.equal(Number(await scalar('select estoque_atual from products where id = $1', [product])), 9);
  });
  await test('edit failure rolls back quantity, price, stock and total', async () => {
    const id = await add();
    const expected = await snapshot(id);
    await db.exec("set test.reject_total = 'on';");
    await assert.rejects(edit(id, 2, 30, expected), /TOTAL_TEST_FAILURE/);
    assert.deepEqual(await snapshot(id), expected);
    assert.equal(Number(await scalar('select estoque_atual from products where id = $1', [product])), 9);
    assert.equal(Number(await scalar('select total from work_orders where id = 1')), 20);
    await db.exec("set test.reject_total = 'off'; set test.reject_stock = 'on';");
    await assert.rejects(edit(id, 2, 30, expected), /STOCK_TEST_FAILURE/);
    assert.deepEqual(await snapshot(id), expected);
  });
  await test('edit validates input and rejects changed identity or ownership', async () => {
    const id = await add();
    const expected = await snapshot(id);
    for (const quantity of [null, 0, -1, 'NaN', 'Infinity']) {
      await assert.rejects(edit(id, quantity, 20, expected), /Quantidade ou preco invalido/);
    }
    await assert.rejects(edit(id, 2, 20, expected, 2), /OS nao encontrada/);
    await db.query('update work_order_items set peca_cliente = true where id = $1', [id]);
    await assert.rejects(edit(id, 2, 20, expected), /mudou em outra operacao/);
    await db.exec('reset role;');
    await db.query('update work_order_items set product_id = $1 where id = $2', [otherProduct, id]);
    await db.exec('set role authenticated;');
    await assert.rejects(edit(id, 2, 20, await snapshot(id)), /Produto nao encontrado/);
  });
  await db.exec('reset role;');
  for (const role of ['anon', 'service_role']) {
    for (const signature of ['public.add_work_order_part_with_stock(bigint,uuid,numeric,numeric)',
      'public.update_work_order_item_with_stock(bigint,uuid,numeric,numeric,jsonb)']) {
      assert.equal(await scalar('select has_function_privilege($1, $2, $3)', [role, signature, 'EXECUTE']), false);
    }
  }
  process.stdout.write(`PASS ${passed} scenarios; anon/service_role execution denied.\n`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
