-- Automancy Academy · 0002 payments: payments, refunds, referral earnings, payouts, waitlist
-- Run after 0001_core.sql. Money tables are written only by the server (service role) or an admin;
-- learners can read their own rows.

-- ── Who referred whom (filled at checkout from the am_ref cookie; signup may fill it too) ──
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id) on delete set null;
create index if not exists profiles_referred_by_idx on public.profiles(referred_by);

-- ── Payments (one row per Paystack transaction, including each instalment) ──
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product text not null,
  reference text not null unique,                          -- our reference, sent to Paystack
  amount_kobo integer not null check (amount_kobo >= 0),   -- minor units: kobo for NGN, cents for USD
  currency text not null default 'NGN' check (currency in ('NGN','USD')),
  status text not null default 'initialized' check (status in ('initialized','success','failed','refunded','partially_refunded')),
  installment_no integer not null default 1 check (installment_no >= 1),
  installments_total integer not null default 1 check (installments_total >= 1),
  plan_ref text,                                           -- reference of instalment 1 (groups a "Pay in 3" plan)
  referral_code text,
  discount_kobo integer not null default 0 check (discount_kobo >= 0),
  paystack_id bigint,
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payments_user_idx on public.payments(user_id);
create index if not exists payments_status_idx on public.payments(status, paid_at);
create index if not exists payments_plan_idx on public.payments(plan_ref);
alter table public.payments enable row level security;
create policy "payments: read own" on public.payments for select using (user_id = auth.uid() or public.is_admin());
create policy "payments: admin write" on public.payments for all using (public.is_admin()) with check (public.is_admin());

-- enrollments.payment_id → payments (0001 created the column without a foreign key)
do $$ begin
  alter table public.enrollments add constraint enrollments_payment_fk foreign key (payment_id) references public.payments(id) on delete set null;
exception when duplicate_object then null; end $$;
create index if not exists enrollments_payment_idx on public.enrollments(payment_id);

-- ── Refund requests ──
create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  reason text not null check (char_length(reason) <= 2000),
  status text not null default 'open' check (status in ('open','approved','declined','refunded')),
  admin_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id)
);
create unique index if not exists refund_requests_one_open on public.refund_requests(payment_id) where status in ('open','approved');
create index if not exists refund_requests_status_idx on public.refund_requests(status, created_at);
alter table public.refund_requests enable row level security;
create policy "refunds: read own" on public.refund_requests for select using (user_id = auth.uid() or public.is_admin());
create policy "refunds: admin write" on public.refund_requests for all using (public.is_admin()) with check (public.is_admin());

-- ── Payouts (paid manually by admin for now) ──
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_kobo integer not null check (amount_kobo > 0),
  status text not null default 'requested' check (status in ('requested','paid','failed')),
  paystack_transfer_code text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists payouts_user_idx on public.payouts(user_id);
alter table public.payouts enable row level security;
create policy "payouts: read own" on public.payouts for select using (user_id = auth.uid() or public.is_admin());
create policy "payouts: admin write" on public.payouts for all using (public.is_admin()) with check (public.is_admin());

-- ── Referral earnings (one per referred payment) ──
create table if not exists public.referral_earnings (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  amount_kobo integer not null check (amount_kobo >= 0),   -- always naira kobo
  rate numeric(4,3) not null,
  tier text not null check (tier in ('friend','graduate','ambassador','pack')),
  status text not null default 'pending' check (status in ('pending','approved','paid','reversed')),
  available_at timestamptz not null,                       -- end of the refund window
  payout_id uuid references public.payouts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists referral_earnings_referrer_idx on public.referral_earnings(referrer_id, status);
alter table public.referral_earnings enable row level security;
create policy "earnings: read own" on public.referral_earnings for select using (referrer_id = auth.uid() or public.is_admin());
create policy "earnings: admin write" on public.referral_earnings for all using (public.is_admin()) with check (public.is_admin());

-- ── Payout accounts. NEVER store the full account number: last 4 digits + Paystack recipient code only. ──
create table if not exists public.payout_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bank_name text not null,
  bank_code text not null,
  account_last4 text not null check (account_last4 ~ '^[0-9]{4}$'),
  account_name text,
  paystack_recipient_code text,
  updated_at timestamptz not null default now()
);
alter table public.payout_accounts enable row level security;
create policy "payout accounts: read own" on public.payout_accounts for select using (user_id = auth.uid() or public.is_admin());
create policy "payout accounts: admin write" on public.payout_accounts for all using (public.is_admin()) with check (public.is_admin());

-- ── Waitlist (placeholder-mode checkout and coming-soon products) ──
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  product text not null,
  created_at timestamptz not null default now(),
  unique (email, product)
);
alter table public.waitlist enable row level security;
create policy "waitlist: admin read" on public.waitlist for select using (public.is_admin());
create policy "waitlist: admin write" on public.waitlist for all using (public.is_admin()) with check (public.is_admin());

-- Learners can read the audit trail? No: audit_log stays admin-only (0001). Admin pages insert with the service role.
