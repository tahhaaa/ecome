alter table public.shop_orders
  add column if not exists tracking_token_hash text;

create unique index if not exists shop_orders_tracking_token_hash_idx
  on public.shop_orders (tracking_token_hash)
  where tracking_token_hash is not null;
