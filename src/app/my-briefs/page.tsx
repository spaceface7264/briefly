import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MyBriefsClient } from "./my-briefs-client";
import type { Brief, Claim } from "@/types/database";

export type ClaimInvoice = {
  id: string;
  invoice_number: string | null;
};

export type ClaimWithBrief = Claim & {
  brief: Brief;
  invoice?: ClaimInvoice | null;
};

export default async function MyBriefsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch claims with brief info (no payments join — table may not exist yet)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: claims, error } = await (supabase
    .from("claims") as any)
    .select("*, brief:briefs(*)")
    .eq("user_id", user.id)
    .order("claimed_at", { ascending: false });

  if (error) {
    console.error("Error fetching claims:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }

  // Try to attach payment info if the payments table exists
  if (claims && claims.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: payments } = await (supabase.from("payments") as any)
      .select("id, claim_id, invoice_number, status")
      .in("claim_id", claims.map((c: any) => c.id));

    if (payments) {
      const paymentsByClaimId = new Map<string, any[]>();
      for (const p of payments) {
        const arr = paymentsByClaimId.get(p.claim_id) || [];
        arr.push(p);
        paymentsByClaimId.set(p.claim_id, arr);
      }
      for (const claim of claims) {
        claim.payments = paymentsByClaimId.get(claim.id) || [];
      }
    } else {
      for (const claim of claims) {
        claim.payments = [];
      }
    }
  }

  // Transform the data to match our expected type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const claimsWithBriefs: ClaimWithBrief[] = ((claims || []) as any[])
    .filter((claim) => claim.brief !== null)
    .map((claim) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const succeeded = (claim.payments || []).find((p: any) => p.status === "succeeded");
      return {
        ...claim,
        brief: claim.brief as Brief,
        invoice: succeeded
          ? { id: succeeded.id, invoice_number: succeeded.invoice_number }
          : null,
      };
    });

  return <MyBriefsClient claims={claimsWithBriefs} />;
}
