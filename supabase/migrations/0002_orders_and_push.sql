create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  city text not null,
  items jsonb not null,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  shipping_fee numeric(10,2) not null check (shipping_fee in (25, 35)),
  total numeric(10,2) not null check (total = subtotal + shipping_fee),
  status text not null default 'new' check (status in ('new', 'confirmed', 'shipped', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_orders_created_at_idx on public.shop_orders (created_at desc);
create index if not exists shop_orders_status_idx on public.shop_orders (status, created_at desc);
alter table public.shop_orders enable row level security;

create table if not exists public.admin_push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_push_subscriptions enable row level security;
