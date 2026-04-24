import Link from "next/link";
import { LanguagePickerModal } from "@/components/language-picker";
import { getT, hasLocalePreference } from "@/lib/i18n/server";

export default async function Home() {
  const t = await getT();
  const hasLocale = await hasLocalePreference();

  const steps = [
    {
      number: t("home.step1Number"),
      title: t("home.step1Title"),
      body: t("home.step1Body"),
    },
    {
      number: t("home.step2Number"),
      title: t("home.step2Title"),
      body: t("home.step2Body"),
    },
    {
      number: t("home.step3Number"),
      title: t("home.step3Title"),
      body: t("home.step3Body"),
    },
  ];

  return (
    <main className="flex-1 relative overflow-hidden">
      {/* Ambient brand glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-accent/6 blur-[140px]"
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="text-center space-y-6">
          <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted px-3 py-1.5 rounded-md border border-border bg-surface">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-status-pulse" />
            {t("home.inviteOnly")}
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
            Boulders <span className="text-brand-pure">Creators</span>
          </h1>
          <p className="text-lg text-muted max-w-lg mx-auto leading-relaxed">
            {t("home.tagline")}
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-4">
            <Link
              href="/login"
              className="px-6 py-3 bg-accent hover:bg-accent-hover text-background font-bold rounded-lg transition-colors text-sm"
            >
              {t("home.ctaLogin")}
            </Link>
            <Link
              href="/login?mode=signup"
              className="px-6 py-3 border border-border-strong hover:border-foreground/30 hover:bg-surface-hover font-semibold rounded-lg transition-colors text-sm"
            >
              {t("home.ctaRedeem")}
            </Link>
          </div>
        </div>

        <div className="mt-24 grid gap-4 sm:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="relative bg-surface border border-border rounded-xl p-6 hover:border-border-strong transition-colors"
            >
              <p className="font-mono text-accent text-xs mb-4 tracking-wider">{step.number}</p>
              <h2 className="font-semibold mb-2">{step.title}</h2>
              <p className="text-muted text-sm leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>

      {!hasLocale && <LanguagePickerModal />}
    </main>
  );
}
