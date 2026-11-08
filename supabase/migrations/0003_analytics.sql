create table if not exists public.shop_analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('page_view', 'product_view')),
  visitor_id uuid not null,
  path text not null,
  product_id text,
  created_at timestamptz not null default now()
);

create index if not exists shop_analytics_events_created_idx
  on public.shop_analytics_events (created_at desc);
create index if not exists shop_analytics_events_type_created_idx
  on public.shop_analytics_events (event_type, created_at desc);
create index if not exists shop_analytics_events_visitor_created_idx
  on public.shop_analytics_events (visitor_id, created_at desc);
alter table public.shop_analytics_events enable row level security;

create table if not exists public.shop_active_visitors (
  visitor_id uuid primary key,
  path text not null,
  last_seen timestamptz not null default now()
);
create index if not exists shop_active_visitors_last_seen_idx
  on public.shop_active_visitors (last_seen desc);
alter table public.shop_active_visitors enable row level security;

create or replace function public.get_shop_analytics(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with events as (
    select event_type, visitor_id, product_id, created_at,
           (created_at at time zone 'Africa/Casablanca')::date as local_day
      from public.shop_analytics_events
     where created_at >= p_since
  ),
  daily as (
    select local_day,
           count(distinct visitor_id) as visitors,
           count(*) filter (where event_type = 'page_view') as page_views
      from events
     where event_type = 'page_view'
     group by local_day
  ),
  popular as (
    select product_id, count(*) as views
      from events
     where event_type = 'product_view' and product_id is not null
     group by product_id
     order by views desc
     limit 5
  )
  select jsonb_build_object(
    'visitors', (select count(distinct visitor_id) from events where event_type = 'page_view'),
    'page_views', (select count(*) from events where event_type = 'page_view'),
    'product_views', (select count(*) from events where event_type = 'product_view'),
    'active_visitors', (select count(*) from public.shop_active_visitors where last_seen >= now() - interval '150 seconds'),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', days.local_day,
        'visitors', coalesce(daily.visitors, 0),
        'page_views', coalesce(daily.page_views, 0)
      ) order by days.local_day)
      from generate_series(
        ((now() at time zone 'Africa/Casablanca')::date - 29)::timestamp,
        (now() at time zone 'Africa/Casablanca')::date::timestamp,
        interval '1 day'
      ) as days(local_day)
      left join daily on daily.local_day = days.local_day
    ), '[]'::jsonb),
    'popular_products', coalesce((select jsonb_agg(jsonb_build_object('product_id', product_id, 'views', views) order by views desc) from popular), '[]'::jsonb)
  );
$$;

revoke all on function public.get_shop_analytics(timestamptz) from public, anon, authenticated;
grant execute on function public.get_shop_analytics(timestamptz) to service_role;
