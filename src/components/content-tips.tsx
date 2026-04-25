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
              ["Hook:", "Grab attention in the first 2-3 sec"],
              ["Length:", "8-15 sec ideal, max 30 sec"],
              ["Captions:", "Centered in the frame"],
              ["Branding:", "Show the brand clearly"],
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
      return "Focus: Engage & inspire";
    case "ad":
      return "Focus: Drive action";
    case "guide":
      return "Focus: Teach & inform";
    case "event":
      return "Focus: Capture the moment";
    default:
      return "Tips";
  }
}

function getCategoryTips(category: BriefCategory): string[] {
  switch (category) {
    case "entertaining":
    case "community":
      return [
        "Show real people, real moments",
        "Make it fun and relatable",
        "Highlight the community and vibe",
        "Keep it authentic — not overly produced",
      ];
    case "ad":
      return [
        "Lead with the value proposition",
        "Show the product or experience in action",
        "Include a clear call to action",
        "Keep it concise and punchy",
      ];
    case "guide":
      return [
        "Clear, step-by-step structure",
        "Show demonstrations and common mistakes",
        "Make it accessible for beginners",
        "Use an encouraging, inclusive tone",
      ];
    case "event":
      return [
        "Capture the energy and atmosphere",
        "Include reactions and interviews",
        "Document the key moments",
        "Show the community in action",
      ];
    default:
      return [];
  }
}
