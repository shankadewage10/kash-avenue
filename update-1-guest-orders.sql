-- =====================================================================
-- Update 1: guests can order without an account (email optional).
-- Run this ONCE in Supabase > SQL Editor if you already ran schema.sql earlier.
-- =====================================================================
drop function if exists public.place_order(text, text, jsonb);

-- ---------- place an order (guests and signed-in customers) ----------
-- Name, phone and address are required. Email is optional.
create or replace function public.place_order(
  p_ref text, p_name text, p_phone text, p_email text, p_address text, p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  prod public.products%rowtype;
  it jsonb; v_ref text; v_name text; v_size text; v_qty int; v_have int; v_key text;
  v_cust text; v_phone text; v_email text; v_addr text; v_cid uuid;
  v_items jsonb := '[]'; v_short jsonb := '[]'; v_used jsonb := '{}'; v_total int := 0;
begin
  v_cust  := left(trim(coalesce(p_name, '')), 80);
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_email := lower(left(trim(coalesce(p_email, '')), 120));
  v_addr  := left(trim(coalesce(p_address, '')), 300);

  if char_length(v_cust) < 2 then return jsonb_build_object('ok', false, 'error', 'Please enter your name.'); end if;
  if v_phone !~ '^\d{9,15}$' then return jsonb_build_object('ok', false, 'error', 'Please enter a valid phone number.'); end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'That email address does not look right. You can leave it empty.');
  end if;
  if v_addr = '' then return jsonb_build_object('ok', false, 'error', 'Please enter your delivery address.'); end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    return jsonb_build_object('ok', false, 'error', 'Bad items');
  end if;

  -- simple spam guard: at most 5 orders per phone number per hour
  if (select count(*) from public.orders where phone = v_phone and created > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'error', 'Too many orders from this number. Please message us on WhatsApp.');
  end if;

  v_ref := case when coalesce(p_ref, '') ~ '^[A-Z0-9-]{4,16}$' then p_ref
                else 'KA-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)) end;
  if exists (select 1 from public.orders where ref = v_ref) then
    if exists (select 1 from public.orders where ref = v_ref and phone = v_phone and address = v_addr) then
      return jsonb_build_object('ok', true, 'ref', v_ref);       -- same order sent twice
    end if;
    return jsonb_build_object('ok', false, 'error', 'Please try placing your order again.');
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_name := left(coalesce(it->>'name', ''), 120);
    v_size := left(coalesce(it->>'size', ''), 30);
    v_qty  := case when (it->>'qty') ~ '^\d{1,3}$' then greatest(1, least(50, (it->>'qty')::int)) else 1 end;
    select * into prod from public.products where name = v_name;
    if not found or lower(prod.status) = 'hidden' then
      return jsonb_build_object('ok', false, 'error', 'Sorry, "' || v_name || '" is no longer available.');
    end if;
    if prod.stock is not null then
      v_key  := v_name || '|' || v_size;
      v_used := jsonb_set(v_used, array[v_key], to_jsonb(coalesce((v_used->>v_key)::int, 0) + v_qty));
      v_have := coalesce((prod.stock->>v_size)::int, 0);
      if (v_used->>v_key)::int > v_have then
        v_short := v_short || jsonb_build_object('name', v_name, 'size', v_size, 'left', v_have);
      end if;
    end if;
    v_items := v_items || jsonb_build_object('name', v_name, 'size', v_size, 'qty', v_qty, 'price', prod.price);
    v_total := v_total + prod.price * v_qty;      -- price always comes from the database, not the browser
  end loop;

  if jsonb_array_length(v_short) > 0 then
    return jsonb_build_object('ok', false, 'error', 'stock', 'short', v_short);
  end if;

  if uid is not null then select id into v_cid from public.customers where id = uid; end if;   -- link to the account if signed in

  insert into public.orders (ref, customer_id, name, phone, email, address, items, total)
  values (v_ref, v_cid, v_cust, v_phone, v_email, v_addr, v_items, v_total);
  return jsonb_build_object('ok', true, 'ref', v_ref, 'total', v_total);
end $$;

revoke execute on function public.place_order(text, text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, text, jsonb) to anon, authenticated;
