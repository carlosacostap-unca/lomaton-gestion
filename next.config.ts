import type { NextConfig } from "next";

const pocketBaseUrl =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "https://pb-lomaton.epixum.com";
const pocketBaseOrigin = new URL(pocketBaseUrl).origin;
const pocketBaseWebSocketOrigin = pocketBaseOrigin.replace(/^http/, "ws");
const scriptPolicy =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src blob:",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  scriptPolicy,
  `connect-src 'self' ${pocketBaseOrigin} ${pocketBaseWebSocketOrigin}`,
  process.env.NODE_ENV === "production" ? "upgrade-insecure-requests" : "",
].filter(Boolean).join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
