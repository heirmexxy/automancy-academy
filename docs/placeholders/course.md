# Course integration (writer B) · placeholders and notes

| File | What | Where to get the real value / what to do |
|---|---|---|
| `scripts/sync-course.mjs` (`COURSE_SRC`) | Location of the course source folder. Default `../course` next to the app root; override with `COURSE_SRC=/path/to/course`. | Point it at wherever the course repo lives, then run `npm run course:sync` and commit `course-build/`. |
| `lib/learn.ts` (`LEARN_LINKS`) | App routes the course links to: `/pricing`, `/community`, `/leaderboard`, `/hire`, `/earn`, `/careers`, `/account`, sign out `/auth/signout` (POST). | Change here if any route moves. |
| `lib/learn.ts` (`XP_MAX`, `WEEK_XP_MAX`) | Sanity caps on XP stored from the course (25,000 total, 6,000 a week). | Raise only if the course adds XP sources. |
| `next.config.mjs` (not owned by B) | `outputFileTracingIncludes` lists `./course-build/**/*` for `/learn`, but not `./course-addons/**/*`. | Add `"./course-addons/**/*"` to the `/learn` entry so add-ons are deployed with the route (Vercel and similar). |
| Course source `src/platform.js` | Prototype-only share/referral text in views cut from the app (dashboard referral box, Earn, Business) still uses `automancy.academy`. App mode uses `window.AUTOMANCY.siteUrl` for shares and certificates. | Replace `automancy.academy` with the final domain if the prototype file is ever shown publicly. |
| Course source `src/videos.js` (writer for videos) | Featured videos "to be watched and approved before launch". | Not B's file; listed so it isn't missed. |

## How app mode works

- `src/hub.html` marks prototype-only blocks with `<!--APP:CUT--> … <!--/APP:CUT-->` and app-only copy with `<!--APP:ONLY: … :APP:ONLY-->`; the script starts with `const APP_MODE = /*APP_MODE*/false;`. `build.py` (prototype) leaves them alone; `scripts/sync-course.mjs` removes the cut blocks, un-comments the app-only ones, sets `APP_MODE` to true and replaces the embedded `TPLS`/`SHEETS` with `window.__AUTOMANCY_DATA`.
- In app mode the course keeps only the Course and Dashboard views. Links to community, challenges, hire, pricing, business, earn, careers and certificate go to the Next.js routes in `window.AUTOMANCY.links` (certificate → `/account#certificate`).
- `/learn` (`app/learn/route.ts` + `lib/learn.ts`) inserts only the lesson templates the learner may open (Base Camp always, everything with `ent.course`), their templates and sheets, the boot script (`window.AUTOMANCY` incl. `reviews` and `settings`) and every `course-addons/*.js`. Locked lessons still appear in the course map and open a paywall card linking to `/pricing`.
- Progress loads from `window.AUTOMANCY.progress` and saves with a debounced `PUT /api/progress` (also on page hide). If the account has no progress yet and the browser holds prototype progress, it is moved once (flag `automancy-migrated-<userId>` in localStorage).
- Missions are not self-ticked in the app: a mission counts when `submissions` has an accepted row for it. The review add-on can update the page live with `window.dispatchEvent(new CustomEvent("automancy:review", {detail:{itemId, tier, status:"accepted"}}))`.
- `week_xp` is computed on the server: XP gained since Monday (Africa/Lagos) while `week_start` is this week, restarting when the week changes.
- Template problems: "Report a problem with this template" → `POST /api/feedback` → `feedback` table (migration `0006_course.sql`) → Admin → Feedback.
