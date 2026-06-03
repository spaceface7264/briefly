import Link from "next/link";
import { CreateOrgForm } from "./create-org-form";

export const dynamic = "force-dynamic";

export default function NewOrgPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/super/orgs"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          ← Organisations
        </Link>
        <h1 className="text-3xl font-bold mt-2 mb-1">New organisation</h1>
        <p className="text-muted">
          Creates the org and auto-provisions a Free subscription via the{" "}
          <code className="font-mono text-xs">create_default_subscription</code>{" "}
          trigger. We email the admin a signup link, so they don&apos;t need an
          account first. The org has no owner until they accept.
        </p>
      </div>

      <CreateOrgForm />
    </div>
  );
}
