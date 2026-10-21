-- Automancy Academy · 0009 WhatsApp learning: linked numbers, one-time link codes, chat sessions, message log.
-- Run after 0001–0008. Safe to run more than once.
-- Learners can read their own link (account page); everything else is written and read by the server (service role)
-- or by admins.

-- ── Linked numbers (one per learner, one learner per number) ──
create table if not exists public.wa_links (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  linked_at timestamptz not null default now(),
  opted_in boolean not null default true,        -- false after STOP; START opts back in
  reminders boolean not null default true,       -- REMINDERS OFF / account toggle
  stopped_at timestamptz
);
alter table public.wa_links enable row level security;
drop policy if exists "wa_links: read own" on public.wa_links;
create policy "wa_links: read own" on public.wa_links for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "wa_links: admin write" on public.wa_links;
create policy "wa_links: admin write" on public.wa_links for all using (public.is_admin()) with check (public.is_admin());

-- ── One-time link codes (6 digits, 15 minutes) ──
create table if not exists public.wa_link_codes (
  code text not null check (code ~ '^[0-9]{6}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used boolean not null default false,
  used_at timestamptz,
  used_by_phone text
);
-- An unused code is unique while it is live (old, used codes may repeat).
create unique index if not exists wa_link_codes_live on public.wa_link_codes(code) where not used;
create index if not exists wa_link_codes_user on public.wa_link_codes(user_id, created_at desc);
alter table public.wa_link_codes enable row level security;
drop policy if exists "wa_link_codes: admin read" on public.wa_link_codes;
create policy "wa_link_codes: admin read" on public.wa_link_codes for select using (public.is_admin());

-- ── Chat sessions (where each number is in the course) ──
create table if not exists public.wa_sessions (
  phone text primary key check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  user_id uuid references public.profiles(id) on delete set null,
  item_id text check (item_id is null or char_length(item_id) between 1 and 8),
  card_index int not null default 0 check (card_index >= 0),
  awaiting text not null default 'none' check (awaiting in ('none','next','quiz','reveal','task')),
  paused boolean not null default false,
  evidence jsonb not null default '[]'::jsonb,   -- media ids sent during a task, attached to the next submission
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_reminder_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists wa_sessions_user on public.wa_sessions(user_id);
create index if not exists wa_sessions_inbound on public.wa_sessions(last_inbound_at desc);
alter table public.wa_sessions enable row level security;
drop policy if exists "wa_sessions: admin read" on public.wa_sessions;
create policy "wa_sessions: admin read" on public.wa_sessions for select using (public.is_admin());

-- ── Message log (inbound and outbound; never full bodies or secrets) ──
create table if not exists public.wa_messages (
  id bigserial primary key,
  direction text not null check (direction in ('in','out')),
  phone text not null,
  user_id uuid references public.profiles(id) on delete set null,
  wa_message_id text unique,                     -- Meta's wamid: inbound idempotency, outbound status callbacks
  kind text not null default 'text' check (char_length(kind) <= 60),
  body_excerpt text check (char_length(body_excerpt) <= 300),
  media_id text,                                 -- inbound image/document kept as evidence (not downloaded)
  item_id text,
  status text check (status is null or status in ('received','sent','delivered','read','failed')),
  error text check (char_length(error) <= 600),
  cost_category text,                            -- 'service' (free-form reply), 'utility' (template), or Meta's pricing.category
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists wa_messages_created on public.wa_messages(created_at desc);
create index if not exists wa_messages_phone on public.wa_messages(phone, created_at desc);
create index if not exists wa_messages_failed on public.wa_messages(created_at desc) where status = 'failed';
alter table public.wa_messages enable row level security;
drop policy if exists "wa_messages: admin read" on public.wa_messages;
create policy "wa_messages: admin read" on public.wa_messages for select using (public.is_admin());

-- ── Optional cache of uploaded media ids (Meta media ids last about 30 days) ──
create table if not exists public.wa_media_ids (
  media_key text primary key,                    -- "walk:3.4", "clip:3.4:2" (data/whatsapp-media.json keys)
  url text not null,
  media_id text not null,
  uploaded_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '29 days')
);
alter table public.wa_media_ids enable row level security;
drop policy if exists "wa_media_ids: admin read" on public.wa_media_ids;
create policy "wa_media_ids: admin read" on public.wa_media_ids for select using (public.is_admin());
