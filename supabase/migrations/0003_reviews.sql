-- Automancy Academy · 0003 reviews: mission/boss submissions (AI-reviewed), certificates, review rate limits
-- Run after 0001_core.sql.

-- ── Submissions ─────────────────────────────────────────────────────────────
-- One row per "Submit for review". The AI reviewer fills status/score/ai_result; a person only looks at
-- rows with needs_human = true (or overrides from Admin → AI reviews).
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null,                                   -- "1.3", "B2", "6.4"
  tier text not null check (tier in ('b','s','g','boss','capstone')),
  content text not null check (char_length(content) between 1 and 20000),   -- secrets redacted before storing
  links text[] not null default '{}' check (coalesce(array_length(links, 1), 0) <= 10),
  status text not null default 'pending' check (status in ('pending','accepted','revise','rejected')),
  score integer check (score between 0 and 100),
  ai_result jsonb,
  needs_human boolean not null default false,
  reviewer_note text,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists submissions_user_item_idx on public.submissions(user_id, item_id, tier, created_at desc);
create index if not exists submissions_queue_idx on public.submissions(needs_human desc, created_at desc);
create index if not exists submissions_status_idx on public.submissions(status);

alter table public.submissions enable row level security;
drop policy if exists "submissions: read own" on public.submissions;
create policy "submissions: read own" on public.submissions for select
  using (user_id = auth.uid() or public.is_staff());
-- Learners may only create a fresh, unmarked submission for themselves. Marks are written by the server
-- (service role, after the AI call) or by staff; learners have no update or delete policy.
drop policy if exists "submissions: insert own" on public.submissions;
create policy "submissions: insert own" on public.submissions for insert
  with check (
    user_id = auth.uid() and status = 'pending' and score is null and ai_result is null
    and needs_human = false and reviewer_note is null and reviewed_by is null and reviewed_at is null
  );
drop policy if exists "submissions: staff update" on public.submissions;
create policy "submissions: staff update" on public.submissions for update
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists "submissions: admin delete" on public.submissions;
create policy "submissions: admin delete" on public.submissions for delete using (public.is_admin());

-- ── Certificates ────────────────────────────────────────────────────────────
-- Issued only by the server (lib/certificate.ts) after it checks eligibility. IDs look like AA-2026-7K3QX9.
create table if not exists public.certificates (
  id text primary key check (id ~ '^AA-[0-9]{4}-[0-9A-Z]{6}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name_on_certificate text not null check (char_length(name_on_certificate) between 1 and 120),
  issued_at timestamptz not null default now(),
  revoked boolean not null default false,
  revoked_reason text
);
create index if not exists certificates_user_idx on public.certificates(user_id);
-- At most one live certificate per learner (re-issuing revokes the old one first).
create unique index if not exists certificates_one_live_idx on public.certificates(user_id) where not revoked;

alter table public.certificates enable row level security;
drop policy if exists "certificates: read own" on public.certificates;
create policy "certificates: read own" on public.certificates for select
  using (user_id = auth.uid() or public.is_staff());
drop policy if exists "certificates: admin update" on public.certificates;
create policy "certificates: admin update" on public.certificates for update
  using (public.is_admin()) with check (public.is_admin());
-- No insert policy: only the service role (server, after the eligibility check) issues certificates.

-- Public verification: anyone can look up a certificate by ID and see the name, issue date and status,
-- never the user id or anything else about the learner.
create or replace function public.verify_certificate(cert_id text)
returns table (id text, name_on_certificate text, issued_at timestamptz, status text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name_on_certificate, c.issued_at, case when c.revoked then 'revoked' else 'valid' end
  from public.certificates c
  where c.id = upper(trim(cert_id))
  limit 1;
$$;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated, service_role;

-- ── Review usage (rate limits: reviews per learner per day) ─────────────────
create table if not exists public.review_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table public.review_usage enable row level security;
drop policy if exists "review_usage: read own" on public.review_usage;
create policy "review_usage: read own" on public.review_usage for select
  using (user_id = auth.uid() or public.is_staff());
-- No write policies: only take_review_quota (service role) changes counts.

-- Atomically use one review from today's allowance. Returns true if allowed, false if the limit is reached.
create or replace function public.take_review_quota(p_user uuid, p_day date, p_limit integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.review_usage as u (user_id, day, count) values (p_user, p_day, 1)
  on conflict (user_id, day) do update set count = u.count + 1 where u.count < p_limit
  returning u.count into n;
  return n is not null;
end $$;
revoke all on function public.take_review_quota(uuid, date, integer) from public, anon, authenticated;
grant execute on function public.take_review_quota(uuid, date, integer) to service_role;
