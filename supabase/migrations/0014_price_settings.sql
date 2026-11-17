-- 0014: prices and fees set in Admin → Settings → Prices and fees.
-- One row (id = 1) holding a JSON document; the app's code defaults apply to anything not set here.
-- Only the server (service role) reads or writes it; admins change it through the Settings page.

create table if not exists public.platform_prices (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.platform_prices enable row level security;
drop policy if exists "platform_prices: admin read" on public.platform_prices;
create policy "platform_prices: admin read" on public.platform_prices for select using (public.is_admin());

-- Creator settings the database enforces, read from the saved prices (falling back to the original defaults).
create or replace function public.market_setting(key text, fallback numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(data->'market'->>key, '')::numeric from public.platform_prices where id = 1), fallback);
$$;

-- New creators start on the default revenue share set in Admin (was fixed at 70%).
create or replace function public.guard_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid(); new.status := 'applied'; new.revenue_share := round(public.market_setting('revenueShare', 0.700), 3);
    new.decided_at := null; new.decided_by := null; new.agreed_terms_at := coalesce(new.agreed_terms_at, now());
  else
    new.user_id := old.user_id; new.status := old.status; new.revenue_share := old.revenue_share;
    new.decided_at := old.decided_at; new.decided_by := old.decided_by; new.agreed_terms_at := old.agreed_terms_at;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

-- Course price limits: the fixed ₦2,000–₦500,000 / $5,000 checks become the Admin-set limits.
alter table public.courses drop constraint if exists courses_price_ngn_check;
alter table public.courses drop constraint if exists courses_price_usd_check;
alter table public.courses drop constraint if exists courses_price_when_public;
alter table public.courses add constraint courses_price_ngn_check check (price_ngn >= 0 and price_ngn <= 100000000);
alter table public.courses add constraint courses_price_usd_check check (price_usd is null or (price_usd >= 0 and price_usd <= 1000000));

create or replace function public.check_course_price() returns trigger
language plpgsql set search_path = public as $$
declare lo numeric := public.market_setting('minPriceNgn', 2000); hi numeric := public.market_setting('maxPriceNgn', 500000);
begin
  if new.price_ngn > hi then
    raise exception 'Course price must be at most ₦%', hi using errcode = 'check_violation';
  end if;
  if new.status in ('submitted','approved','live') and not new.is_free and new.price_ngn < lo then
    raise exception 'Course price must be between ₦% and ₦%', lo, hi using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists courses_price_limits on public.courses;
create trigger courses_price_limits before insert or update of price_ngn, status, is_free on public.courses
  for each row execute function public.check_course_price();
