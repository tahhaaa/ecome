alter table public.shop_orders
  add column if not exists deleted_at timestamptz,
  add column if not exists delivery_expenses jsonb not null default '[]'::jsonb;

create index if not exists shop_orders_active_created_idx
  on public.shop_orders (created_at desc) where deleted_at is null;

create or replace function public.place_shop_order(
  p_customer_name text,
  p_phone text,
  p_city text,
  p_product_id text,
  p_quantity integer,
  p_size text,
  p_shipping_fee integer,
  p_tracking_token_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content jsonb;
  v_products jsonb;
  v_product jsonb;
  v_updated_product jsonb;
  v_inventory jsonb;
  v_index integer;
  v_price numeric(10,2);
  v_purchase_price numeric(10,2);
  v_subtotal numeric(10,2);
  v_total numeric(10,2);
  v_stock integer;
  v_total_stock integer;
  v_quantity integer;
  v_has_tracked_stock boolean := false;
  v_size_inventory boolean := false;
  v_order_id uuid;
  v_created_at timestamptz;
  v_size text := nullif(trim(coalesce(p_size, '')), '');
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'QUANTITY_INVALID' using errcode = 'P0001';
  end if;
  if p_shipping_fee not in (25, 35) then
    raise exception 'SHIPPING_INVALID' using errcode = 'P0001';
  end if;

  select content into v_content from public.shop_store where id = 1 for update;
  if v_content is null then raise exception 'SHOP_NOT_READY' using errcode = 'P0001'; end if;
  v_products := coalesce(v_content->'products', '[]'::jsonb);

  select item, (ordinality - 1)::integer
    into v_product, v_index
    from jsonb_array_elements(v_products) with ordinality as products(item, ordinality)
   where item->>'id' = p_product_id;
  if v_product is null then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001'; end if;

  if jsonb_typeof(v_product->'sizes') = 'array' and jsonb_array_length(v_product->'sizes') > 0 then
    if v_size is null or not exists (
      select 1 from jsonb_array_elements_text(v_product->'sizes') as available(size) where available.size = v_size
    ) then raise exception 'SIZE_NOT_AVAILABLE' using errcode = 'P0001'; end if;
  elsif v_size is not null then
    raise exception 'PRODUCT_ONE_SIZE' using errcode = 'P0001';
  end if;

  v_inventory := v_product->'inventoryBySize';
  if v_size is not null and jsonb_typeof(v_inventory) = 'object' then
    v_size_inventory := jsonb_object_length(v_inventory) > 0;
  end if;
  if v_size_inventory then
    v_has_tracked_stock := true;
    if not (v_inventory ? v_size) then raise exception 'SIZE_OUT_OF_STOCK' using errcode = 'P0001'; end if;
    v_stock := coalesce((v_inventory->>v_size)::integer, 0);
    if v_stock < p_quantity then raise exception 'SIZE_OUT_OF_STOCK' using errcode = 'P0001'; end if;
    v_inventory := jsonb_set(v_inventory, array[v_size], to_jsonb(v_stock - p_quantity), true);
    select coalesce(sum(value::integer), 0)::integer into v_total_stock from jsonb_each_text(v_inventory);
    v_updated_product := jsonb_set(v_product, '{inventoryBySize}', v_inventory, true);
    v_updated_product := jsonb_set(v_updated_product, '{stock}', to_jsonb(v_total_stock), true);
  elsif v_product ? 'stock' and nullif(v_product->>'stock', '') is not null then
    v_has_tracked_stock := true;
    v_stock := coalesce((v_product->>'stock')::integer, 0);
    if v_stock < p_quantity then raise exception 'OUT_OF_STOCK' using errcode = 'P0001'; end if;
    v_updated_product := jsonb_set(v_product, '{stock}', to_jsonb(v_stock - p_quantity), true);
  else
    v_updated_product := v_product;
  end if;

  if v_has_tracked_stock then
    v_products := jsonb_set(v_products, array[v_index::text], v_updated_product, false);
    v_content := jsonb_set(v_content, '{products}', v_products, true);
    update public.shop_store set content = v_content, updated_at = now() where id = 1;
  end if;

  v_price := coalesce(nullif(v_product->>'price', '')::numeric, 0);
  v_purchase_price := nullif(v_product->>'purchasePrice', '')::numeric;
  v_subtotal := round(v_price * p_quantity, 2);
  v_total := v_subtotal + p_shipping_fee;

  insert into public.shop_orders (
    customer_name, phone, city, items, subtotal, shipping_fee, total, status,
    tracking_token_hash, delivery_expenses
  ) values (
    trim(p_customer_name), p_phone, trim(p_city),
    jsonb_build_array(jsonb_build_object(
      'id', p_product_id, 'name', v_product->>'name', 'image', coalesce(v_product->>'image', ''),
      'unit_price', v_price, 'purchase_price', v_purchase_price, 'quantity', p_quantity, 'size', v_size,
      'stock_reserved', v_has_tracked_stock
    )),
    v_subtotal, p_shipping_fee, v_total, 'new', p_tracking_token_hash, '[]'::jsonb
  ) returning id, created_at into v_order_id, v_created_at;

  return jsonb_build_object(
    'id', v_order_id, 'created_at', v_created_at, 'total', v_total,
    'product_name', v_product->>'name', 'stock_updated', v_has_tracked_stock
  );
end;
$$;

create or replace function public.soft_delete_shop_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.shop_orders%rowtype;
  v_content jsonb;
  v_products jsonb;
  v_product jsonb;
  v_updated_product jsonb;
  v_inventory jsonb;
  v_item jsonb;
  v_index integer;
  v_size text;
  v_quantity integer;
  v_stock integer;
  v_total_stock integer;
begin
  select * into v_order from public.shop_orders where id = p_order_id and deleted_at is null for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001'; end if;

  select content into v_content from public.shop_store where id = 1 for update;
  v_products := coalesce(v_content->'products', '[]'::jsonb);

  for v_item in select value from jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb)) loop
    if coalesce((v_item->>'stock_reserved')::boolean, false) = false then continue; end if;
    select item, (ordinality - 1)::integer
      into v_product, v_index
      from jsonb_array_elements(v_products) with ordinality as products(item, ordinality)
     where item->>'id' = v_item->>'id';
    if v_product is null then continue; end if;
    v_quantity := greatest(coalesce((v_item->>'quantity')::integer, 1), 1);
    v_size := nullif(v_item->>'size', '');
    v_inventory := v_product->'inventoryBySize';

    if v_size is not null and jsonb_typeof(v_inventory) = 'object' and v_inventory ? v_size then
      v_stock := coalesce((v_inventory->>v_size)::integer, 0) + v_quantity;
      v_inventory := jsonb_set(v_inventory, array[v_size], to_jsonb(v_stock), true);
      select coalesce(sum(value::integer), 0)::integer into v_total_stock from jsonb_each_text(v_inventory);
      v_updated_product := jsonb_set(v_product, '{inventoryBySize}', v_inventory, true);
      v_updated_product := jsonb_set(v_updated_product, '{stock}', to_jsonb(v_total_stock), true);
    elsif v_product ? 'stock' and nullif(v_product->>'stock', '') is not null then
      v_stock := coalesce((v_product->>'stock')::integer, 0) + v_quantity;
      v_updated_product := jsonb_set(v_product, '{stock}', to_jsonb(v_stock), true);
    else
      continue;
    end if;

    v_products := jsonb_set(v_products, array[v_index::text], v_updated_product, false);
  end loop;

  if v_content is not null then
    v_content := jsonb_set(v_content, '{products}', v_products, true);
    update public.shop_store set content = v_content, updated_at = now() where id = 1;
  end if;
  update public.shop_orders set deleted_at = now() where id = p_order_id;
  return jsonb_build_object('id', p_order_id, 'deleted', true);
end;
$$;

revoke all on function public.place_shop_order(text, text, text, text, integer, text, integer, text) from public, anon, authenticated;
revoke all on function public.soft_delete_shop_order(uuid) from public, anon, authenticated;
grant execute on function public.place_shop_order(text, text, text, text, integer, text, integer, text) to service_role;
grant execute on function public.soft_delete_shop_order(uuid) to service_role;
