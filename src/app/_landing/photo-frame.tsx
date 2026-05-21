/**
 * Small editorial photo frame for the marketing pages. Holds a single
 * stock image plus a credit caption, inside a styled container that
 * looks deliberate even if the image fails to load (the gradient
 * underneath stays put and reads as intentional).
 *
 * Pass a full image URL via `src`. Plain <img> on purpose: avoids a
 * next.config remotePatterns dance for a single decorative asset, and
 * keeps the page a server component.
 */
interface PhotoFrameProps {
  /** Full image URL (Unsplash, Pexels, local /public asset, etc.). */
  src: string;
  alt: string;
  /** Small mono caption rendered below the frame. */
  caption: string;
  /** Aspect ratio of the frame. Defaults to a portrait 4:5. */
  aspect?: "4/5" | "3/4" | "1/1" | "16/9";
  /** Optional credit shown bottom-right inside the frame. */
  credit?: string;
}

const ASPECT: Record<NonNullable<PhotoFrameProps["aspect"]>, string> = {
  "4/5": "aspect-[4/5]",
  "3/4": "aspect-[3/4]",
  "1/1": "aspect-square",
  "16/9": "aspect-video",
};

export function PhotoFrame({
  src,
  alt,
  caption,
  aspect = "4/5",
  credit,
}: PhotoFrameProps) {
  return (
    <figure className="relative">
      <div
        className={`
          relative overflow-hidden rounded-2xl border border-border-strong/70
          ${ASPECT[aspect]}
          bg-gradient-to-br from-brand/15 via-surface to-background
          shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55)]
        `}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
        {/* warm-paper grain so the photo sits inside the page, not on top */}
        <div
          aria-hidden="true"
          className="absolute inset-0 mix-blend-multiply opacity-40 bg-gradient-to-t from-background/55 via-transparent to-transparent"
        />
        {credit && (
          <span className="absolute bottom-3 right-3 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/80 bg-background/40 backdrop-blur-sm rounded-full px-2 py-0.5 border border-border/60">
            {credit}
          </span>
        )}
      </div>
      <figcaption className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted">
        {caption}
      </figcaption>
    </figure>
  );
}
