-- Repair the order RPC if an earlier deployment stored `d` instead of `\d`
-- in its quantity regex. The explicit digit class is portable and accepts 1–10.
do $migration$
declare
  v_function text;
begin
  select pg_get_functiondef(
    'public.place_shop_cart_order(text,text,text,jsonb,integer,text)'::regprocedure
  ) into v_function;

  v_function := replace(v_function, $$'^d{1,2}$'$$, $$'^[0-9]{1,2}$'$$);
  v_function := replace(v_function, $$'^\d{1,2}$'$$, $$'^[0-9]{1,2}$'$$);

  if position($$'^[0-9]{1,2}$'$$ in v_function) = 0 then
    raise exception 'Quantity validation pattern was not found in place_shop_cart_order';
  end if;

  execute v_function;
end;
$migration$;
