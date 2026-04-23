// NOTE: Starter content pending legal review. Before launch: confirm the
// exact Supabase cookie names (sb-*-auth-token) and Stripe Connect cookie
// set during onboarding; decide whether a consent banner is needed (not
// required for strictly-necessary cookies under ePrivacy, but worth
// confirming once analytics are added).

import { LegalPage, LegalSection } from "@/components/legal-page";

export default function CookiesPage() {
  return (
    <LegalPage title="Cookies" lastUpdated="23 April 2026">
      <p className="text-muted">
        This platform uses only the cookies it needs to run. We do not use
        advertising or third-party tracking cookies.
      </p>

      <LegalSection title="Strictly necessary cookies">
        <p>
          These keep you signed in and let the platform function. They cannot
          be turned off without breaking core functionality.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm mt-2 border border-border rounded-lg overflow-hidden">
            <thead className="bg-surface-raised">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium text-foreground">
                  Cookie
                </th>
                <th className="px-3 py-2 font-medium text-foreground">
                  Purpose
                </th>
                <th className="px-3 py-2 font-medium text-foreground">
                  Lifetime
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-3 py-2 font-mono text-xs">sb-*-auth-token</td>
                <td className="px-3 py-2">
                  Authenticates your session with Supabase.
                </td>
                <td className="px-3 py-2">Session / up to 1 year</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">__stripe_mid</td>
                <td className="px-3 py-2">
                  Set by Stripe during Connect onboarding for fraud
                  prevention.
                </td>
                <td className="px-3 py-2">1 year</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-mono text-xs">__stripe_sid</td>
                <td className="px-3 py-2">
                  Set by Stripe during Connect onboarding for fraud
                  prevention.
                </td>
                <td className="px-3 py-2">30 minutes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="What we do not use">
        <p>
          We do not use advertising, analytics, or cross-site tracking
          cookies. If that changes, this page will be updated and a consent
          request will appear before any non-essential cookie is set.
        </p>
      </LegalSection>

      <LegalSection title="Controlling cookies">
        <p>
          You can clear or block cookies in your browser settings. Blocking
          the cookies listed above will prevent you from signing in or
          completing Stripe onboarding.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
