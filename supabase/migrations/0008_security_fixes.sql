-- Automancy Academy · 0008 security fixes from the pre-launch review. Run after 0001–0007. Safe to run more than once.

-- ── Profiles: learners may edit their name, city and preferences, not their identity or attribution ──
-- (email feeds receipts, admin views and the self-referral check; referred_by is set by the server from the ref cookie)
create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    new.role := old.role;
  end if;
  if new.referral_code is distinct from old.referral_code and coalesce(auth.role(), '') <> 'service_role' then
    new.referral_code := old.referral_code;
  end if;
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    new.id := old.id; new.email := old.email; new.referred_by := old.referred_by; new.created_at := old.created_at;
  end if;
  return new;
end $$;

-- ── Progress: read-only for learners. PUT /api/progress validates and caps XP, then writes with the service role. ──
-- (With the old "for all" policy a learner could write any xp / week_xp straight to the table and top the leaderboard.)
drop policy if exists "progress: own" on public.progress;
drop policy if exists "progress: read own" on public.progress;
create policy "progress: read own" on public.progress for select using (user_id = auth.uid());

-- ── Course reviews: an author can't un-hide a review a moderator hid, or keep reviewing after a refund ──
drop policy if exists "course reviews: edit own" on public.course_reviews;
create policy "course reviews: edit own" on public.course_reviews for update
  using (user_id = auth.uid() and not hidden)
  with check (user_id = auth.uid() and not hidden and public.is_enrolled(course_id));

-- ── Lesson audio: the bucket stays public (files are served by their unguessable public URL), but nobody may LIST it. ──
-- A select policy on storage.objects lets anyone enumerate lessons/*.mp3, including paid lessons' narration.
drop policy if exists "tts: public read" on storage.objects;

-- ── Payouts: at most one open request per learner (backs up the claim logic in requestPayout) ──
create unique index if not exists payouts_one_open on public.payouts(user_id) where status = 'requested';

-- ── Hire talent: the certificate on a profile is always the learner's own live certificate ──
create or replace function public.hire_profiles_protect() returns trigger
language plpgsql security definer set search_path = public as $$
declare cid text;
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then new.hidden_by_admin := false;
  else new.user_id := old.user_id; new.hidden_by_admin := old.hidden_by_admin; end if;
  if not public.has_certificate(new.user_id) then raise exception 'NO_CERTIFICATE: A Hire talent profile needs a certificate.'; end if;
  execute 'select c.id::text from public.certificates c where c.user_id = $1 and coalesce(c.revoked, false) = false order by c.issued_at desc limit 1'
    into cid using new.user_id;
  new.cert_id := cid;
  new.updated_at := now();
  return new;
end $$;
