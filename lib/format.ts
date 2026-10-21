export const ngn = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");
export const usd = (n: number) => "$" + (Math.round(n * 100) / 100).toLocaleString("en-US");
export const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
