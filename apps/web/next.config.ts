import type { NextConfig } from "next";

const isTauriBuild =
  !!process.env.TAURI_ENV_PLATFORM && process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  ...(isTauriBuild
    ? { output: "export" as const, images: { unoptimized: true } }
    : {}),
};

export default nextConfig;
