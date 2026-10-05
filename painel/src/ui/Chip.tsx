import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./Icon";

export type Tone = "success" | "info" | "warning" | "error" | "neutral" | "primary";

const TONE: Record<Tone, string> = {
  success: "text-success bg-success/15",
  info: "text-info bg-info/15",
  warning: "text-warning bg-warning/15",
  error: "text-error bg-error/15",
  neutral: "text-text-secondary bg-text-secondary/15",
  primary: "text-primary-text bg-primary-light/15",
};

/** Pílula de estado (`Chip` do FutureShared.jsx). */
export function Chip({ tone = "neutral", icon, children }: { tone?: Tone; icon?: IconName; children: ReactNode }) {
  return (
    <span
      className={cn(
        "type-label-sm inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-[3px] font-semibold",
        TONE[tone],
      )}
    >
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}
