import { SUPPORT_EMAIL } from "@/lib/config";

/** Shared details for the legal pages. Every PLACEHOLDER is listed in docs/placeholders/site.md. */
export const LEGAL_UPDATED = "21 October 2026";
/** PLACEHOLDER: a dedicated privacy mailbox (falls back to support). */
export const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || SUPPORT_EMAIL;
/** PLACEHOLDER: name of the Data Protection Officer (NDPA 2023 s.32, if the company is a data controller of major importance). */
export const DPO_NAME = "PLACEHOLDER: Data Protection Officer's name";
/** PLACEHOLDER: courts with jurisdiction (confirm with counsel). */
export const COURTS = "the courts of Lagos State, Nigeria";
/** Where Supabase stores the database. PLACEHOLDER: confirm the project's region. */
export const DB_REGION = "PLACEHOLDER: Supabase project region (e.g. EU (Frankfurt))";
/** How long we keep financial records (Nigerian tax and company law). */
export const FINANCE_RETENTION_YEARS = 6;
/** How long after a deletion request until the account is deleted. */
export const DELETION_DAYS = 30;
