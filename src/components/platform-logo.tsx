"use client";

import Image from "next/image";

interface PlatformLogoProps {
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  textClassName?: string;
}

const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL;
const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME || "Briefly";

export function PlatformLogo({
  className = "h-6 w-auto",
  width = 180,
  height = 48,
  priority = false,
  textClassName,
}: PlatformLogoProps) {
  if (!logoUrl) {
    return (
      <span className={textClassName ?? "text-xl font-extrabold tracking-tight"}>
        {platformName}
      </span>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={platformName}
      width={width}
      height={height}
      className={className}
      priority={priority}
      unoptimized
    />
  );
}
