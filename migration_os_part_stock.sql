-- Apply before publishing the OS page that calls these functions.
-- Prospective fix only: does not reconcile existing balances or enable archiving.
begin;
set local lock_timeout = '5s';

create or replace function public.add_work_order_part_with_stock(
  p_work_order_id bigint,
  p_product_id uuid,
  p_quantity numeric,
  p_unit_price numeric
) returns uuid
language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org uuid;
  v_order public.work_orders;
  v_product public.products;
  v_item_id uuid;
begin
  select organization_id into v_org from public.profiles
  where id = auth.uid() and ativo is true;
  if v_org is null then
    raise exception 'Sessao invalida ou perfil inativo' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity::text in ('NaN', 'Infinity', '-Infinity')
    or p_unit_price is null or p_unit_price < 0 or p_unit_price::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Quantidade ou preco invalido' using errcode = '22023';
  end if;

  select * into v_order from public.work_orders
  where id = p_work_order_id and organization_id = v_org for update;
  if not found then
    raise exception 'OS nao encontrada nesta oficina' using errcode = '42501';
  end if;
  if v_order.status is null or v_order.status not in ('orcamento', 'aprovado', 'aguardando_peca', 'em_servico', 'pronto') then
    raise exception 'Esta OS nao permite alterar itens' using errcode = '22023';
  end if;

  select * into v_product from public.products
  where id = p_product_id and organization_id = v_org for update;
  if not found then
    raise exception 'Produto nao encontrado nesta oficina' using errcode = '42501';
  end if;
  if coalesce(v_product.estoque_atual, 0)::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Saldo de estoque invalido' using errcode = '22023';
  end if;

  -- Preserve the existing policy allowing negative stock. No absolute balance
  -- supplied by the browser, and any failure rolls back the item and OS total.
  update public.products set estoque_atual = coalesce(estoque_atual, 0) - p_quantity
  where id = p_product_id and organization_id = v_org;
  if not found then
    raise exception 'Nao foi possivel atualizar o estoque' using errcode = '42501';
  end if;

  insert into public.work_order_items (
    organization_id, work_order_id, product_id, tipo, name, marca,
    catalog_status, quantity, unit_price, total_price, peca_cliente
  ) values (
    v_org, p_work_order_id, p_product_id, 'peca', v_product.nome, v_product.marca,
    'resolved', p_quantity, p_unit_price, p_quantity * p_unit_price, false
  ) returning id into v_item_id;

  update public.work_orders set total = (
    select coalesce(sum(total_price), 0) from public.work_order_items
    where work_order_id = p_work_order_id and organization_id = v_org
      and not coalesce(peca_cliente, false)
  ) where id = p_work_order_id and organization_id = v_org;
  if not found then
    raise exception 'Nao foi possivel atualizar o total da OS' using errcode = '42501';
  end if;
  return v_item_id;
end;
$$;

revoke all on function public.add_work_order_part_with_stock(bigint, uuid, numeric, numeric)
  from public, anon, service_role;
grant execute on function public.add_work_order_part_with_stock(bigint, uuid, numeric, numeric)
  to authenticated;

create or replace function public.update_work_order_item_with_stock(
  p_work_order_id bigint,
  p_item_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_expected_item jsonb
) returns void
language plpgsql security invoker
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_org uuid;
  v_order public.work_orders;
  v_item public.work_order_items;
  v_delta numeric;
  v_stock numeric;
begin
  select organization_id into v_org from public.profiles
  where id = auth.uid() and ativo is true;
  if v_org is null then
    raise exception 'Sessao invalida ou perfil inativo' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity::text in ('NaN', 'Infinity', '-Infinity')
    or p_unit_price is null or p_unit_price < 0 or p_unit_price::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Quantidade ou preco invalido' using errcode = '22023';
  end if;

  select * into v_order from public.work_orders
  where id = p_work_order_id and organization_id = v_org for update;
  if not found then
    raise exception 'OS nao encontrada nesta oficina' using errcode = '42501';
  end if;
  if v_order.status is null or v_order.status not in ('orcamento', 'aprovado', 'aguardando_peca', 'em_servico', 'pronto') then
    raise exception 'Esta OS nao permite alterar itens' using errcode = '22023';
  end if;

  select * into v_item from public.work_order_items
  where id = p_item_id and work_order_id = p_work_order_id and organization_id = v_org for update;
  if not found then
    raise exception 'Item nao encontrado nesta OS' using errcode = '42501';
  end if;
  if p_expected_item is distinct from jsonb_build_object(
    'quantity', v_item.quantity, 'unit_price', v_item.unit_price,
    'product_id', v_item.product_id, 'tipo', v_item.tipo,
    'peca_cliente', coalesce(v_item.peca_cliente, false)
  ) then
    raise exception 'O item mudou em outra operacao. Feche o editor, atualize a OS e tente novamente.'
      using errcode = '40001';
  end if;
  if v_item.quantity is null or v_item.quantity <= 0 or v_item.quantity::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Quantidade anterior invalida; confira o item antes de editar' using errcode = '22023';
  end if;

  v_delta := p_quantity - v_item.quantity;
  if v_item.tipo = 'peca' and v_item.product_id is not null then
    select estoque_atual into v_stock from public.products
    where id = v_item.product_id and organization_id = v_org for update;
    if not found then
      raise exception 'Produto nao encontrado nesta oficina' using errcode = '42501';
    end if;
    if not coalesce(v_item.peca_cliente, false) and v_delta <> 0 then
      if coalesce(v_stock, 0)::text in ('NaN', 'Infinity', '-Infinity') then
        raise exception 'Saldo de estoque invalido' using errcode = '22023';
      end if;
      update public.products set estoque_atual = coalesce(estoque_atual, 0) - v_delta
      where id = v_item.product_id and organization_id = v_org;
      if not found then
        raise exception 'Nao foi possivel atualizar o estoque' using errcode = '42501';
      end if;
    end if;
  end if;

  update public.work_order_items set quantity = p_quantity, unit_price = p_unit_price,
    total_price = p_quantity * p_unit_price
  where id = p_item_id and work_order_id = p_work_order_id and organization_id = v_org;
  if not found then
    raise exception 'Nao foi possivel atualizar o item' using errcode = '42501';
  end if;
  update public.work_orders set total = (
    select coalesce(sum(total_price), 0) from public.work_order_items
    where work_order_id = p_work_order_id and organization_id = v_org
      and not coalesce(peca_cliente, false)
  ) where id = p_work_order_id and organization_id = v_org;
  if not found then
    raise exception 'Nao foi possivel atualizar o total da OS' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.update_work_order_item_with_stock(bigint, uuid, numeric, numeric, jsonb)
  from public, anon, service_role;
grant execute on function public.update_work_order_item_with_stock(bigint, uuid, numeric, numeric, jsonb)
  to authenticated;

commit;
