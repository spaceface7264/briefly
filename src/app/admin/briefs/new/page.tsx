import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import { resolveOrgPricing } from "@/lib/pricing";
import { BriefForm } from "../brief-form";

export const dynamic = "force-dynamic";

export default async function NewBriefPage() {
  const supabase = await createClient();
  const orgId = await requireActiveOrg(supabase);

  // Drives the upfront-cost panel + warning on paid briefs. Read with
  // the standard client because RLS already lets org members see
  // their own org row.
  const [{ data: org }, pricing] = await Promise.all([
    supabase
      .from("organizations")
      .select("default_payment_method_id")
      .eq("id", orgId)
      .single(),
    resolveOrgPricing(supabase, orgId),
  ]);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Create Brief</h1>
      <BriefForm
        hasPaymentMethod={Boolean(org?.default_payment_method_id)}
        feeBp={pricing.fee_bp}
      />
    </div>
  );
}
