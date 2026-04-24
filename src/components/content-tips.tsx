import Link from "next/link";
import type { BriefCategory } from "@/types/database";

interface ContentTipsProps {
  category: BriefCategory;
  isAdIntended: boolean;
}

export function ContentTips({ category, isAdIntended }: ContentTipsProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-[0.12em]">Tips</h3>
        <Link href="/guide" className="text-xs font-medium text-brand hover:text-brand-hover transition-colors">
          Guide →
        </Link>
      </div>

      {isAdIntended && (
        <div className="space-y-2 pb-3 border-b border-border">
          <p className="text-xs font-semibold text-warning uppercase tracking-[0.12em]">For Ads</p>
          <ul className="space-y-1">
            {[
              ["Hook:", "Fang seeren i de første 2-3 sek"],
              ["Længde:", "8-15 sek ideelt, max 30 sek"],
              ["Undertekster:", "Placeret i midten"],
              ["Branding:", "Vis Boulders logo tydeligt"],
            ].map(([label, desc], i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm">
                <span className="text-warning mt-px">·</span>
                <span className="text-muted">
                  <span className="text-text-secondary">{label}</span> {desc}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-brand uppercase tracking-[0.12em]">
          {getCategoryTipLabel(category)}
        </p>
        <ul className="space-y-1">
          {getCategoryTips(category).map((tip, i) => (
            <li key={i} className="flex items-start gap-1.5 text-sm leading-relaxed">
              <span className="text-brand mt-px">·</span>
              <span className="text-muted">{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function getCategoryTipLabel(category: BriefCategory): string {
  switch (category) {
    case "entertaining":
    case "community":
      return "Fokus: Hvorfor bouldering er fedt";
    case "ad":
      return "Fokus: Salgsaktivering";
    case "guide":
      return "Fokus: Læring & tips";
    case "event":
      return "Fokus: Event coverage";
    default:
      return "Tips";
  }
}

function getCategoryTips(category: BriefCategory): string[] {
  switch (category) {
    case "entertaining":
    case "community":
      return [
        "Vis det gode fællesskab",
        "Fremhæv sjov og anderledes sport",
        "Vis at det er for alle niveauer",
        "Nedbryd indgangsbarrierer",
      ];
    case "ad":
      return [
        "Fremhæv medlemskabsfordele",
        "Fitness + bouldering i ét",
        "Adgang til alle haller",
        "Nævn 15 day pass / punch cards",
      ];
    case "guide":
      return [
        "Klar og pædagogisk formidling",
        "Vis demonstration + almindelige fejl",
        "Gør det tilgængeligt for begyndere",
        "Opmuntrende og inkluderende tone",
      ];
    case "event":
      return [
        "Fang energien og stemningen",
        "Interviews med deltagere",
        "Dokumentér key moments",
        "Vis fællesskabet i aktion",
      ];
    default:
      return [];
  }
}
