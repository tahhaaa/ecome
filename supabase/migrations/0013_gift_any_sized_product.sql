create or replace function public.place_shop_cart_order(
  p_customer_name text,
  p_phone text,
  p_city text,
  p_items jsonb,
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
  v_order_items jsonb := '[]'::jsonb;
  v_promotions jsonb;
  v_bundle jsonb;
  v_input jsonb;
  v_index integer;
  v_product_id text;
  v_size text;
  v_quantity integer;
  v_price numeric(10,2);
  v_purchase_price numeric(10,2);
  v_subtotal numeric(10,2) := 0;
  v_total numeric(10,2);
  v_stock integer;
  v_total_stock integer;
  v_buy_quantity integer := 2;
  v_free_quantity_per_offer integer := 1;
  v_buy_total integer := 0;
  v_gift_quantity integer := 0;
  v_buy_product_id text;
  v_buy_product_ids jsonb := '[]'::jsonb;
  v_gift_product_id text;
  v_gift_size text;
  v_gift_product_name text;
  v_product_names text := '';
  v_shipping_fee integer;
  v_has_tracked_stock boolean;
  v_size_inventory boolean;
  v_free_shipping boolean := false;
  v_bundle_enabled boolean := false;
  v_order_id uuid;
  v_created_at timestamptz;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 10 then
    raise exception 'CART_INVALID' using errcode = 'P0001';
  end if;
  if p_shipping_fee not in (25, 35) then
    raise exception 'SHIPPING_INVALID' using errcode = 'P0001';
  end if;

  select content into v_content from public.shop_store where id = 1 for update;
  if v_content is null then raise exception 'SHOP_NOT_READY' using errcode = 'P0001'; end if;
  v_products := coalesce(v_content->'products', '[]'::jsonb);
  v_promotions := coalesce(v_content->'promotions', '{}'::jsonb);
  v_free_shipping := coalesce((v_promotions->'freeShipping'->>'enabled')::boolean, false);
  v_bundle := coalesce(v_promotions->'buyXGetY', '{}'::jsonb);
  v_bundle_enabled := coalesce((v_bundle->>'enabled')::boolean, false);
  v_buy_product_ids := coalesce(v_bundle->'buyProductIds', '[]'::jsonb);
  if jsonb_typeof(v_buy_product_ids) <> 'array' then v_buy_product_ids := '[]'::jsonb; end if;
  if jsonb_array_length(v_buy_product_ids) = 0 then
    v_buy_product_id := nullif(v_bundle->>'buyProductId', '');
    if v_buy_product_id is not null then v_buy_product_ids := jsonb_build_array(v_buy_product_id); end if;
  end if;
  v_gift_product_id := nullif(v_bundle->>'freeProductId', '');
  if coalesce(v_bundle->>'buyQuantity', '') ~ '^\d{1,2}$' then
    v_buy_quantity := greatest(1, least(10, (v_bundle->>'buyQuantity')::integer));
  end if;
  if coalesce(v_bundle->>'freeQuantity', '') ~ '^\d{1,2}$' then
    v_free_quantity_per_offer := greatest(1, least(5, (v_bundle->>'freeQuantity')::integer));
  end if;
  if v_bundle_enabled then
    if jsonb_array_length(v_buy_product_ids) = 0 or v_gift_product_id is null or v_buy_product_ids ? v_gift_product_id then
      raise exception 'PROMOTION_CONFIGURATION_INVALID' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(v_buy_product_ids) as chosen(product_id)
      where not exists (select 1 from jsonb_array_elements(v_products) as product(item) where item->>'id' = chosen.product_id)
    ) then raise exception 'PROMOTION_CONFIGURATION_INVALID' using errcode = 'P0001'; end if;
    for v_input in select value from jsonb_array_elements(p_items) loop
      if exists (select 1 from jsonb_array_elements_text(v_buy_product_ids) as eligible(product_id) where eligible.product_id = v_input->>'productId') then
        if coalesce(v_input->>'quantity', '') !~ '^\d{1,2}$' then raise exception 'QUANTITY_INVALID' using errcode = 'P0001'; end if;
        v_buy_total := v_buy_total + (v_input->>'quantity')::integer;
      end if;
    end loop;
    if v_buy_total >= v_buy_quantity then
      v_gift_quantity := (v_buy_total / v_buy_quantity) * v_free_quantity_per_offer;
    end if;
  end if;
  v_shipping_fee := case when v_free_shipping then 0 else p_shipping_fee end;

  for v_input in select value from jsonb_array_elements(p_items) loop
    v_product_id := left(coalesce(v_input->>'productId', ''), 100);
    if coalesce(v_input->>'quantity', '') !~ '^\d{1,2}$' then raise exception 'QUANTITY_INVALID' using errcode = 'P0001'; end if;
    v_quantity := (v_input->>'quantity')::integer;
    if v_product_id = '' or v_quantity < 1 or v_quantity > 10 then raise exception 'QUANTITY_INVALID' using errcode = 'P0001'; end if;
    v_size := nullif(trim(coalesce(v_input->>'size', '')), '');

    select item, (ordinality - 1)::integer into v_product, v_index
      from jsonb_array_elements(v_products) with ordinality as products(item, ordinality)
     where item->>'id' = v_product_id;
    if v_product is null then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001'; end if;

    if coalesce((v_product->>'oneSize')::boolean, false) then
      v_size := null;
    elsif jsonb_typeof(v_product->'sizes') = 'array' and jsonb_array_length(v_product->'sizes') > 0 then
      if v_size is null or not exists (
        select 1 from jsonb_array_elements_text(v_product->'sizes') as available(size) where available.size = v_size
      ) then raise exception 'SIZE_NOT_AVAILABLE' using errcode = 'P0001'; end if;
    elsif v_size is null or v_size !~ '^(35-36|37-38|39-40|41-42|43-44|45-46)$' then
      raise exception 'SIZE_NOT_AVAILABLE' using errcode = 'P0001';
    end if;

    v_inventory := v_product->'inventoryBySize';
    v_size_inventory := v_size is not null and jsonb_typeof(v_inventory) = 'object' and jsonb_object_length(v_inventory) > 0;
    v_has_tracked_stock := false;
    if v_size_inventory then
      v_has_tracked_stock := true;
      if not (v_inventory ? v_size) then raise exception 'SIZE_OUT_OF_STOCK' using errcode = 'P0001'; end if;
      v_stock := coalesce((v_inventory->>v_size)::integer, 0);
      if v_stock < v_quantity then raise exception 'SIZE_OUT_OF_STOCK' using errcode = 'P0001'; end if;
      v_inventory := jsonb_set(v_inventory, array[v_size], to_jsonb(v_stock - v_quantity), true);
      select coalesce(sum(value::integer), 0)::integer into v_total_stock from jsonb_each_text(v_inventory);
      v_updated_product := jsonb_set(v_product, '{inventoryBySize}', v_inventory, true);
      v_updated_product := jsonb_set(v_updated_product, '{stock}', to_jsonb(v_total_stock), true);
    elsif v_product ? 'stock' and nullif(v_product->>'stock', '') is not null then
      v_has_tracked_stock := true;
      v_stock := coalesce((v_product->>'stock')::integer, 0);
      if v_stock < v_quantity then raise exception 'OUT_OF_STOCK' using errcode = 'P0001'; end if;
      v_updated_product := jsonb_set(v_product, '{stock}', to_jsonb(v_stock - v_quantity), true);
    else
      v_updated_product := v_product;
    end if;

    if v_has_tracked_stock then
      v_products := jsonb_set(v_products, array[v_index::text], v_updated_product, false);
    end if;
    v_price := coalesce(nullif(v_product->>'price', '')::numeric, 0);
    v_purchase_price := nullif(v_product->>'purchasePrice', '')::numeric;
    v_subtotal := v_subtotal + round(v_price * v_quantity, 2);
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'id', v_product_id, 'name', v_product->>'name', 'image', coalesce(v_product->>'image', ''),
      'unit_price', v_price, 'purchase_price', v_purchase_price, 'quantity', v_quantity,
      'paid_quantity', v_quantity, 'free_quantity', 0, 'size', v_size, 'stock_reserved', v_has_tracked_stock
    ));
    if v_product_names <> '' then v_product_names := v_product_names || ', '; end if;
    v_product_names := v_product_names || coalesce(v_product->>'name', 'Produit');
  end loop;

  if v_gift_quantity > 0 then
    select item, (ordinality - 1)::integer into v_product, v_index
      from jsonb_array_elements(v_products) with ordinality as products(item, ordinality)
     where item->>'id' = v_gift_product_id;
    if v_product is null then raise exception 'PROMOTION_GIFT_INVALID' using errcode = 'P0001'; end if;
    v_gift_size := nullif(trim(coalesce(v_bundle->>'freeProductSize', '')), '');
    if coalesce((v_product->>'oneSize')::boolean, false) then
      if not (v_product ? 'stock') or nullif(v_product->>'stock', '') is null then
        raise exception 'PROMOTION_GIFT_INVALID' using errcode = 'P0001';
      end if;
      v_stock := coalesce((v_product->>'stock')::integer, 0);
      if v_stock < v_gift_quantity then raise exception 'PROMOTION_GIFT_OUT_OF_STOCK' using errcode = 'P0001'; end if;
      v_updated_product := jsonb_set(v_product, '{stock}', to_jsonb(v_stock - v_gift_quantity), true);
    else
      if v_gift_size is null or not exists (
        select 1 from jsonb_array_elements_text(coalesce(v_product->'sizes', '[]'::jsonb)) as available(size)
        where available.size = v_gift_size
      ) then raise exception 'PROMOTION_GIFT_INVALID' using errcode = 'P0001'; end if;
      v_inventory := v_product->'inventoryBySize';
      if jsonb_typeof(v_inventory) <> 'object' or not (v_inventory ? v_gift_size) then
        raise exception 'PROMOTION_GIFT_INVALID' using errcode = 'P0001';
      end if;
      v_stock := coalesce((v_inventory->>v_gift_size)::integer, 0);
      if v_stock < v_gift_quantity then raise exception 'PROMOTION_GIFT_OUT_OF_STOCK' using errcode = 'P0001'; end if;
      v_inventory := jsonb_set(v_inventory, array[v_gift_size], to_jsonb(v_stock - v_gift_quantity), true);
      select coalesce(sum(value::integer), 0)::integer into v_total_stock from jsonb_each_text(v_inventory);
      v_updated_product := jsonb_set(v_product, '{inventoryBySize}', v_inventory, true);
      v_updated_product := jsonb_set(v_updated_product, '{stock}', to_jsonb(v_total_stock), true);
    end if;
    v_products := jsonb_set(v_products, array[v_index::text], v_updated_product, false);
    v_gift_product_name := coalesce(v_product->>'name', 'Cadeau Crooza');
    v_purchase_price := nullif(v_product->>'purchasePrice', '')::numeric;
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'id', v_gift_product_id, 'name', v_gift_product_name, 'image', coalesce(v_product->>'image', ''),
      'unit_price', 0, 'purchase_price', v_purchase_price, 'quantity', v_gift_quantity,
      'paid_quantity', 0, 'free_quantity', v_gift_quantity, 'size', v_gift_size, 'stock_reserved', true
    ));
  end if;

  update public.shop_store set content = jsonb_set(v_content, '{products}', v_products, true), updated_at = now() where id = 1;
  v_total := v_subtotal + v_shipping_fee;
  insert into public.shop_orders (
    customer_name, phone, city, items, subtotal, shipping_fee, total, status,
    tracking_token_hash, delivery_expenses
  ) values (
    trim(p_customer_name), p_phone, trim(p_city), v_order_items, v_subtotal, v_shipping_fee, v_total, 'new',
    p_tracking_token_hash, '[]'::jsonb
  ) returning id, created_at into v_order_id, v_created_at;

  return jsonb_build_object(
    'id', v_order_id, 'created_at', v_created_at, 'total', v_total, 'subtotal', v_subtotal,
    'shipping_fee', v_shipping_fee, 'free_quantity', v_gift_quantity,
    'free_product_name', v_gift_product_name, 'free_product_size', v_gift_size, 'product_name', v_product_names,
    'items', v_order_items
  );
end;
$$;

create or replace function public.place_shop_cart_order_with_tracking(
  p_customer_name text,
  p_phone text,
  p_city text,
  p_items jsonb,
  p_shipping_fee integer,
  p_tracking_token_hash text,
  p_tracking_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order jsonb;
begin
  if p_tracking_token is null or length(p_tracking_token) < 32 then
    raise exception 'TRACKING_TOKEN_INVALID' using errcode = 'P0001';
  end if;
  v_order := public.place_shop_cart_order(p_customer_name, p_phone, p_city, p_items, p_shipping_fee, p_tracking_token_hash);
  update public.shop_orders set tracking_token = p_tracking_token where id = (v_order->>'id')::uuid and deleted_at is null;
  if not found then raise exception 'ORDER_NOT_SAVED' using errcode = 'P0001'; end if;
  return v_order;
end;
$$;

revoke all on function public.place_shop_cart_order(text, text, text, jsonb, integer, text) from public, anon, authenticated;
revoke all on function public.place_shop_cart_order_with_tracking(text, text, text, jsonb, integer, text, text) from public, anon, authenticated;
grant execute on function public.place_shop_cart_order(text, text, text, jsonb, integer, text) to service_role;
grant execute on function public.place_shop_cart_order_with_tracking(text, text, text, jsonb, integer, text, text) to service_role;
