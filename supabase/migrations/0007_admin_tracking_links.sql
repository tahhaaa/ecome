alter table public.shop_orders
  add column if not exists tracking_token text;

create or replace function public.place_shop_order_with_tracking(
  p_customer_name text,
  p_phone text,
  p_city text,
  p_product_id text,
  p_quantity integer,
  p_size text,
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

  v_order := public.place_shop_order(
    p_customer_name,
    p_phone,
    p_city,
    p_product_id,
    p_quantity,
    p_size,
    p_shipping_fee,
    p_tracking_token_hash
  );

  update public.shop_orders
     set tracking_token = p_tracking_token
   where id = (v_order->>'id')::uuid and deleted_at is null;

  if not found then raise exception 'ORDER_NOT_SAVED' using errcode = 'P0001'; end if;
  return v_order;
end;
$$;

revoke all on function public.place_shop_order_with_tracking(text, text, text, text, integer, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.place_shop_order_with_tracking(text, text, text, text, integer, text, integer, text, text) to service_role;
