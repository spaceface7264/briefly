import {
  readSocialHandles,
  socialDisplayHandle,
  socialLabel,
  socialProfileUrl,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/lib/socials";

const SHORT_LABEL: Record<SocialPlatform, string> = {
  instagram: "IG",
  tiktok: "TT",
  youtube: "YT",
  x: "X",
  threads: "TH",
  pinterest: "PIN",
  twitch: "TW",
  linkedin: "LI",
  substack: "SUB",
  website: "Web",
};

interface SocialLinksProps {
  socialHandles: unknown;
  /** "compact" renders short-code chips (best for table cells).
   *  "stacked" renders one full row per platform. */
  variant?: "compact" | "stacked";
  className?: string;
}

/**
 * Renders a creator's social handles. Returns null when the value is
 * empty or unparseable, so callers don't need to guard.
 */
export function SocialLinks({
  socialHandles,
  variant = "compact",
  className = "",
}: SocialLinksProps) {
  const handles = readSocialHandles(socialHandles);
  const present = SOCIAL_PLATFORMS.filter((p) => handles[p]);
  if (present.length === 0) return null;

  if (variant === "stacked") {
    return (
      <ul className={`space-y-0.5 ${className}`}>
        {present.map((platform) => {
          const stored = handles[platform]!;
          const url = socialProfileUrl(platform, stored);
          const display = socialDisplayHandle(platform, stored) ?? stored;
          return (
            <li key={platform} className="text-sm">
              <span className="text-muted mr-2">{socialLabel(platform)}</span>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-ink hover:underline"
                >
                  {display}
                </a>
              ) : (
                <span>{display}</span>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {present.map((platform) => {
        const url = socialProfileUrl(platform, handles[platform]);
        const display = socialDisplayHandle(platform, handles[platform]);
        const tooltip = display
          ? `${socialLabel(platform)} · ${display}`
          : socialLabel(platform);
        const short = SHORT_LABEL[platform];
        const base =
          "px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none border border-border text-muted";
        if (!url) {
          return (
            <span key={platform} title={tooltip} className={base}>
              {short}
            </span>
          );
        }
        return (
          <a
            key={platform}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={tooltip}
            className={`${base} hover:border-accent hover:text-accent-ink transition-colors`}
          >
            {short}
          </a>
        );
      })}
    </div>
  );
}
