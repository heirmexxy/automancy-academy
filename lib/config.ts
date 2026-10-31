/** Central configuration. Every PLACEHOLDER here is listed in README.md → "Placeholders to replace". */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://automancy.cc").replace(/\/$/, ""); 
export const SITE_NAME = "Automancy Academy";
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@automancy.cc"; // PLACEHOLDER
export const COMPANY = {
  // The legal entity that sells the course (shown in the legal pages and receipts). Confirmed Oct 2026.
  legalName: "Twellr Technology Solutions",
  address: "Sawmill Area, Iseyin-Saki Expressway, Iseyin, Oyo State, Nigeria",
  rcNumber: "18061688"
};
export const FEATURES = {
  /** Live calls and the cohort plan stay hidden until a cohort is scheduled (Admin → Settings can override at runtime). */
  cohortDefault: false
};
export const hasSupabase = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR-PROJECT"));
export const hasPaystack = () => !!process.env.PAYSTACK_SECRET_KEY;
export const hasAnthropic = () => !!process.env.ANTHROPIC_API_KEY;
export const hasAzureSpeech = () => !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
export const adminEmails = () => (process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
