/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
