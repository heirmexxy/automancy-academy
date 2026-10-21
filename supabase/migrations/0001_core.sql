-- Automancy Academy · 0001 core: profiles, enrollments, progress, settings, audit log
-- Run in order in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  city text,
  role text not null default 'learner' check (role in ('learner','reviewer','admin')),
  public_profile boolean not null default false,          -- opt-in: leaderboard, community name, hire profile
  referral_code text unique,
  marketing_consent boolean not null default false,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','reviewer'));
$$;

-- New auth user → profile with a referral code
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  code := upper(substr(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), '[^A-Za-z]', '', 'g'), 1, 5))
          || substr(replace(gen_random_uuid()::text,'-',''), 1, 4);
  insert into public.profiles (id, email, full_name, referral_code, marketing_consent, consent_at)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', upper(code),
          coalesce((new.raw_user_meta_data->>'marketing_consent')::boolean, false),
          case when coalesce((new.raw_user_meta_data->>'marketing_consent')::boolean, false) then now() end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Learners can't promote themselves
create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    new.role := old.role;
  end if;
  if new.referral_code is distinct from old.referral_code and coalesce(auth.role(), '') <> 'service_role' then
    new.referral_code := old.referral_code;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles for each row execute function public.protect_profile_role();

alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy "profiles: update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: admin all" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- ── Enrollments (what a learner has paid for) ───────────────────────────────
-- product: self | cohort | member | story | bundle | crmspec | team
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product text not null,
  status text not null default 'active' check (status in ('active','refunded','expired','cancelled')),
  source text not null default 'paystack' check (source in ('paystack','admin','free','coupon','team')),
  payment_id uuid,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists enrollments_user_idx on public.enrollments(user_id);
alter table public.enrollments enable row level security;
create policy "enrollments: read own" on public.enrollments for select using (user_id = auth.uid() or public.is_staff());
create policy "enrollments: admin write" on public.enrollments for all using (public.is_admin()) with check (public.is_admin());

-- ── Progress (the course's saved state, synced from /learn) ─────────────────
create table if not exists public.progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  done jsonb not null default '{}'::jsonb,      -- { "1.3": true, "B2": true, … }
  state jsonb not null default '{}'::jsonb,     -- quizzes, missions, journal, pace, streak days …
  xp integer not null default 0,
  items_done integer not null default 0,
  week_xp integer not null default 0,
  week_start date,
  updated_at timestamptz not null default now()
);
alter table public.progress enable row level security;
create policy "progress: own" on public.progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "progress: staff read" on public.progress for select using (public.is_staff());

-- ── Settings (runtime switches; Admin → Settings) ──────────────────────────
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
create policy "settings: read" on public.settings for select using (true);
create policy "settings: admin write" on public.settings for all using (public.is_admin()) with check (public.is_admin());
insert into public.settings(key, value) values
  ('cohort_open', 'false'), ('live_calls_visible', 'false'), ('next_cohort_date', 'null'), ('ai_review_auto', 'true')
on conflict (key) do nothing;

-- ── Audit log (who did what in admin) ──────────────────────────────────────
create table if not exists public.audit_log (
  id bigserial primary key,
  actor uuid references public.profiles(id),
  action text not null,
  target text,
  detail jsonb,
  at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy "audit: admin read" on public.audit_log for select using (public.is_admin());
