import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import { BriefForm } from "../brief-form";

export const dynamic = "force-dynamic";

export default async function NewBriefPage() {
  const supabase = await createClient();
  const orgId = await requireActiveOrg(supabase);

  // Drives the upfront-cost panel + warning on paid briefs. Read with
  // the standard client because RLS already lets org members see
  // their own org row.
  const { data: org } = await supabase
    .from("organizations")
    .select("default_payment_method_id")
    .eq("id", orgId)
    .single();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Create Brief</h1>
      <BriefForm hasPaymentMethod={Boolean(org?.default_payment_method_id)} />
    </div>
  );
}
