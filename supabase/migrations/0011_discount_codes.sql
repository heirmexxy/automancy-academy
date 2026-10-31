-- 0011 · Discount codes (Admin → Settings → Discount codes)
-- An admin creates a code with a percentage off; a signed-in buyer types it at checkout.
-- Codes and redemptions are read and written only by the server (service role); learners never query them.

create table if not exists public.discount_codes (
  code text primary key check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),     -- stored upper-case
  percent integer not null check (percent between 1 and 90),             -- capped at 90%: Paystack can't charge ₦0
  active boolean not null default true,
  products text[],                                                       -- null = every paid product; else e.g. {self,cohort}
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),             -- total successful payments allowed
  once_per_user boolean not null default true,
  note text check (char_length(note) <= 300),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.discount_codes enable row level security;
drop policy if exists "discount_codes: admin all" on public.discount_codes;
create policy "discount_codes: admin all" on public.discount_codes for all using (public.is_admin()) with check (public.is_admin());

-- One row per successful payment that used a code (Pay in 3 counts once, on the first instalment).
create table if not exists public.discount_redemptions (
  id bigserial primary key,
  code text not null references public.discount_codes(code) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  payment_reference text not null unique,
  product text not null,
  discount_kobo integer not null default 0,
  currency text not null default 'NGN',
  created_at timestamptz not null default now()
);
create index if not exists discount_redemptions_code on public.discount_redemptions(code);
create index if not exists discount_redemptions_user on public.discount_redemptions(user_id, code);
alter table public.discount_redemptions enable row level security;
drop policy if exists "discount_redemptions: admin read" on public.discount_redemptions;
create policy "discount_redemptions: admin read" on public.discount_redemptions for select using (public.is_admin());

-- Which code a payment used (kept on every instalment of a Pay-in-3 plan).
alter table public.payments add column if not exists discount_code text;
