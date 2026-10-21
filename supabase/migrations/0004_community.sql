-- Automancy Academy · 0004 community: posts, comments, claps, reports, weekly challenges, votes,
-- leaderboard, Hire talent profiles and intro requests. Run after 0001 (0003 is optional: certificates
-- are looked up defensively, so this file runs even if 0003 hasn't been applied yet).

-- ── Helpers ─────────────────────────────────────────────────────────────────
-- Non-revoked certificate? Uses dynamic SQL so it works before writer C's 0003 creates `certificates`.
create or replace function public.has_certificate(uid uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare ok boolean := false;
begin
  if uid is null or to_regclass('public.certificates') is null then return false; end if;
  execute 'select exists (select 1 from public.certificates where user_id = $1 and coalesce(revoked, false) = false)' into ok using uid;
  return coalesce(ok, false);
end $$;

-- The caller's own current certificate (id + name), or nothing.
create or replace function public.my_certificate() returns table (id text, name_on_certificate text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or to_regclass('public.certificates') is null then return; end if;
  return query execute
    'select c.id::text, c.name_on_certificate::text from public.certificates c
      where c.user_id = $1 and coalesce(c.revoked, false) = false order by c.issued_at desc limit 1'
    using auth.uid();
end $$;

-- Paid course access (self / cohort / team, active, not expired). Free learners can still post in #general and Base Camp.
create or replace function public.has_course_access(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments e
    where e.user_id = uid and e.status = 'active' and e.product in ('self','cohort','team')
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

-- ── Weekly challenges ───────────────────────────────────────────────────────
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 140),
  brief text not null check (char_length(brief) <= 8000),
  prize text check (char_length(prize) <= 400),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','open','judging','closed')),
  winner_post_id uuid,                       -- FK added after posts exists
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists challenges_status_idx on public.challenges(status, ends_at);

-- ── Posts ───────────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('journal','help','win','challenge_entry','announcement')),
  room text not null default 'general' check (room in ('general','0','1','2','3','4','5','6')),
  item_id text check (item_id is null or item_id ~ '^B?[0-9](\.[0-9]{1,2})?$'),
  title text check (char_length(title) <= 140),
  body text not null check (char_length(body) between 1 and 4000),
  parts jsonb,                                -- journal: {review, reflect, recommend, saved}
  link text check (link is null or (link ~ '^https://' and char_length(link) <= 500)),
  challenge_id uuid references public.challenges(id) on delete set null,
  hidden boolean not null default false,
  hidden_reason text,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists posts_feed_idx on public.posts(hidden, created_at desc);
create index if not exists posts_room_idx on public.posts(room, created_at desc);
create index if not exists posts_user_idx on public.posts(user_id, created_at desc);
create index if not exists posts_challenge_idx on public.posts(challenge_id) where challenge_id is not null;
-- One entry per learner per challenge
create unique index if not exists posts_one_entry on public.posts(challenge_id, user_id) where type = 'challenge_entry';

do $$ begin
  alter table public.challenges add constraint challenges_winner_fk foreign key (winner_post_id) references public.posts(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Rate limit, room access, challenge window, moderation fields (enforced in the database too, not only in the app)
create or replace function public.posts_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare c record; n int;
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then return new; end if;
  new.hidden := false; new.hidden_reason := null; new.pinned := false; new.created_at := now();
  if new.type = 'announcement' then raise exception 'Only the team can post announcements'; end if;
  select count(*) into n from public.posts where user_id = new.user_id and created_at > now() - interval '24 hours';
  if n >= 20 then raise exception 'RATE_LIMIT: You have posted 20 times in the last 24 hours. Try again tomorrow.'; end if;
  if new.room not in ('general','0') and not public.has_course_access(new.user_id) then
    raise exception 'COURSE_ONLY: Track rooms beyond Base Camp are for enrolled learners.';
  end if;
  if new.type = 'challenge_entry' then
    select * into c from public.challenges where id = new.challenge_id;
    if not found or c.status <> 'open' or now() < c.starts_at or now() > c.ends_at then
      raise exception 'CHALLENGE_CLOSED: This challenge is not accepting entries.';
    end if;
  else
    new.challenge_id := null;
  end if;
  return new;
end $$;
drop trigger if exists posts_before_insert on public.posts;
create trigger posts_before_insert before insert on public.posts for each row execute function public.posts_before_insert();

-- Authors can't change moderation fields or move a post (they may delete it).
create or replace function public.posts_protect() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then return new; end if;
  -- the auto-hide trigger on reports may flip hidden/hidden_reason and nothing else
  if current_setting('app.auto_hide', true) = 'on'
     and (new.id, new.user_id, new.type, new.room, new.body, new.pinned) is not distinct from (old.id, old.user_id, old.type, old.room, old.body, old.pinned) then
    return new;
  end if;
  raise exception 'Posts cannot be edited';
end $$;
drop trigger if exists posts_protect on public.posts;
create trigger posts_protect before update on public.posts for each row execute function public.posts_protect();

alter table public.posts enable row level security;
drop policy if exists "posts: read" on public.posts;
create policy "posts: read" on public.posts for select to authenticated
  using (hidden = false or user_id = auth.uid() or public.is_staff());
drop policy if exists "posts: insert own" on public.posts;
create policy "posts: insert own" on public.posts for insert to authenticated
  with check (user_id = auth.uid() and (type <> 'announcement' or public.is_admin()));
drop policy if exists "posts: delete own" on public.posts;
create policy "posts: delete own" on public.posts for delete to authenticated using (user_id = auth.uid());
drop policy if exists "posts: admin all" on public.posts;
create policy "posts: admin all" on public.posts for all using (public.is_admin()) with check (public.is_admin());

-- ── Comments ────────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments(post_id, created_at);

create or replace function public.comments_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then return new; end if;
  new.hidden := false; new.created_at := now();
  select count(*) into n from public.comments where user_id = new.user_id and created_at > now() - interval '24 hours';
  if n >= 60 then raise exception 'RATE_LIMIT: You have commented 60 times in the last 24 hours. Try again tomorrow.'; end if;
  if not exists (select 1 from public.posts where id = new.post_id and hidden = false) then raise exception 'Post not found'; end if;
  return new;
end $$;
drop trigger if exists comments_before_insert on public.comments;
create trigger comments_before_insert before insert on public.comments for each row execute function public.comments_before_insert();

alter table public.comments enable row level security;
drop policy if exists "comments: read" on public.comments;
create policy "comments: read" on public.comments for select to authenticated
  using ((hidden = false and exists (select 1 from public.posts p where p.id = post_id and p.hidden = false)) or user_id = auth.uid() or public.is_staff());
drop policy if exists "comments: insert own" on public.comments;
create policy "comments: insert own" on public.comments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "comments: delete own" on public.comments;
create policy "comments: delete own" on public.comments for delete to authenticated using (user_id = auth.uid());
drop policy if exists "comments: admin all" on public.comments;
create policy "comments: admin all" on public.comments for all using (public.is_admin()) with check (public.is_admin());

-- ── Claps (one per learner per post) ────────────────────────────────────────
create table if not exists public.claps (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.claps enable row level security;
drop policy if exists "claps: read" on public.claps;
create policy "claps: read" on public.claps for select to authenticated using (true);
drop policy if exists "claps: insert own" on public.claps;
create policy "claps: insert own" on public.claps for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id and p.hidden = false));
drop policy if exists "claps: delete own" on public.claps;
create policy "claps: delete own" on public.claps for delete to authenticated using (user_id = auth.uid());

-- ── Reports (a post or a comment) ───────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 600),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null))
);
create unique index if not exists reports_once_post on public.reports(reporter_id, post_id) where post_id is not null;
create unique index if not exists reports_once_comment on public.reports(reporter_id, comment_id) where comment_id is not null;
create index if not exists reports_status_idx on public.reports(status, created_at desc);

-- Three separate open reports hide the content until a moderator looks at it.
create or replace function public.reports_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform set_config('app.auto_hide', 'on', true);
  if new.post_id is not null then
    select count(*) into n from public.reports where post_id = new.post_id and status = 'open';
    if n >= 3 then update public.posts set hidden = true, hidden_reason = 'Auto-hidden after 3 reports' where id = new.post_id and hidden = false; end if;
  else
    select count(*) into n from public.reports where comment_id = new.comment_id and status = 'open';
    if n >= 3 then update public.comments set hidden = true where id = new.comment_id; end if;
  end if;
  perform set_config('app.auto_hide', 'off', true);
  return new;
end $$;
drop trigger if exists reports_after_insert on public.reports;
create trigger reports_after_insert after insert on public.reports for each row execute function public.reports_after_insert();

alter table public.reports enable row level security;
drop policy if exists "reports: read own" on public.reports;
create policy "reports: read own" on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_staff());
drop policy if exists "reports: insert own" on public.reports;
create policy "reports: insert own" on public.reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
drop policy if exists "reports: admin all" on public.reports;
create policy "reports: admin all" on public.reports for all using (public.is_admin()) with check (public.is_admin());

-- ── Challenge votes (one per learner per challenge) ─────────────────────────
create table if not exists public.votes (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index if not exists votes_post_idx on public.votes(post_id);

create or replace function public.votes_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record; c record;
begin
  select * into p from public.posts where id = new.post_id;
  if not found or p.type <> 'challenge_entry' or p.challenge_id is distinct from new.challenge_id or p.hidden then
    raise exception 'That entry is not part of this challenge';
  end if;
  if p.user_id = new.user_id then raise exception 'OWN_ENTRY: You cannot vote for your own entry.'; end if;
  select * into c from public.challenges where id = new.challenge_id;
  if c.status not in ('open','judging') then raise exception 'VOTING_CLOSED: Voting has closed for this challenge.'; end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists votes_before_insert on public.votes;
create trigger votes_before_insert before insert on public.votes for each row execute function public.votes_before_insert();

alter table public.votes enable row level security;
drop policy if exists "votes: read" on public.votes;
create policy "votes: read" on public.votes for select to authenticated using (true);
drop policy if exists "votes: insert own" on public.votes;
create policy "votes: insert own" on public.votes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "votes: admin all" on public.votes;
create policy "votes: admin all" on public.votes for all using (public.is_admin()) with check (public.is_admin());

alter table public.challenges enable row level security;
drop policy if exists "challenges: read published" on public.challenges;
create policy "challenges: read published" on public.challenges for select using (status <> 'draft' or public.is_admin());
drop policy if exists "challenges: admin all" on public.challenges;
create policy "challenges: admin all" on public.challenges for all using (public.is_admin()) with check (public.is_admin());

-- ── Display names for the community (signed-in members only) ────────────────
-- Public profile → first name and city; otherwise "A learner". Never emails.
-- (A view runs with its owner's rights, so it can read profiles without opening the profiles table.)
create or replace view public.community_members as
  select p.id,
         case when p.public_profile and nullif(trim(p.full_name), '') is not null
              then split_part(trim(p.full_name), ' ', 1) else 'A learner' end as name,
         case when p.public_profile then p.city end as city,
         (p.role in ('admin','reviewer')) as staff
  from public.profiles p;
revoke all on public.community_members from anon, public;
grant select on public.community_members to authenticated;

-- ── Leaderboard (public_profile users only; first name, city, XP; never emails) ─
-- "This week" counts week_xp only when the course saved it for the current week (week_start within 7 days).
create or replace view public.leaderboard as
  select split_part(trim(coalesce(nullif(trim(p.full_name), ''), 'Learner')), ' ', 1) as name,
         p.city,
         pr.xp,
         case when pr.week_start is not null and pr.week_start > (now() at time zone 'Africa/Lagos')::date - 7 then pr.week_xp else 0 end as week_xp,
         pr.items_done
  from public.progress pr
  join public.profiles p on p.id = pr.user_id
  where p.public_profile = true and pr.xp > 0;
grant select on public.leaderboard to anon, authenticated;

-- The caller's own standing (works even when their profile is private: only they can see it).
create or replace function public.leaderboard_me(scope text default 'all')
returns table (rank bigint, xp integer, items_done integer, is_public boolean, total bigint)
language plpgsql stable security definer set search_path = public as $$
declare my_xp int; my_items int; pub boolean; wk_cut date := (now() at time zone 'Africa/Lagos')::date - 7;
begin
  if auth.uid() is null then return; end if;
  select case when scope = 'week' then (case when pr.week_start is not null and pr.week_start > wk_cut then pr.week_xp else 0 end) else pr.xp end,
         pr.items_done, p.public_profile
    into my_xp, my_items, pub
    from public.profiles p left join public.progress pr on pr.user_id = p.id where p.id = auth.uid();
  my_xp := coalesce(my_xp, 0); my_items := coalesce(my_items, 0);
  return query
    select (select count(*) from public.leaderboard l where (case when scope = 'week' then l.week_xp else l.xp end) > my_xp) + 1,
           my_xp, my_items, coalesce(pub, false),
           (select count(*) from public.leaderboard l where (case when scope = 'week' then l.week_xp else l.xp end) > 0);
end $$;
revoke all on function public.leaderboard_me(text) from anon, public;
grant execute on function public.leaderboard_me(text) to authenticated;

-- ── Hire talent: graduate profiles ──────────────────────────────────────────
create table if not exists public.hire_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  cert_id text,
  headline text not null check (char_length(headline) between 3 and 120),
  bio text check (char_length(bio) <= 2000),
  skills text[] not null default '{}' check (cardinality(skills) <= 12),
  tools text[] not null default '{}' check (cardinality(tools) <= 12),
  portfolio_links text[] not null default '{}' check (cardinality(portfolio_links) <= 5),
  city text check (char_length(city) <= 60),
  availability text not null default 'contract' check (availability in ('full_time','contract','freelance','not_available')),
  rate_note text check (char_length(rate_note) <= 80),
  visible boolean not null default true,
  hidden_by_admin boolean not null default false,
  updated_at timestamptz not null default now()
);

create or replace function public.hire_profiles_protect() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then new.hidden_by_admin := false;
  else new.hidden_by_admin := old.hidden_by_admin; end if;
  if not public.has_certificate(new.user_id) then raise exception 'NO_CERTIFICATE: A Hire talent profile needs a certificate.'; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists hire_profiles_protect on public.hire_profiles;
create trigger hire_profiles_protect before insert or update on public.hire_profiles for each row execute function public.hire_profiles_protect();

alter table public.hire_profiles enable row level security;
drop policy if exists "hire: public read" on public.hire_profiles;
create policy "hire: public read" on public.hire_profiles for select
  using (visible and not hidden_by_admin and public.has_certificate(user_id));
drop policy if exists "hire: own" on public.hire_profiles;
create policy "hire: own" on public.hire_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "hire: admin all" on public.hire_profiles;
create policy "hire: admin all" on public.hire_profiles for all using (public.is_admin()) with check (public.is_admin());

-- ── Hire talent: intro requests from employers (stored by the server; admin-only to read) ─
create table if not exists public.hire_requests (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid references public.profiles(id) on delete set null,
  employer_name text not null check (char_length(employer_name) between 2 and 120),
  company text check (char_length(company) <= 120),
  email text not null check (char_length(email) <= 200),
  role text check (char_length(role) <= 160),
  message text check (char_length(message) <= 2000),
  status text not null default 'open' check (status in ('open','forwarded','closed')),
  ip_hash text,
  handled_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists hire_requests_status_idx on public.hire_requests(status, created_at desc);
alter table public.hire_requests enable row level security;
drop policy if exists "hire requests: admin all" on public.hire_requests;
create policy "hire requests: admin all" on public.hire_requests for all using (public.is_admin()) with check (public.is_admin());
