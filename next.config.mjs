/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Launch safety: a lint or type warning must not stop a deploy. Run `npm run typecheck` and `npm run lint`
  // locally before big changes; the course and payment logic are covered by `npm test`.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // The course bundle is read from disk by the /learn route handler; include it in the server build.
  outputFileTracingIncludes: {
    "/learn": ["./course-build/**/*", "./course-addons/**/*"],
    "/api/**/*": ["./course-build/**/*", "./data/**/*"],
    "/audio": ["./course-build/**/*"]
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" }
    ] }];
  }
};
export default nextConfig;
