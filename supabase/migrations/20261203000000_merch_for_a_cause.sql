-- Merch for a cause (PHILRADS, 2026-11-27).
--
-- * A merch item can support one fundraiser, with a set amount of each sale going to it
--   (e.g. ₱150 of a ₱350 shirt; the rest pays for making it).
-- * Items can count how many are left. Guests can't ask for more than that.
-- * Ordering needs a sign-in: the order carries the account's own name and email (the browser
--   can't put someone else's), and who sent it.
-- * When the team marks a merch order paid, that amount × the quantity is added to the
--   fundraiser's raised total (peso fundraisers only), the items to its count of merch sold, and
--   the items come off what's left in stock. Undoing it puts back exactly what it changed, so a
--   mistaken tap is safe.

-- ───────────────────────── Merch ─────────────────────────
alter table public.merch_items
  add column drive_id uuid references public.donation_drives (id) on delete set null,
  add column drive_share numeric(10, 2) check (drive_share is null or drive_share >= 0),
  -- How many are left; null when the team doesn't count them.
  add column stock_left integer check (stock_left is null or stock_left >= 0);
alter table public.merch_items
  add constraint merch_items_share_fits_price check (drive_share is null or price is null or drive_share <= price);
create index merch_items_drive_idx on public.merch_items (drive_id) where drive_id is not null;

alter table public.donation_drives
  add column merch_sold integer not null default 0 check (merch_sold >= 0);

-- ───────────────────────── Orders ─────────────────────────
-- Who sent an order, and what marking it paid changed (kept so undoing it takes off exactly that,
-- even if the item's share or stock changed since).
alter table public.guest_messages
  add column sender_id uuid references public.profiles (id) on delete set null,
  add column paid_at timestamptz,
  add column paid_by uuid references public.profiles (id) on delete set null,
  add column paid_drive_id uuid references public.donation_drives (id) on delete set null,
  add column paid_amount numeric(14, 2),
  add column paid_items smallint,
  add column paid_from_stock smallint;

-- Staff change a message's status directly; whether it is paid only through set_merch_order_paid.
revoke update on public.guest_messages from authenticated;
grant update (status, handled_by, handled_at) on public.guest_messages to authenticated;

-- Sending a message: as before (20261202000000_guest_qa_fixes.sql), and an order now needs a
-- signed-in account, takes its name and email from that account, and fits the stock left.
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
  who_name text := p_name;
  me uuid := auth.uid();
  new_id uuid;
  item_name text;
  item_left integer;
  item_in_stock boolean;
  qty smallint := greatest(1, least(coalesce(p_quantity, 1), 99));
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

  if p_kind = 'order' then
    if me is null then
      raise exception 'Sign in to order.' using errcode = '42501';
    end if;
    -- The account's own name and email, whatever the browser sent.
    select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.display_name), '')), u.email
      into who_name, contact
      from auth.users u left join public.profiles p on p.id = u.id
     where u.id = me;
    contact := trim(coalesce(contact, ''));
    if contact = '' then
      raise exception 'Your account has no email address. Sign in again with your email.' using errcode = '22023';
    end if;
    select m.name, m.stock_left, m.in_stock into item_name, item_left, item_in_stock from public.merch_items m where m.id = p_merch_id and m.is_listed;
    if item_name is null then
      raise exception 'That item is no longer listed.' using errcode = '22023';
    end if;
    if not item_in_stock or item_left = 0 then
      raise exception 'That item is out of stock.' using errcode = '22023';
    end if;
    if item_left is not null and qty > item_left then
      raise exception 'Only % left. Choose % or fewer.', item_left, item_left using errcode = '22023';
    end if;
  else
    if p_kind = 'volunteer' and contact = '' then
      raise exception 'Add a phone number or email so we can reply.' using errcode = '22023';
    end if;
    -- An email, or 7 to 15 digits with an optional + (spaces, dashes, dots and brackets are fine).
    if contact <> '' and not (
         (position('@' in contact) > 0 and contact ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$')
      or (position('@' in contact) = 0 and regexp_replace(contact, '[[:space:]().-]', '', 'g') ~ '^\+?[0-9]{7,15}$')
    ) then
      raise exception 'Enter a phone number, like 0917 123 4567, or an email address.' using errcode = '22023';
    end if;
  end if;

  -- At most 5 messages an hour from one connection, and 300 an hour in all.
  if (select count(*) from public.guest_messages g where g.sender_hash = hash and g.created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.guest_messages g where g.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Too many messages for now. Please try again in an hour.' using errcode = '54000';
  end if;

  insert into public.guest_messages (kind, message, rating, community, name, contact, merch_id, merch_size, quantity, sender_hash, sender_id)
  values (
    p_kind, msg,
    case when p_rating between 1 and 5 then p_rating end,
    nullif(left(trim(coalesce(p_community, '')), 120), ''),
    nullif(left(trim(coalesce(who_name, '')), 80), ''),
    nullif(left(contact, 120), ''),
    case when p_kind = 'order' then p_merch_id end,
    case when p_kind = 'order' then nullif(left(trim(coalesce(p_merch_size, '')), 20), '') end,
    case when p_kind = 'order' then qty end,
    hash,
    me
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

-- ───────────────────────── Marking an order paid ─────────────────────────
create or replace function public.set_merch_order_paid(p_message uuid, p_paid boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  m public.guest_messages%rowtype;
  cut numeric(10, 2);
  linked uuid;
  left_now integer;
  is_money boolean;
  qty smallint;
  amt numeric(14, 2);
  from_stock smallint := 0;
begin
  if not public.has_permission('guest.manage') then
    raise exception 'Only staff who manage the guest page can do this.' using errcode = '42501';
  end if;
  select * into m from public.guest_messages g where g.id = p_message for update;
  if not found or m.kind <> 'order' then
    raise exception 'That order wasn’t found.' using errcode = '22023';
  end if;

  if p_paid then
    if m.paid_at is not null then
      return jsonb_build_object('driveId', m.paid_drive_id, 'amount', m.paid_amount, 'items', m.paid_items);
    end if;
    qty := coalesce(m.quantity, 1);
    select i.drive_id, i.drive_share, i.stock_left into linked, cut, left_now from public.merch_items i where i.id = m.merch_id for update;
    if left_now is not null then
      from_stock := least(qty, left_now);
      update public.merch_items i set stock_left = i.stock_left - from_stock where i.id = m.merch_id;
    end if;
    if linked is not null then
      select upper(d.unit) = 'PHP' into is_money from public.donation_drives d where d.id = linked for update;
      if not found then
        linked := null;
      end if;
    end if;
    amt := case when linked is not null and is_money then coalesce(cut, 0) * qty else 0 end;
    if linked is not null then
      update public.donation_drives d set raised = d.raised + amt, merch_sold = d.merch_sold + qty where d.id = linked;
    end if;
    update public.guest_messages g
       set paid_at = now(), paid_by = auth.uid(), paid_drive_id = linked, paid_amount = amt, paid_items = qty, paid_from_stock = from_stock,
           status = 'done', handled_by = coalesce(g.handled_by, auth.uid()), handled_at = coalesce(g.handled_at, now())
     where g.id = m.id;
    return jsonb_build_object('driveId', linked, 'amount', amt, 'items', qty);
  end if;

  -- Undo.
  if m.paid_at is null then
    return jsonb_build_object('driveId', null, 'amount', 0, 'items', 0);
  end if;
  if m.paid_drive_id is not null then
    update public.donation_drives d
       set raised = greatest(0, d.raised - coalesce(m.paid_amount, 0)),
           merch_sold = greatest(0, d.merch_sold - coalesce(m.paid_items, 0))
     where d.id = m.paid_drive_id;
  end if;
  if coalesce(m.paid_from_stock, 0) > 0 then
    update public.merch_items i set stock_left = i.stock_left + m.paid_from_stock where i.id = m.merch_id and i.stock_left is not null;
  end if;
  update public.guest_messages g
     set paid_at = null, paid_by = null, paid_drive_id = null, paid_amount = null, paid_items = null, paid_from_stock = null
   where g.id = m.id;
  return jsonb_build_object('driveId', m.paid_drive_id, 'amount', -coalesce(m.paid_amount, 0), 'items', -coalesce(m.paid_items, 0));
end;
$$;
revoke all on function public.set_merch_order_paid(uuid, boolean) from public;
grant execute on function public.set_merch_order_paid(uuid, boolean) to authenticated;
