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

  // Fetch user's claims with brief details + any succeeded invoice
  // Try with payments join first; fall back without if the table doesn't exist yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: claims, error } = await (supabase
    .from("claims") as any)
    .select("*, brief:briefs(*), payments:payments(id, invoice_number, status)")
    .eq("user_id", user.id)
    .order("claimed_at", { ascending: false });

  if (error) {
    // payments table may not exist yet — retry without it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallback = await (supabase.from("claims") as any)
      .select("*, brief:briefs(*)")
      .eq("user_id", user.id)
      .order("claimed_at", { ascending: false });

    claims = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("Error fetching claims:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
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
