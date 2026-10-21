-- Automancy Academy · 0007 creator marketplace: creators, courses, curriculum, enrollments, progress, reviews, earnings
-- Run after 0001_core.sql and 0002_payments.sql (uses payments, payout_accounts, audit_log, is_admin()).
--
-- Who can do what (RLS + triggers):
--   * anyone: read live courses, their outline (view course_outline), free-preview lessons, approved creators' public
--     profile (view creator_public) and visible reviews;
--   * a creator: apply (status forced to 'applied'), edit their profile, create/edit/delete their own drafts, submit
--     for review, withdraw a submission. They can never set approved/live/rejected/unlisted, the review fields,
--     revenue_share or is_free (trigger guard_course / guard_creator);
--   * enrolled learners: read every lesson of their courses, read their own progress, write one review per course;
--   * admins: everything. Money rows (course_enrollments, creator_earnings, course_checkouts) and progress are
--     written by the server with the service role only.
-- Content choice for live courses: a creator may keep editing a LIVE course; edits are visible at once and the
-- course is flagged changes_pending = true, which puts it back in the admin review queue (status stays 'live').

-- ── Creators ──────────────────────────────────────────────────────────────────
create table if not exists public.creators (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  bio text check (char_length(bio) <= 2000),
  photo_url text check (photo_url is null or (photo_url ~ '^https://' and char_length(photo_url) <= 500)),
  website text check (website is null or (website ~ '^https?://' and char_length(website) <= 300)),
  application_note text check (char_length(application_note) <= 3000),   -- what they want to teach and why
  status text not null default 'applied' check (status in ('applied','approved','suspended')),
  revenue_share numeric(4,3) not null default 0.700 check (revenue_share >= 0 and revenue_share <= 1),
  agreed_terms_at timestamptz not null,
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists creators_status_idx on public.creators(status, created_at);

create or replace function public.is_approved_creator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.creators where user_id = auth.uid() and status = 'approved');
$$;

create or replace function public.guard_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.user_id := auth.uid(); new.status := 'applied'; new.revenue_share := 0.700;
    new.decided_at := null; new.decided_by := null; new.agreed_terms_at := coalesce(new.agreed_terms_at, now());
  else
    new.user_id := old.user_id; new.status := old.status; new.revenue_share := old.revenue_share;
    new.decided_at := old.decided_at; new.decided_by := old.decided_by; new.agreed_terms_at := old.agreed_terms_at;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists creators_guard on public.creators;
create trigger creators_guard before insert or update on public.creators for each row execute function public.guard_creator();

alter table public.creators enable row level security;
create policy "creators: read own" on public.creators for select using (user_id = auth.uid() or public.is_admin());
create policy "creators: apply" on public.creators for insert with check (user_id = auth.uid());
create policy "creators: update own" on public.creators for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "creators: admin all" on public.creators for all using (public.is_admin()) with check (public.is_admin());

-- Public creator card (no revenue share, status or application note)
create or replace view public.creator_public as
  select user_id, display_name, bio, photo_url, website from public.creators where status = 'approved';
grant select on public.creator_public to anon, authenticated;

-- ── Courses ───────────────────────────────────────────────────────────────────
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(user_id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  title text not null check (char_length(title) between 3 and 120),
  subtitle text check (char_length(subtitle) <= 200),
  description text check (char_length(description) <= 10000),
  category text check (char_length(category) <= 60),
  level text not null default 'beginner' check (level in ('beginner','intermediate','advanced')),
  language text not null default 'English' check (char_length(language) <= 40),
  cover_url text check (cover_url is null or (cover_url ~ '^https://' and char_length(cover_url) <= 500)),
  price_ngn integer not null default 0 check (price_ngn >= 0 and price_ngn <= 500000),
  price_usd numeric(8,2) check (price_usd is null or (price_usd >= 0 and price_usd <= 5000)),
  is_free boolean not null default false,                -- admin-only: a free course (otherwise min ₦2,000)
  status text not null default 'draft' check (status in ('draft','submitted','changes_requested','approved','live','unlisted','rejected')),
  changes_pending boolean not null default false,        -- live course edited since the last approval
  review_note text check (char_length(review_note) <= 4000),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- PLACEHOLDER price limits (₦2,000–₦500,000), also in app/(site)/courses/_lib/core.ts MARKET
  constraint courses_price_when_public check (status not in ('submitted','approved','live') or is_free or price_ngn between 2000 and 500000)
);
create index if not exists courses_status_idx on public.courses(status, published_at desc);
create index if not exists courses_creator_idx on public.courses(creator_id);

create or replace function public.is_course_owner(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses where id = cid and creator_id = auth.uid());
$$;
create or replace function public.course_is_live(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses where id = cid and status = 'live');
$$;
create or replace function public.course_editable(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses where id = cid and creator_id = auth.uid()
                 and status in ('draft','changes_requested','live','unlisted'))
     and public.is_approved_creator();
$$;

-- Creators can only move: draft/changes_requested/unlisted → submitted, submitted → draft (withdraw).
-- Review fields, is_free, creator_id and (once published) slug are admin-only. Editing a live course flags it.
create or replace function public.guard_course() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if not public.is_approved_creator() then raise exception 'Only approved creators can create courses'; end if;
    new.creator_id := auth.uid(); new.status := 'draft'; new.is_free := false; new.changes_pending := false;
    new.review_note := null; new.submitted_at := null; new.approved_at := null; new.approved_by := null; new.published_at := null;
    return new;
  end if;
  new.creator_id := old.creator_id; new.is_free := old.is_free; new.review_note := old.review_note;
  new.approved_at := old.approved_at; new.approved_by := old.approved_by; new.published_at := old.published_at;
  new.created_at := old.created_at;
  if old.published_at is not null then new.slug := old.slug; end if;
  if new.status is distinct from old.status then
    if not ((old.status in ('draft','changes_requested','unlisted') and new.status = 'submitted')
         or (old.status = 'submitted' and new.status = 'draft')) then
      raise exception 'Only an admin can change a course to %', new.status;
    end if;
  end if;
  if new.status = 'submitted' and old.status <> 'submitted' then new.submitted_at := now(); else new.submitted_at := old.submitted_at; end if;
  -- A creator can raise the "changes pending" flag but never clear it.
  new.changes_pending := old.changes_pending or (old.status = 'live' and new.changes_pending);
  return new;
end $$;
drop trigger if exists courses_guard on public.courses;
create trigger courses_guard before insert or update on public.courses for each row execute function public.guard_course();

alter table public.courses enable row level security;
create policy "courses: read live" on public.courses for select using (status = 'live');
create policy "courses: read own" on public.courses for select using (creator_id = auth.uid() or public.is_admin());
create policy "courses: creator insert" on public.courses for insert with check (creator_id = auth.uid() and public.is_approved_creator());
create policy "courses: creator update" on public.courses for update
  using (creator_id = auth.uid() and public.is_approved_creator() and status in ('draft','changes_requested','live','unlisted','submitted'))
  with check (creator_id = auth.uid());
create policy "courses: creator delete draft" on public.courses for delete using (creator_id = auth.uid() and status = 'draft');
create policy "courses: admin all" on public.courses for all using (public.is_admin()) with check (public.is_admin());

-- ── Curriculum ────────────────────────────────────────────────────────────────
create table if not exists public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null default 0,
  title text not null check (char_length(title) between 1 and 120)
);
create index if not exists course_sections_course_idx on public.course_sections(course_id, position);

create table if not exists public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.course_sections(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null default 0,
  title text not null check (char_length(title) between 1 and 160),
  kind text not null default 'text' check (kind in ('text','video','quiz','task')),
  body_md text not null default '' check (char_length(body_md) <= 50000),
  -- YouTube / Vimeo / Loom links only (the app re-validates and builds the privacy-friendly embed URL)
  video_url text check (video_url is null or (char_length(video_url) <= 500 and video_url ~* '^https://([a-z0-9-]+\.)?(youtube\.com|youtu\.be|vimeo\.com|loom\.com)/')),
  quiz jsonb not null default '[]'::jsonb check (jsonb_typeof(quiz) = 'array' and jsonb_array_length(quiz) <= 30),  -- [{q, options[], answer}]
  task text check (char_length(task) <= 5000),
  free_preview boolean not null default false,
  minutes integer not null default 5 check (minutes between 0 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists course_lessons_course_idx on public.course_lessons(course_id, section_id, position);

-- A lesson's course_id must match its section's course.
create or replace function public.lesson_course_match() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if not exists (select 1 from public.course_sections s where s.id = new.section_id and s.course_id = new.course_id) then
    raise exception 'Lesson section does not belong to this course';
  end if;
  return new;
end $$;
drop trigger if exists course_lessons_match on public.course_lessons;
create trigger course_lessons_match before insert or update on public.course_lessons for each row execute function public.lesson_course_match();

-- ── Enrollments, checkouts, progress, reviews ────────────────────────────────
create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid unique references public.payments(id) on delete set null,
  price_paid_kobo integer not null default 0 check (price_paid_kobo >= 0),   -- minor units of `currency`
  currency text not null default 'NGN' check (currency in ('NGN','USD')),
  source text not null default 'paystack' check (source in ('paystack','free','admin')),
  status text not null default 'active' check (status in ('active','refunded')),
  created_at timestamptz not null default now(),
  unique (course_id, user_id)
);
create index if not exists course_enrollments_user_idx on public.course_enrollments(user_id, status);

create or replace function public.is_enrolled(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.course_enrollments where course_id = cid and user_id = auth.uid() and status = 'active');
$$;

-- The price quoted at checkout (startCoursePurchase); handleCoursePayment checks the paid amount against it.
create table if not exists public.course_checkouts (
  reference text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  amount_kobo integer not null check (amount_kobo > 0),
  currency text not null check (currency in ('NGN','USD')),
  created_at timestamptz not null default now()
);

create table if not exists public.course_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  done boolean not null default false,
  quiz_score integer check (quiz_score between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists course_progress_course_idx on public.course_progress(user_id, course_id);

create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  hidden boolean not null default false,                 -- admin moderation
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);

-- ── Creator earnings (one per course payment; all amounts in naira kobo) ──
create table if not exists public.creator_earnings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(user_id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  gross_kobo integer not null check (gross_kobo >= 0),   -- naira-kobo equivalent of what the learner paid
  fees_kobo integer not null default 0 check (fees_kobo >= 0),   -- Paystack fee ESTIMATE
  share numeric(4,3) not null,
  amount_kobo integer not null check (amount_kobo >= 0), -- (gross − fees) × share
  status text not null default 'pending' check (status in ('pending','available','paid','reversed')),
  available_at timestamptz not null,                     -- end of the 14-day refund window
  paid_at timestamptz,
  payout_ref text check (char_length(payout_ref) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists creator_earnings_creator_idx on public.creator_earnings(creator_id, status);

-- ── RLS for curriculum and learner tables ────────────────────────────────────
alter table public.course_sections enable row level security;
create policy "sections: read" on public.course_sections for select
  using (public.course_is_live(course_id) or public.is_course_owner(course_id) or public.is_enrolled(course_id) or public.is_admin());
create policy "sections: creator write" on public.course_sections for all
  using (public.course_editable(course_id)) with check (public.course_editable(course_id));
create policy "sections: admin all" on public.course_sections for all using (public.is_admin()) with check (public.is_admin());

alter table public.course_lessons enable row level security;
create policy "lessons: free preview" on public.course_lessons for select using (free_preview and public.course_is_live(course_id));
create policy "lessons: enrolled or owner" on public.course_lessons for select
  using (public.is_enrolled(course_id) or public.is_course_owner(course_id) or public.is_admin());
create policy "lessons: creator write" on public.course_lessons for all
  using (public.course_editable(course_id)) with check (public.course_editable(course_id));
create policy "lessons: admin all" on public.course_lessons for all using (public.is_admin()) with check (public.is_admin());

-- Public outline of live courses: titles only, never lesson content.
create or replace view public.course_outline as
  select l.id, l.course_id, l.section_id, s.title as section_title, s.position as section_position,
         l.position, l.title, l.kind, l.minutes, l.free_preview
  from public.course_lessons l join public.course_sections s on s.id = l.section_id
  join public.courses c on c.id = l.course_id
  where c.status = 'live';
grant select on public.course_outline to anon, authenticated;

alter table public.course_enrollments enable row level security;
create policy "course enrollments: read own" on public.course_enrollments for select
  using (user_id = auth.uid() or public.is_course_owner(course_id) or public.is_admin());
create policy "course enrollments: admin write" on public.course_enrollments for all using (public.is_admin()) with check (public.is_admin());

alter table public.course_checkouts enable row level security;
create policy "course checkouts: admin" on public.course_checkouts for all using (public.is_admin()) with check (public.is_admin());

alter table public.course_progress enable row level security;
-- Progress and quiz scores are computed and written by the server only.
create policy "course progress: read own" on public.course_progress for select using (user_id = auth.uid() or public.is_admin());

alter table public.course_reviews enable row level security;
create policy "course reviews: read visible" on public.course_reviews for select
  using ((not hidden and public.course_is_live(course_id)) or user_id = auth.uid() or public.is_admin());
create policy "course reviews: enrolled write" on public.course_reviews for insert
  with check (user_id = auth.uid() and public.is_enrolled(course_id) and not hidden);
create policy "course reviews: edit own" on public.course_reviews for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and not hidden);
create policy "course reviews: admin all" on public.course_reviews for all using (public.is_admin()) with check (public.is_admin());

alter table public.creator_earnings enable row level security;
create policy "creator earnings: read own" on public.creator_earnings for select using (creator_id = auth.uid() or public.is_admin());
create policy "creator earnings: admin write" on public.creator_earnings for all using (public.is_admin()) with check (public.is_admin());

-- ── Refunds: when writer A's payments row becomes refunded, remove access and reverse the creator's earning ──
-- (A's applyRefund updates payments.status; this keeps the marketplace in step without A calling H.)
create or replace function public.course_payment_refunded() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.product like 'course:%' and new.status is distinct from old.status then
    if new.status = 'refunded' then
      update public.course_enrollments set status = 'refunded' where payment_id = new.id and status = 'active';
      update public.creator_earnings set status = 'reversed' where payment_id = new.id and status in ('pending','available');
      if exists (select 1 from public.creator_earnings where payment_id = new.id and status = 'paid') then
        insert into public.audit_log(actor, action, target, detail)
        values (null, 'creator_clawback_needed', new.id::text, jsonb_build_object('reason', 'refund after the creator was paid'));
      end if;
    elsif new.status = 'partially_refunded' then
      insert into public.audit_log(actor, action, target, detail)
      values (null, 'creator_partial_refund', new.id::text, jsonb_build_object('note', 'adjust the creator earning by hand (pro rata)'));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists payments_course_refund on public.payments;
create trigger payments_course_refund after update of status on public.payments for each row execute function public.course_payment_refunded();
