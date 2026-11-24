import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is a single-page React app served from `/`; the server side
  // is one API route (`/api/actions`) plus the avatar route.
  // No image optimization config needed: logos are imported as static
  // assets and served from /public.
};

export default nextConfig;
