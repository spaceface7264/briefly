import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatPrice } from "@/lib/utils";

export default async function InvoicesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payments } = await (supabase.from("payments") as any)
    .select("*, claim:claims(*, brief:briefs(id, title, price_dkk))")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  const invoices = payments || [];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Invoice History</h1>
        <p className="text-muted">Your payment and invoice records</p>
      </div>

      {invoices.length > 0 ? (
        <div className="bg-surface border border-border rounded-xl overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Invoice</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Brief</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Status</th>
                <th className="text-right text-sm font-medium text-muted px-4 py-3">Amount</th>
                <th className="text-right text-sm font-medium text-muted px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((payment: any) => (
                <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-3 font-mono text-sm">
                    {payment.invoice_number || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {payment.claim?.brief?.title || "Unknown"}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge status={payment.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {formatPrice(payment.claim?.brief?.price_dkk)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted font-mono text-sm">
                    {new Date(payment.created_at).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-surface border border-border rounded-xl">
          <p className="text-muted">No invoices yet</p>
          <p className="text-muted text-sm mt-1">
            Invoices will appear here after your submissions are approved and paid
          </p>
        </div>
      )}
    </>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    succeeded: "bg-success/20 text-success",
    pending: "bg-warning/20 text-warning",
    failed: "bg-error/20 text-error",
  };

  const labels: Record<string, string> = {
    succeeded: "Paid",
    pending: "Pending",
    failed: "Failed",
  };

  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${styles[status] || "bg-muted/20 text-muted"}`}>
      {labels[status] || status}
    </span>
  );
}
