import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import { getBrandAssetSignedUrls } from "@/lib/storage/brand";
import { BrandKitForm } from "./brand-kit-form";
import type { BrandColor, BrandTypography } from "./types";

export const dynamic = "force-dynamic";

export default async function AdminBrandPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = await requireActiveOrg(supabase);

  const [{ data: kit }, { data: membership }] = await Promise.all([
    supabase
      .from("brand_kits")
      .select(
        "logo_mark_url, logo_dark_url, logo_light_url, colors, typography, guidelines_url, notes"
      )
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const isAdmin = membership?.role === "admin";

  const signed = await getBrandAssetSignedUrls({
    logo_mark_url: kit?.logo_mark_url ?? null,
    logo_dark_url: kit?.logo_dark_url ?? null,
    logo_light_url: kit?.logo_light_url ?? null,
    guidelines_url: kit?.guidelines_url ?? null,
  });

  // Distinguish a guidelines value that points into our bucket (a
  // signed URL was minted) from an external URL (we hand it through
  // unchanged). The form needs to know which mode to render in.
  const guidelinesIsExternal =
    Boolean(kit?.guidelines_url) &&
    signed.guidelines_url === kit?.guidelines_url;

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Brand</h1>
        <p className="text-muted">
          Logos, palette, typography, guidelines, and voice/tone notes
          shared with creators working on your briefs.
        </p>
      </div>

      <BrandKitForm
        canEdit={isAdmin}
        initial={{
          logos: {
            mark: signed.logo_mark_url,
            dark: signed.logo_dark_url,
            light: signed.logo_light_url,
          },
          colors: ((kit?.colors as BrandColor[] | null) ?? []) as BrandColor[],
          typography: ((kit?.typography as BrandTypography[] | null) ?? []) as BrandTypography[],
          guidelines: {
            url: signed.guidelines_url,
            isExternal: guidelinesIsExternal,
          },
          notes: kit?.notes ?? "",
        }}
      />
    </div>
  );
}
