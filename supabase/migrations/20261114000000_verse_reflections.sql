-- Verse of the Day: staff share a short reflection on today's verse (Home → Read more).
--
-- * One reflection per person per day, at most 280 characters: a thought, not an essay.
-- * Every active staff member reads them; each person writes, edits and deletes only their own.
--   Administrators (staff.manage) can remove any, to keep the space kind.
-- * Only today's verse can be written about (Manila time); older reflections stay readable.

create table public.verse_reflections (
  id uuid primary key default gen_random_uuid(),
  verse_day date not null,
  verse_ref text not null check (char_length(verse_ref) between 3 and 60),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 3 and 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, verse_day)
);
comment on table public.verse_reflections is 'Short reflections staff share on the Verse of the Day (one each per day, up to 280 characters).';
create index verse_reflections_day_idx on public.verse_reflections (verse_day, created_at desc);

alter table public.verse_reflections enable row level security;
create policy verse_reflections_read on public.verse_reflections for select to authenticated
  using ((select public.is_active_staff()));
create policy verse_reflections_insert on public.verse_reflections for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select public.is_active_staff())
    and verse_day = (now() at time zone 'Asia/Manila')::date
  );
create policy verse_reflections_update on public.verse_reflections for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()) and verse_day = (now() at time zone 'Asia/Manila')::date);
create policy verse_reflections_delete on public.verse_reflections for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.has_permission('staff.manage')));
revoke all on public.verse_reflections from anon;

-- Only the words can change, and the time of the change is kept.
create or replace function public.guard_verse_reflection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.body := btrim(new.body);
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.author_id := old.author_id;
    new.verse_day := old.verse_day;
    new.verse_ref := old.verse_ref;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger verse_reflections_guard before insert or update on public.verse_reflections
  for each row execute function public.guard_verse_reflection();
