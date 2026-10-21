-- Automancy Academy · 0006 course: template feedback ("Report a problem with this template" in /learn)
-- Run after 0001_core.sql.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 8),          -- "3.4", "B2"
  kind text not null check (kind in ('import','step','instructions','other')),
  file text check (char_length(file) <= 200),                                   -- template file or name
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'open' check (status in ('open','fixed','wontfix')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id)
);
create index if not exists feedback_status_idx on public.feedback(status, created_at desc);
create index if not exists feedback_user_idx on public.feedback(user_id, created_at desc);

alter table public.feedback enable row level security;
drop policy if exists "feedback: read own" on public.feedback;
create policy "feedback: read own" on public.feedback for select using (user_id = auth.uid() or public.is_staff());
-- Learners can only file new, open reports for themselves.
drop policy if exists "feedback: insert own" on public.feedback;
create policy "feedback: insert own" on public.feedback for insert
  with check (user_id = auth.uid() and status = 'open' and closed_at is null and closed_by is null);
drop policy if exists "feedback: staff update" on public.feedback;
create policy "feedback: staff update" on public.feedback for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "feedback: admin delete" on public.feedback;
create policy "feedback: admin delete" on public.feedback for delete using (public.is_admin());
