import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is a single-page React app served from `/`; the server side
  // is one API route (`/api/actions`) plus the avatar route.
  // No image optimization config needed: logos are imported as static
  // assets and served from /public.
  experimental: {
    /* #11 — next/font/google fetches Readex Pro at build time; in
       this sandbox the fetch fails on TLS unless the system certs
       are used (same as NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1).
       Harmless on Vercel, where the fetch works either way. */
    turbopackUseSystemTlsCerts: true,
  },
};

export default nextConfig;
