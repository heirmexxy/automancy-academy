-- 0012 · Discount codes on creator courses
-- * A creator can opt a course in to Automancy's platform-wide promotions (courses.allow_discounts).
-- * A code can be: for Automancy's own products (platform), for every opted-in creator course (all_courses),
--   and/or for one course only (course_id). Codes stay unique across the whole platform.
-- * Creators can make their own codes for their own course (owner_id = creator); those always apply to that course.
-- The discount reduces the amount paid; the creator's 70% share is of what is actually paid.

alter table public.courses add column if not exists allow_discounts boolean not null default false;

alter table public.discount_codes add column if not exists platform boolean not null default true;
alter table public.discount_codes add column if not exists all_courses boolean not null default false;
alter table public.discount_codes add column if not exists course_id uuid references public.courses(id) on delete cascade;
alter table public.discount_codes add column if not exists owner_id uuid references public.profiles(id) on delete cascade;
create index if not exists discount_codes_course on public.discount_codes(course_id);
create index if not exists discount_codes_owner on public.discount_codes(owner_id);

-- A creator's own code must be for one of their courses and nothing else.
alter table public.discount_codes drop constraint if exists discount_codes_owner_scope;
alter table public.discount_codes add constraint discount_codes_owner_scope
  check (owner_id is null or (course_id is not null and platform = false and all_courses = false));
