-- 0015: Automancy's agents (Admin → Agents).
--   agent_runs       one row per run of an agent: what it checked and what it did.
--   agent_flags      things an agent wants a person to look at (fraud signals, borderline posts, payment problems…).
--   support_tickets  the public "Contact support" form; the Support agent answers or drafts replies.
-- Only the server (service role) writes these; admins read them through the Admin pages.

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (char_length(agent) <= 40),
  trigger text not null default 'schedule' check (trigger in ('schedule','admin','event')),
  status text not null default 'ok' check (status in ('ok','error','skipped')),
  summary text not null default '' check (char_length(summary) <= 2000),
  actions integer not null default 0,
  detail jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists agent_runs_agent_idx on public.agent_runs(agent, started_at desc);
alter table public.agent_runs enable row level security;
drop policy if exists "agent_runs: admin read" on public.agent_runs;
create policy "agent_runs: admin read" on public.agent_runs for select using (public.is_admin());

create table if not exists public.agent_flags (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (char_length(agent) <= 40),
  kind text not null check (char_length(kind) <= 60),
  target_type text check (char_length(target_type) <= 40),
  target_id text check (char_length(target_id) <= 80),
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  message text not null check (char_length(message) <= 1000),
  detail jsonb,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
-- One open flag per agent + kind + target (agents re-check daily without piling up duplicates).
create unique index if not exists agent_flags_open_uniq on public.agent_flags(agent, kind, coalesce(target_type,''), coalesce(target_id,'')) where status = 'open';
create index if not exists agent_flags_status_idx on public.agent_flags(status, created_at desc);
alter table public.agent_flags enable row level security;
drop policy if exists "agent_flags: admin read" on public.agent_flags;
create policy "agent_flags: admin read" on public.agent_flags for select using (public.is_admin());

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 200),
  topic text not null default 'other' check (char_length(topic) <= 40),
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'open' check (status in ('open','answered','waiting','closed')),
  draft text check (char_length(draft) <= 6000),            -- the Support agent's suggested reply
  draft_confidence numeric(3,2),
  reply text check (char_length(reply) <= 6000),             -- what was sent
  replied_by text check (char_length(replied_by) <= 40),     -- 'agent' or an admin's id
  replied_at timestamptz,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists support_tickets_status_idx on public.support_tickets(status, created_at desc);
alter table public.support_tickets enable row level security;
drop policy if exists "support_tickets: read own" on public.support_tickets;
create policy "support_tickets: read own" on public.support_tickets for select using (user_id = auth.uid() or public.is_admin());
