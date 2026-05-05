import { cn } from "@/lib/utils";

/**
 * Avatar tile sizes available across admin + creator surfaces.
 * Picked from the shapes that already exist in the codebase:
 *
 *   - `sm` (28px): compact lists, table rows, claim approval cards
 *   - `md` (40px): default; user menu, submission review header
 *   - `lg` (64px): creator detail page header, brand kit details
 *   - `xl` (96px): /profile/settings editor (matches AvatarTile)
 *
 * Add a new entry here rather than overriding via `className` so we
 * keep the visual rhythm consistent — the cap exists so the
 * initial-letter fallback stays legible.
 */
export type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  /**
   * Public URL into the `avatars` storage bucket. When falsy, the
   * component renders an initial-letter fallback derived from
   * `name` (preferred) or `email`.
   */
  url?: string | null;
  /**
   * Display name; first character drives the fallback initial.
   * Trumps `email` when both are present.
   */
  name?: string | null;
  /** Used for the fallback initial when `name` is missing. */
  email?: string | null;
  /**
   * Optional accessible label. Defaults to the resolved display
   * name (name → email → "User"). Pass an empty string for purely
   * decorative tiles that sit next to a visible name elsewhere in
   * the row, so screen readers don't read the name twice.
   */
  alt?: string;
  size?: AvatarSize;
  className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
  xl: "h-24 w-24 text-3xl",
};

/**
 * Reusable circular avatar that prefers a stored image and falls
 * back to a single-character initial. Intentionally renders as a
 * plain <img> rather than next/image so we don't have to maintain
 * a `remotePatterns` allow-list per Supabase project URL — same
 * reasoning as the org-logo and brand-kit asset surfaces.
 */
export function Avatar({
  url,
  name,
  email,
  alt,
  size = "md",
  className,
}: AvatarProps) {
  const trimmedName = name?.trim() ?? "";
  const trimmedEmail = email?.trim() ?? "";
  const source = trimmedName || trimmedEmail;
  const initial = source.charAt(0).toUpperCase() || "?";
  const accessibleAlt = alt ?? trimmedName ?? trimmedEmail ?? "User";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border border-border bg-surface flex items-center justify-center font-semibold text-muted select-none",
        SIZE_CLASSES[size],
        className
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={accessibleAlt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </div>
  );
}
