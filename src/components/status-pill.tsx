import type { ReactNode } from "react";

export type StatusTone =
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "brand";

interface StatusPillProps {
  tone: StatusTone;
  children: ReactNode;
  dot?: boolean;
  pulse?: boolean;
  size?: "sm" | "md";
}

const toneStyles: Record<StatusTone, { pill: string; dot: string }> = {
  info: {
    pill: "bg-info-muted text-info",
    dot: "bg-info",
  },
  success: {
    pill: "bg-success-muted text-success",
    dot: "bg-success",
  },
  warning: {
    pill: "bg-warning-muted text-warning",
    dot: "bg-warning",
  },
  danger: {
    pill: "bg-error-muted text-error",
    dot: "bg-error",
  },
  neutral: {
    pill: "bg-surface-raised text-muted border border-border",
    dot: "bg-muted",
  },
  brand: {
    pill: "bg-accent-muted text-accent",
    dot: "bg-accent",
  },
};

export function StatusPill({
  tone,
  children,
  dot = true,
  pulse = false,
  size = "sm",
}: StatusPillProps) {
  const style = toneStyles[tone];
  const sizeClass =
    size === "md"
      ? "px-3 py-1 text-sm gap-2"
      : "px-2.5 py-1 text-xs gap-1.5";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${sizeClass} ${style.pill}`}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={`inline-block w-1.5 h-1.5 rounded-full ${style.dot} ${
            pulse ? "animate-status-pulse" : ""
          }`}
        />
      )}
      {children}
    </span>
  );
}
