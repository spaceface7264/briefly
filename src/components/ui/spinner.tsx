import { cn } from "@/lib/utils";

interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: number;
}

export function Spinner({
  size = 16,
  className,
  ...props
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("spinner", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={i} className="spinner-leaf" aria-hidden />
      ))}
    </span>
  );
}
