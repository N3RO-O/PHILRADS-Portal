-- Fixes from the QA report of 26 November 2026.
--
-- * BUG-01: a reply address on a guest message must be a real email or phone number, not any text.
--   The guest page checks the same (contactProblem in src/services/guest/guestService.ts).
-- * BUG-09: signed-out visitors read the hotlines without created_by (which staff member added each).

-- ───────────────────────── Sending a message ─────────────────────────
create or replace function public.submit_guest_message(
  p_kind text,
  p_message text,
  p_rating smallint default null,
  p_community text default null,
  p_name text default null,
  p_contact text default null,
  p_merch_id uuid default null,
  p_merch_size text default null,
  p_quantity smallint default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  sender text := coalesce(headers ->> 'cf-connecting-ip', split_part(headers ->> 'x-forwarded-for', ',', 1), headers ->> 'x-real-ip', 'unknown');
  hash text := encode(extensions.digest('philrads-guest:' || trim(sender), 'sha256'), 'hex');
  msg text := trim(coalesce(p_message, ''));
  contact text := trim(coalesce(p_contact, ''));
  new_id uuid;
  item_name text;
  title text;
begin
  if p_kind not in ('thanks', 'suggestion', 'need', 'concern', 'order', 'volunteer') then
    raise exception 'Choose what your message is about.' using errcode = '22023';
  end if;
  if length(msg) < 2 then
    raise exception 'Write a message first.' using errcode = '22023';
  end if;
  if length(msg) > 2000 then
    raise exception 'Keep the message under 2,000 characters.' using errcode = '22023';
  end if;
  if p_kind in ('order', 'volunteer') and contact = '' then
    raise exception 'Add a phone number or email so we can reply.' using errcode = '22023';
  end if;
  -- An email, or 7 to 15 digits with an optional + (spaces, dashes, dots and brackets are fine).
  if contact <> '' and not (
       (position('@' in contact) > 0 and contact ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$')
    or (position('@' in contact) = 0 and regexp_replace(contact, '[[:space:]().-]', '', 'g') ~ '^\+?[0-9]{7,15}$')
  ) then
    raise exception 'Enter a phone number, like 0917 123 4567, or an email address.' using errcode = '22023';
  end if;
  if p_kind = 'order' then
    select m.name into item_name from public.merch_items m where m.id = p_merch_id and m.is_listed;
    if item_name is null then
      raise exception 'That item is no longer listed.' using errcode = '22023';
    end if;
  end if;
  -- At most 5 messages an hour from one connection, and 300 an hour in all.
  if (select count(*) from public.guest_messages g where g.sender_hash = hash and g.created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.guest_messages g where g.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Too many messages for now. Please try again in an hour.' using errcode = '54000';
  end if;

  insert into public.guest_messages (kind, message, rating, community, name, contact, merch_id, merch_size, quantity, sender_hash)
  values (
    p_kind, msg,
    case when p_rating between 1 and 5 then p_rating end,
    nullif(left(trim(coalesce(p_community, '')), 120), ''),
    nullif(left(trim(coalesce(p_name, '')), 80), ''),
    nullif(left(contact, 120), ''),
    case when p_kind = 'order' then p_merch_id end,
    case when p_kind = 'order' then nullif(left(trim(coalesce(p_merch_size, '')), 20), '') end,
    case when p_kind = 'order' then greatest(1, least(coalesce(p_quantity, 1), 99)) end,
    hash
  )
  returning id into new_id;

  title := case p_kind
    when 'order' then 'Merch order request: ' || item_name
    when 'volunteer' then 'Someone wants to volunteer'
    when 'concern' then 'A guest raised a concern'
    when 'need' then 'A guest shared a community need'
    when 'suggestion' then 'A guest sent a suggestion'
    else 'A guest sent thanks'
  end;
  insert into public.notifications (recipient_id, title, body, link_path)
  select distinct p.id, title, left(msg, 140), '/guest-admin?tab=inbox'
  from public.profiles p
  join public.role_permissions rp on rp.role_key = p.role_key
  where p.is_active and rp.permission_key = 'guest.manage';

  return new_id;
end;
$$;
revoke all on function public.submit_guest_message(text, text, smallint, text, text, text, uuid, text, smallint) from public;
grant execute on function public.submit_guest_message(text, text, smallint, text, text, text, uuid, text, smallint) to anon, authenticated;

-- ───────────────────────── Hotlines: public columns only ─────────────────────────
revoke select on public.guest_hotlines from anon;
grant select (id, name, number, note, area, sort_order, is_listed, created_at, updated_at) on public.guest_hotlines to anon;
