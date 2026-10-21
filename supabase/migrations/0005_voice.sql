-- Automancy Academy · 0005 voice & assistant: natural-voice cache, daily budgets, Sage usage
-- Run after 0001_core.sql.

-- ── Storage bucket for generated MP3s (public read; only the server writes, with the service role) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts', 'tts', true, 104857600, array['audio/mpeg'])
on conflict (id) do update set public = true, allowed_mime_types = array['audio/mpeg'];

drop policy if exists "tts: public read" on storage.objects;
create policy "tts: public read" on storage.objects for select using (bucket_id = 'tts');
-- No insert/update/delete policies: uploads go through the service-role client after an auth check.

-- ── Cache index: sha256(voice|rate|text) → file ─────────────────────────────
create table if not exists public.tts_cache (
  hash text primary key,
  voice text not null,
  chars integer not null,
  path text not null,
  kind text not null default 'clip' check (kind in ('clip','lesson')),
  item_id text,
  created_at timestamptz not null default now()
);
create index if not exists tts_cache_item_idx on public.tts_cache(item_id) where kind = 'lesson';
alter table public.tts_cache enable row level security;
drop policy if exists "tts_cache: admin read" on public.tts_cache;
create policy "tts_cache: admin read" on public.tts_cache for select using (public.is_admin());

-- Admin → Lesson audio stats (invoker rights: RLS limits it to admins)
create or replace function public.tts_cache_stats()
returns table(kind text, files bigint, chars bigint)
language sql stable security invoker set search_path = public as $$
  select kind, count(*)::bigint, coalesce(sum(chars), 0)::bigint from public.tts_cache group by kind;
$$;

-- ── Daily natural-voice budget per learner (cached clips don't count) ───────
create table if not exists public.tts_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  chars integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.tts_usage enable row level security;
drop policy if exists "tts_usage: read own" on public.tts_usage;
create policy "tts_usage: read own" on public.tts_usage for select using (user_id = auth.uid() or public.is_admin());

-- Atomically add chars to today's (Lagos time) usage. Returns the new total, or NULL if it would pass p_limit.
-- Negative p_chars refunds. Called only by the server (service role).
create or replace function public.tts_charge(p_user uuid, p_chars integer, p_limit integer)
returns integer language plpgsql security definer set search_path = public as $$
declare total integer; d date := (now() at time zone 'Africa/Lagos')::date;
begin
  if p_chars > p_limit then return null; end if;
  insert into public.tts_usage as u (user_id, day, chars) values (p_user, d, greatest(p_chars, 0))
  on conflict (user_id, day) do update set chars = greatest(0, u.chars + p_chars), updated_at = now()
    where p_chars <= 0 or u.chars + p_chars <= p_limit
  returning u.chars into total;
  return total;
end $$;
revoke all on function public.tts_charge(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.tts_charge(uuid, integer, integer) to service_role;

-- ── Sage (course assistant): questions per learner per day ─────────────────
create table if not exists public.assistant_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  questions integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.assistant_usage enable row level security;
drop policy if exists "assistant_usage: read own" on public.assistant_usage;
create policy "assistant_usage: read own" on public.assistant_usage for select using (user_id = auth.uid() or public.is_admin());

-- Same pattern: returns the new count, or NULL when the daily limit is reached. Negative p_n refunds.
create or replace function public.assistant_charge(p_user uuid, p_n integer, p_limit integer)
returns integer language plpgsql security definer set search_path = public as $$
declare total integer; d date := (now() at time zone 'Africa/Lagos')::date;
begin
  if p_n > p_limit then return null; end if;
  insert into public.assistant_usage as u (user_id, day, questions) values (p_user, d, greatest(p_n, 0))
  on conflict (user_id, day) do update set questions = greatest(0, u.questions + p_n), updated_at = now()
    where p_n <= 0 or u.questions + p_n <= p_limit
  returning u.questions into total;
  return total;
end $$;
revoke all on function public.assistant_charge(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.assistant_charge(uuid, integer, integer) to service_role;
