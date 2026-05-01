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
  };
}
