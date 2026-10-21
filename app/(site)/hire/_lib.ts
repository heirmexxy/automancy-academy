/** Shared Hire talent types (kept out of page files, which may only export Next.js page fields). */
export type HireProfile = {
  user_id: string; display_name: string; cert_id: string | null; headline: string; bio: string | null; skills: string[]; tools: string[];
  portfolio_links: string[]; city: string | null; availability: string; rate_note: string | null; updated_at: string;
};
export const HIRE_COLS = "user_id, display_name, cert_id, headline, bio, skills, tools, portfolio_links, city, availability, rate_note, updated_at";

