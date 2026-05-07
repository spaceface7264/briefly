import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
  },
  // Pin Turbopack's workspace root to this project. Without it,
  // Next walks up to find the nearest lockfile and can land on a
  // stray ~/package-lock.json from an unrelated sandbox project,
  // which then drives the file-watcher off the wrong directory.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

// Only run OpenNext dev helper in development
if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) => {
    initOpenNextCloudflareForDev();
  });
}

export default nextConfig;
