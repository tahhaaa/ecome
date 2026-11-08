-- PostgreSQL does not provide jsonb_object_length(). The order placement
-- function from migration 0006 uses it to decide whether size inventory is
-- configured, which makes every order fail at runtime. Add a small compatible
-- helper in the function's public search_path so that the existing function
-- can validate inventory without replacing its full body.
create or replace function public.jsonb_object_length(p_value jsonb)
returns integer
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select count(*)::integer
    from pg_catalog.jsonb_object_keys(p_value);
$$;

revoke all on function public.jsonb_object_length(jsonb) from public, anon, authenticated;
grant execute on function public.jsonb_object_length(jsonb) to service_role;
