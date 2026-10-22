-- =============================================================================
-- PHILRADS Staff Portal: inventory operations
--
-- * Multiple warehouses / hubs / field points (inventory_locations).
-- * Stock held in lots with optional expiry dates (inventory_batches).
-- * Every stock change goes through record_inventory_movement(), which checks
--   the caller's permission and re-validates every rule on the server:
--   whole positive quantities, no releasing more than a lot holds, no releasing
--   or transferring expired goods, perishables need an expiry date, etc.
-- * Offline-safe: each request carries a client_id generated on the device;
--   sending the same request twice records it once.
-- * Transfers by field staff wait for an approver (inventory.approve);
--   adjustments (count corrections, write-offs) are approver-only.
-- * The ledger stays append-only and every catalogue change is logged.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- New permission: approve transfers and adjust stock (placeholder, TBC)
-- ---------------------------------------------------------------------------
insert into public.permissions (key, description) values
  ('inventory.approve', 'Approve stock transfers and record adjustments / write-offs (TBC)')
on conflict (key) do nothing;
insert into public.role_permissions (role_key, permission_key) values ('admin', 'inventory.approve')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Locations
-- ---------------------------------------------------------------------------
create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 80),
  kind text not null default 'warehouse' check (kind in ('warehouse', 'hub', 'field')),
  region text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger inventory_locations_set_updated_at before update on public.inventory_locations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Items: barcode, perishable flag, stricter identity rules
-- ---------------------------------------------------------------------------
alter table public.inventory_items
  add column barcode text unique check (barcode is null or (length(barcode) between 1 and 64 and barcode !~ '\s')),
  add column tracks_expiry boolean not null default false,
  add constraint inventory_items_sku_format check (sku is null or sku ~ '^[A-Z0-9][A-Z0-9-]{2,23}$'),
  add constraint inventory_items_category_check check (
    category is null or category in ('Food', 'Water and sanitation', 'Hygiene', 'Shelter', 'Medical', 'Household', 'Other')
  );
create unique index inventory_items_name_unique on public.inventory_items (lower(trim(name)));
comment on column public.inventory_items.reorder_level is 'Per location: a location below this needs restocking.';

-- ---------------------------------------------------------------------------
-- Lots (batches): stock of one item at one location
-- ---------------------------------------------------------------------------
create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete restrict,
  location_id uuid not null references public.inventory_locations (id) on delete restrict,
  lot_number text check (lot_number is null or length(lot_number) between 1 and 40),
  expiry_date date,
  -- Maintained only by the inventory_movements trigger. Can never go negative.
  quantity_on_hand numeric(14, 2) not null default 0 check (quantity_on_hand >= 0),
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_batches_lot_key unique nulls not distinct (item_id, location_id, lot_number, expiry_date)
);
create index inventory_batches_item_idx on public.inventory_batches (item_id, location_id);
create index inventory_batches_expiry_idx on public.inventory_batches (expiry_date) where quantity_on_hand > 0;
create trigger inventory_batches_set_updated_at before update on public.inventory_batches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Transfers (approval workflow). Approved transfers write two ledger rows.
-- ---------------------------------------------------------------------------
create table public.inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique,
  item_id uuid not null references public.inventory_items (id) on delete restrict,
  batch_id uuid not null references public.inventory_batches (id) on delete restrict,
  from_location_id uuid not null references public.inventory_locations (id) on delete restrict,
  to_location_id uuid not null references public.inventory_locations (id) on delete restrict,
  quantity numeric(14, 2) not null check (quantity > 0 and quantity = trunc(quantity)),
  reference text check (reference is null or length(reference) <= 80),
  notes text check (notes is null or length(notes) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  occurred_at timestamptz not null default now(),
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or length(decision_note) <= 200),
  constraint inventory_transfers_distinct_locations check (from_location_id <> to_location_id),
  constraint inventory_transfers_decision check (
    (status = 'pending' and decided_at is null)
    or (status = 'approved' and decided_at is not null)
    or (status = 'rejected' and decided_at is not null and length(trim(coalesce(decision_note, ''))) > 0)
  )
);
create index inventory_transfers_pending_idx on public.inventory_transfers (batch_id) where status = 'pending';
create index inventory_transfers_requested_idx on public.inventory_transfers (requested_at desc);

-- ---------------------------------------------------------------------------
-- Ledger: link each movement to its lot and location
-- ---------------------------------------------------------------------------
alter table public.inventory_movements
  add column client_id uuid unique,
  add column batch_id uuid references public.inventory_batches (id) on delete restrict,
  add column location_id uuid references public.inventory_locations (id) on delete restrict,
  add column transfer_id uuid references public.inventory_transfers (id) on delete restrict;
create index inventory_movements_batch_idx on public.inventory_movements (batch_id, occurred_at desc);
create index inventory_movements_location_idx on public.inventory_movements (location_id, occurred_at desc);
create index inventory_movements_recent_idx on public.inventory_movements (occurred_at desc);

-- The ledger trigger now keeps both the item total and the lot quantity in step.
create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.inventory_items
     set quantity_on_hand = quantity_on_hand + new.quantity_change
   where id = new.item_id;
  if new.batch_id is not null then
    update public.inventory_batches
       set quantity_on_hand = quantity_on_hand + new.quantity_change
     where id = new.batch_id;
  end if;
  return new;
end;
$$;

-- Writes go only through the functions below, which validate every rule.
drop policy if exists inventory_movements_insert on public.inventory_movements;
revoke insert, update, delete on public.inventory_movements from authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.inventory_locations enable row level security;
alter table public.inventory_batches   enable row level security;
alter table public.inventory_transfers enable row level security;

create policy inventory_locations_read on public.inventory_locations for select to authenticated
  using ((select public.has_permission('inventory.read')));
create policy inventory_locations_manage on public.inventory_locations for all to authenticated
  using ((select public.has_permission('inventory.manage'))) with check ((select public.has_permission('inventory.manage')));

create policy inventory_batches_read on public.inventory_batches for select to authenticated
  using ((select public.has_permission('inventory.read')));
-- No write policies: lots change only through the ledger.
revoke insert, update, delete on public.inventory_batches from authenticated;

create policy inventory_transfers_read on public.inventory_transfers for select to authenticated
  using ((select public.has_permission('inventory.read')));
-- No write policies: transfers are created and decided only through the functions below.
revoke insert, update, delete on public.inventory_transfers from authenticated;

revoke all on public.inventory_locations, public.inventory_batches, public.inventory_transfers from anon;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.inventory_fail(p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- P0001: the app shows these messages to staff as-is and does not retry.
  raise exception using errcode = 'P0001', message = p_message;
end;
$$;

-- Today in the Philippines: expiry is judged by the local calendar day.
create or replace function public.inventory_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Manila')::date $$;

-- ---------------------------------------------------------------------------
-- record_inventory_movement: the single write path for stock
-- ---------------------------------------------------------------------------
create or replace function public.record_inventory_movement(
  p_client_id uuid,
  p_type text,
  p_item_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_batch_id uuid default null,
  p_to_location_id uuid default null,
  p_lot_number text default null,
  p_expiry_date date default null,
  p_reference text default null,
  p_notes text default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.inventory_items%rowtype;
  v_batch public.inventory_batches%rowtype;
  v_dest uuid;
  v_reserved numeric;
  v_available numeric;
  v_id uuid;
  v_ref text := nullif(trim(coalesce(p_reference, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_lot text := nullif(trim(coalesce(p_lot_number, '')), '');
  v_can_approve boolean := public.has_permission('inventory.approve');
begin
  if v_uid is null or not public.has_permission('inventory.record') then
    perform public.inventory_fail('Your role can view inventory but not record movements.');
  end if;
  if p_client_id is null then
    perform public.inventory_fail('Missing request id.');
  end if;

  -- Idempotency: a retried request returns what was already recorded.
  select id into v_id from public.inventory_movements where client_id = p_client_id;
  if found then
    return jsonb_build_object('id', v_id, 'status', 'applied', 'duplicate', true);
  end if;
  select id into v_id from public.inventory_transfers where client_id = p_client_id;
  if found then
    return jsonb_build_object('id', v_id, 'status', (select status from public.inventory_transfers where id = v_id), 'duplicate', true);
  end if;

  if p_type not in ('receipt', 'release', 'transfer', 'adjustment') then
    perform public.inventory_fail('Unknown movement type.');
  end if;
  if p_quantity is null or p_quantity <> trunc(p_quantity) then
    perform public.inventory_fail('Enter a whole number.');
  end if;
  if p_type = 'adjustment' and p_quantity = 0 then
    perform public.inventory_fail('An adjustment cannot be zero.');
  end if;
  if p_type <> 'adjustment' and p_quantity <= 0 then
    perform public.inventory_fail('Quantity must be at least 1.');
  end if;
  if abs(p_quantity) > 1000000 then
    perform public.inventory_fail('Quantity cannot exceed 1,000,000.');
  end if;
  if p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
    perform public.inventory_fail('The movement time cannot be in the future.');
  end if;
  if p_occurred_at < now() - interval '60 days' then
    perform public.inventory_fail('Older than 60 days: ask an administrator to record it.');
  end if;
  if length(coalesce(v_ref, '')) > 80 or length(coalesce(v_notes, '')) > 500 then
    perform public.inventory_fail('Reference or notes are too long.');
  end if;

  select * into v_item from public.inventory_items where id = p_item_id and is_active;
  if not found then
    perform public.inventory_fail('That item does not exist or was retired.');
  end if;
  if not exists (select 1 from public.inventory_locations where id = p_location_id and is_active) then
    perform public.inventory_fail('That location does not exist or was closed.');
  end if;

  -- Receipt: into the matching lot, created on first use.
  if p_type = 'receipt' then
    if v_item.tracks_expiry and p_expiry_date is null then
      perform public.inventory_fail('Perishable: enter the expiry date printed on the goods.');
    end if;
    if p_expiry_date is not null and p_expiry_date < public.inventory_today() then
      perform public.inventory_fail('These goods have expired. Do not receive them into stock.');
    end if;
    if length(coalesce(v_lot, '')) > 40 then
      perform public.inventory_fail('Keep the lot number under 40 characters.');
    end if;
    insert into public.inventory_batches (item_id, location_id, lot_number, expiry_date)
    values (p_item_id, p_location_id, v_lot, p_expiry_date)
    on conflict on constraint inventory_batches_lot_key do nothing;
    select * into v_batch from public.inventory_batches
     where item_id = p_item_id and location_id = p_location_id
       and lot_number is not distinct from v_lot and expiry_date is not distinct from p_expiry_date;
    insert into public.inventory_movements
      (client_id, item_id, batch_id, location_id, movement_type, quantity_change, reference, notes, recorded_by, occurred_at)
    values (p_client_id, p_item_id, v_batch.id, p_location_id, 'receipt', p_quantity, v_ref, v_notes, v_uid, p_occurred_at)
    returning id into v_id;
    return jsonb_build_object('id', v_id, 'status', 'applied');
  end if;

  -- Release, transfer and adjustment draw on one lot. Lock it so two people
  -- releasing the same lot at once can't both succeed past zero.
  select * into v_batch from public.inventory_batches
   where id = p_batch_id and item_id = p_item_id and location_id = p_location_id
   for update;
  if not found then
    perform public.inventory_fail('Choose the lot the goods come from.');
  end if;
  select coalesce(sum(quantity), 0) into v_reserved
    from public.inventory_transfers where batch_id = v_batch.id and status = 'pending';
  v_available := v_batch.quantity_on_hand - v_reserved;

  if p_type in ('release', 'transfer') then
    if v_batch.expiry_date is not null and v_batch.expiry_date < public.inventory_today() then
      perform public.inventory_fail('This lot has expired and cannot be released or transferred. An approver can write it off.');
    end if;
    if p_quantity > v_available then
      perform public.inventory_fail(format('Only %s available in this lot.', trim(to_char(greatest(v_available, 0), 'FM999,999,990'))));
    end if;
  end if;

  if p_type = 'release' then
    if v_ref is null then
      perform public.inventory_fail('Say who received the goods or give the DR/RIS number.');
    end if;
    insert into public.inventory_movements
      (client_id, item_id, batch_id, location_id, movement_type, quantity_change, reference, notes, recorded_by, occurred_at)
    values (p_client_id, p_item_id, v_batch.id, p_location_id, 'release', -p_quantity, v_ref, v_notes, v_uid, p_occurred_at)
    returning id into v_id;
    return jsonb_build_object('id', v_id, 'status', 'applied');
  end if;

  if p_type = 'adjustment' then
    if not v_can_approve then
      perform public.inventory_fail('Only approvers can adjust stock. Ask an administrator.');
    end if;
    if v_notes is null then
      perform public.inventory_fail('Give the reason for the adjustment.');
    end if;
    if p_quantity < 0 and -p_quantity > v_available then
      perform public.inventory_fail(format('Cannot remove more than the %s in this lot.', trim(to_char(greatest(v_available, 0), 'FM999,999,990'))));
    end if;
    insert into public.inventory_movements
      (client_id, item_id, batch_id, location_id, movement_type, quantity_change, reference, notes, recorded_by, occurred_at)
    values (p_client_id, p_item_id, v_batch.id, p_location_id, 'adjustment', p_quantity, v_ref, v_notes, v_uid, p_occurred_at)
    returning id into v_id;
    return jsonb_build_object('id', v_id, 'status', 'applied');
  end if;

  -- Transfer
  v_dest := p_to_location_id;
  if v_dest is null or not exists (select 1 from public.inventory_locations where id = v_dest and is_active) then
    perform public.inventory_fail('Choose the destination.');
  end if;
  if v_dest = p_location_id then
    perform public.inventory_fail('Destination must differ from the source.');
  end if;
  insert into public.inventory_transfers
    (client_id, item_id, batch_id, from_location_id, to_location_id, quantity, reference, notes, occurred_at, requested_by)
  values (p_client_id, p_item_id, v_batch.id, p_location_id, v_dest, p_quantity, v_ref, v_notes, p_occurred_at, v_uid)
  returning id into v_id;
  -- Approvers' own transfers apply at once.
  if v_can_approve then
    perform public.apply_inventory_transfer(v_id, v_uid, null);
    return jsonb_build_object('id', v_id, 'status', 'approved');
  end if;
  return jsonb_build_object('id', v_id, 'status', 'pending');
end;
$$;

-- Moves the stock for an approved transfer: out of the source lot, into the
-- matching lot at the destination. Internal: called by the functions here only.
create or replace function public.apply_inventory_transfer(p_transfer_id uuid, p_decider uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.inventory_transfers%rowtype;
  src public.inventory_batches%rowtype;
  dest_id uuid;
begin
  select * into t from public.inventory_transfers where id = p_transfer_id for update;
  select * into src from public.inventory_batches where id = t.batch_id for update;
  if src.expiry_date is not null and src.expiry_date < public.inventory_today() then
    perform public.inventory_fail('This lot expired before approval. Reject the transfer instead.');
  end if;
  if src.quantity_on_hand < t.quantity then
    perform public.inventory_fail(format('The source lot only has %s left.', trim(to_char(src.quantity_on_hand, 'FM999,999,990'))));
  end if;
  insert into public.inventory_batches (item_id, location_id, lot_number, expiry_date, received_at)
  values (t.item_id, t.to_location_id, src.lot_number, src.expiry_date, now())
  on conflict on constraint inventory_batches_lot_key do nothing;
  select id into dest_id from public.inventory_batches
   where item_id = t.item_id and location_id = t.to_location_id
     and lot_number is not distinct from src.lot_number and expiry_date is not distinct from src.expiry_date;

  update public.inventory_transfers
     set status = 'approved', decided_by = p_decider, decided_at = now(), decision_note = nullif(trim(coalesce(p_note, '')), '')
   where id = t.id;
  insert into public.inventory_movements
    (item_id, batch_id, location_id, transfer_id, movement_type, quantity_change, reference, notes, recorded_by, occurred_at)
  values
    (t.item_id, src.id, t.from_location_id, t.id, 'transfer_out', -t.quantity, t.reference, t.notes, t.requested_by, t.occurred_at),
    (t.item_id, dest_id, t.to_location_id, t.id, 'transfer_in', t.quantity, t.reference, t.notes, t.requested_by, t.occurred_at);
end;
$$;

create or replace function public.decide_inventory_transfer(p_transfer_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if auth.uid() is null or not public.has_permission('inventory.approve') then
    perform public.inventory_fail('Only approvers can decide on transfers.');
  end if;
  select status into v_status from public.inventory_transfers where id = p_transfer_id for update;
  if not found then
    perform public.inventory_fail('That transfer no longer exists.');
  end if;
  if v_status <> 'pending' then
    perform public.inventory_fail('Someone already decided on this transfer.');
  end if;
  if p_approve then
    perform public.apply_inventory_transfer(p_transfer_id, auth.uid(), p_note);
  else
    if length(trim(coalesce(p_note, ''))) = 0 then
      perform public.inventory_fail('Give a reason for rejecting the transfer.');
    end if;
    update public.inventory_transfers
       set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = trim(p_note)
     where id = p_transfer_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit: catalogue changes are written to the activity log automatically
-- ---------------------------------------------------------------------------
create or replace function public.log_inventory_item_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_logs (actor_id, module, action, entity_type, entity_id, summary, metadata)
  values (
    auth.uid(),
    'inventory',
    case tg_op when 'INSERT' then 'item.created' else 'item.updated' end,
    'inventory_item',
    new.id::text,
    case tg_op when 'INSERT' then 'Added inventory item ' else 'Updated inventory item ' end || new.name,
    case tg_op
      when 'INSERT' then jsonb_build_object('new', to_jsonb(new) - 'quantity_on_hand' - 'updated_at' - 'created_at')
      else jsonb_build_object(
        'old', to_jsonb(old) - 'quantity_on_hand' - 'updated_at' - 'created_at',
        'new', to_jsonb(new) - 'quantity_on_hand' - 'updated_at' - 'created_at'
      )
    end
  );
  return new;
end;
$$;
create trigger inventory_items_audit after insert or update of sku, barcode, name, category, unit, reorder_level, tracks_expiry, is_active
  on public.inventory_items for each row execute function public.log_inventory_item_change();

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on function public.record_inventory_movement(uuid, text, uuid, uuid, numeric, uuid, uuid, text, date, text, text, timestamptz) from public, anon;
revoke execute on function public.decide_inventory_transfer(uuid, boolean, text) from public, anon;
grant execute on function public.record_inventory_movement(uuid, text, uuid, uuid, numeric, uuid, uuid, text, date, text, text, timestamptz) to authenticated;
grant execute on function public.decide_inventory_transfer(uuid, boolean, text) to authenticated;
-- Internal helpers are not callable through the API.
revoke execute on function public.apply_inventory_transfer(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.log_inventory_item_change() from public, anon, authenticated;
revoke execute on function public.inventory_fail(text) from public, anon, authenticated;
revoke execute on function public.inventory_today() from public, anon, authenticated;
