-- Free shipping is stored as a zero fee on an order. The original table
-- constraint only allowed the standard 25 DH and 35 DH delivery amounts.
alter table public.shop_orders
  drop constraint if exists shop_orders_shipping_fee_check;

alter table public.shop_orders
  add constraint shop_orders_shipping_fee_check
  check (shipping_fee in (0, 25, 35));
