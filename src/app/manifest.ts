import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME || "Briefly";

  return {
    name: platformName,
    short_name: platformName,
    description: `Content creator platform for ${platformName}`,
    start_url: "/",
    display: "standalone",
    background_color: "#0A0A0A",
    theme_color: "#C8FF00",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    // Long-press app icon (Android Chrome) surfaces these as quick
    // actions. Listed flat; the relevant ones for the viewer's
    // account type are the only reachable surfaces post-auth, so
    // showing both sets is harmless — the unreachable ones just
    // bounce through /login.
    shortcuts: [
      {
        name: "Browse briefs",
        short_name: "Briefs",
        url: "/briefs",
        description: "Find paid briefs to claim",
      },
      {
        name: "My briefs",
        short_name: "My briefs",
        url: "/my-briefs",
        description: "Track your active claims",
      },
      {
        name: "New brief",
        short_name: "New brief",
        url: "/admin/briefs/new",
        description: "Publish a new brief",
      },
      {
        name: "Claims inbox",
        short_name: "Claims",
        url: "/admin/claims",
        description: "Review submissions",
      },
    ],
  };
}
