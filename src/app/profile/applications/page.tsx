import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCreatorAccount } from "@/lib/account";

export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
  reviewed_at: string | null;
  org: {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    accent_color: string | null;
    industry: string | null;
  } | null;
};

export default async function MyApplicationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await requireCreatorAccount(supabase);

  const { data } = await supabase
    .from("org_applications")
    .select(
      "id, status, message, created_at, reviewed_at, org:organizations!org_applications_org_id_fkey(id, slug, name, logo_url, accent_color, industry)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const applications = (data ?? []) as unknown as ApplicationRow[];
  const pending = applications.filter((a) => a.status === "pending");
  const reviewed = applications.filter((a) => a.status !== "pending");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">My applications</h1>
        <p className="text-muted text-sm">
          Status of every org you&apos;ve applied to join.
        </p>
      </div>

      {applications.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <Section title="Pending review">
              {pending.map((a) => (
                <ApplicationCard key={a.id} application={a} />
              ))}
            </Section>
          )}

          {reviewed.length > 0 && (
            <Section title="Reviewed" muted>
              {reviewed.map((a) => (
                <ApplicationCard key={a.id} application={a} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  muted,
  children,
}: {
  title: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className={`text-lg font-semibold mb-4 ${muted ? "text-muted" : ""}`}
      >
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ApplicationCard({ application }: { application: ApplicationRow }) {
  const org = application.org;
  const status = application.status;
  const statusTone =
    status === "approved"
      ? "bg-accent/10 text-accent"
      : status === "rejected"
        ? "bg-surface-raised text-muted"
        : "bg-warning/10 text-warning";
  const statusLabel =
    status === "approved"
      ? "Approved"
      : status === "rejected"
        ? "Not accepted"
        : "Pending";

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-start gap-3">
        {org?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={org.logo_url}
            alt={org.name}
            className="w-10 h-10 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-background font-bold text-lg shrink-0"
            style={{ backgroundColor: org?.accent_color || "#C8FF00" }}
          >
            {org?.name?.charAt(0).toUpperCase() ?? "?"}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium truncate">
                {org?.name ?? "Unknown organisation"}
              </p>
              {org?.industry && (
                <p className="text-xs text-muted truncate">{org.industry}</p>
              )}
            </div>
            <span
              className={`shrink-0 px-2.5 py-1 text-xs font-medium rounded-full ${statusTone}`}
            >
              {statusLabel}
            </span>
          </div>

          {application.message && (
            <p className="text-sm text-muted mt-3 italic">
              &ldquo;{application.message}&rdquo;
            </p>
          )}

          <p className="text-xs text-muted mt-3 font-mono">
            Applied {formatDate(application.created_at)}
            {application.reviewed_at &&
              ` · Reviewed ${formatDate(application.reviewed_at)}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-surface border border-border rounded-xl p-10 text-center">
      <p className="text-muted">You haven&apos;t applied to any orgs yet.</p>
      <Link
        href="/discover"
        className="inline-block mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-lg transition-colors"
      >
        Browse organisations
      </Link>
    </div>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
