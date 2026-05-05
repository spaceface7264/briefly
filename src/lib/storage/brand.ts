import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandKit } from "@/types/database";

export const BRAND_BUCKET = "brand-assets";

/**
 * 1-hour signed URL TTL. Long enough for an admin to open the brand
 * page, edit, and re-render after a save without the previews going
 * stale; short enough that a leaked URL doesn't permanently expose a
 * private bucket asset. Mirrors the choice made for `submissions`
 * (15 min there because admins linger less on individual claims).
 */
export const BRAND_SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Subset of brand-kit fields that may carry storage paths. Mirrors the
 * `brand_kits` row but only the URL columns we mint signed URLs for.
 */
type SignableBrandKit = Pick<
  BrandKit,
  | "logo_mark_url"
  | "logo_dark_url"
  | "logo_light_url"
  | "guidelines_url"
>;

export type BrandKitSignedUrls = {
  logo_mark_url: string | null;
  logo_dark_url: string | null;
  logo_light_url: string | null;
  guidelines_url: string | null;
};

/**
 * Pull the storage object path out of a Supabase signed-or-public URL
 * for a known bucket. Returns null if the URL doesn't look like one we
 * issued (e.g. an external https://example.com link a user pasted into
 * the guidelines field). Handles both `/object/public/<bucket>/...`
 * and `/object/sign/<bucket>/...` shapes.
 */
export function extractBrandStoragePath(url: string): string | null {
  const publicMarker = `/storage/v1/object/public/${BRAND_BUCKET}/`;
  const signMarker = `/storage/v1/object/sign/${BRAND_BUCKET}/`;
  const publicIdx = url.indexOf(publicMarker);
  if (publicIdx !== -1) {
    return url.slice(publicIdx + publicMarker.length).split("?")[0];
  }
  const signIdx = url.indexOf(signMarker);
  if (signIdx !== -1) {
    return url.slice(signIdx + signMarker.length).split("?")[0];
  }
  return null;
}

/**
 * Storage path convention enforced by the server actions. Centralised
 * here so both upload and signed-URL minting stay in lockstep.
 */
export function brandLogoPath(
  orgId: string,
  slot: "mark" | "dark" | "light",
  ext: string
): string {
  return `${orgId}/logos/${slot}-${Date.now()}.${ext}`;
}

export function brandGuidelinesPath(orgId: string, ext: string): string {
  return `${orgId}/guidelines-${Date.now()}.${ext}`;
}

/**
 * Mints 1-hour signed URLs for every URL field on the kit that points
 * into the `brand-assets` bucket. External URLs (e.g. a guidelines
 * field set to a Notion link) are passed through unchanged.
 *
 * Caller responsibility: only invoke this after authorising the viewer
 * (org member, or claimed creator). The function itself does not
 * re-check; it holds the service-role client purely to bypass RLS on
 * `storage.objects` for the private bucket.
 */
export async function getBrandAssetSignedUrls(
  kit: SignableBrandKit
): Promise<BrandKitSignedUrls> {
  const admin = createAdminClient();

  async function sign(value: string | null): Promise<string | null> {
    if (!value) return null;
    const path = extractBrandStoragePath(value);
    if (!path) return value;
    const { data, error } = await admin.storage
      .from(BRAND_BUCKET)
      .createSignedUrl(path, BRAND_SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      return null;
    }
    return data.signedUrl;
  }

  const [logo_mark_url, logo_dark_url, logo_light_url, guidelines_url] =
    await Promise.all([
      sign(kit.logo_mark_url),
      sign(kit.logo_dark_url),
      sign(kit.logo_light_url),
      sign(kit.guidelines_url),
    ]);

  return {
    logo_mark_url,
    logo_dark_url,
    logo_light_url,
    guidelines_url,
  };
}
