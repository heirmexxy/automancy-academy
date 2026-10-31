-- 0013 · One Automancy Academy certificate per learner, listing every course they completed (any owner)
-- certificate_courses is keyed by learner, so a re-issued certificate keeps the list.
-- course_key: 'automancy' for the flagship AI Automation course, or a creator course's uuid.

create table if not exists public.certificate_courses (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_key text not null check (char_length(course_key) between 3 and 64),
  title text not null check (char_length(title) between 1 and 160),
  provider text not null check (char_length(provider) between 1 and 120),   -- "Automancy Academy" or the creator's name
  completed_at timestamptz not null default now(),
  primary key (user_id, course_key)
);
alter table public.certificate_courses enable row level security;
drop policy if exists "certificate_courses: read own" on public.certificate_courses;
create policy "certificate_courses: read own" on public.certificate_courses for select using (user_id = auth.uid() or public.is_admin());
-- No write policies: the server records completions with the service role.

-- Public verification: the courses on a VALID certificate (title, provider, date only).
create or replace function public.verify_certificate_courses(cert_id text)
returns table (title text, provider text, completed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select cc.title, cc.provider, cc.completed_at
  from public.certificates c
  join public.certificate_courses cc on cc.user_id = c.user_id
  where c.id = upper(trim(cert_id)) and not c.revoked
  order by cc.completed_at;
$$;
revoke all on function public.verify_certificate_courses(text) from public;
grant execute on function public.verify_certificate_courses(text) to anon, authenticated, service_role;

-- Learners who already hold the flagship certificate get it listed.
insert into public.certificate_courses (user_id, course_key, title, provider, completed_at)
select c.user_id, 'automancy', 'AI Automation: Zapier, Make, n8n and AI agents', 'Automancy Academy', c.issued_at
from public.certificates c where not c.revoked
on conflict do nothing;
