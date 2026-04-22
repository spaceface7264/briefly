import Link from "next/link";
import type { BriefCategory } from "@/types/database";

interface ContentTipsProps {
  category: BriefCategory;
  isAdIntended: boolean;
}

export function ContentTips({ category, isAdIntended }: ContentTipsProps) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Content Tips</h3>
        <Link href="/guide" className="text-xs text-accent hover:underline">
          Se fuld guide
        </Link>
      </div>

      {/* Ad-specific tips - shown when is_ad_intended */}
      {isAdIntended && (
        <div className="space-y-3 pb-4 border-b border-border">
          <p className="text-xs font-medium text-warning uppercase tracking-wider">For Ads</p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-warning mt-0.5">•</span>
              <span className="text-muted">
                <span className="text-foreground">Hook:</span> Fang seeren i de første 2-3 sek
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-warning mt-0.5">•</span>
              <span className="text-muted">
                <span className="text-foreground">Længde:</span> 8-15 sek ideelt, max 30 sek
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-warning mt-0.5">•</span>
              <span className="text-muted">
                <span className="text-foreground">Undertekster:</span> Placeret i midten
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-warning mt-0.5">•</span>
              <span className="text-muted">
                <span className="text-foreground">Branding:</span> Vis Boulders logo tydeligt
              </span>
            </li>
          </ul>
        </div>
      )}

      {/* Category-specific tips */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-accent uppercase tracking-wider">
          {getCategoryTipLabel(category)}
        </p>
        <ul className="space-y-2 text-sm">
          {getCategoryTips(category).map((tip, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
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
