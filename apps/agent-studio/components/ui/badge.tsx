import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeStyles = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-[--color-bg-elevated] text-[--color-fg-muted] border border-[--color-border]",
        ok: "bg-[color-mix(in_oklch,var(--color-flag-ok)_18%,transparent)] text-[--color-flag-ok]",
        high: "bg-[color-mix(in_oklch,var(--color-flag-high)_18%,transparent)] text-[--color-flag-high]",
        low: "bg-[color-mix(in_oklch,var(--color-flag-low)_18%,transparent)] text-[--color-flag-low]",
        accent:
          "bg-[color-mix(in_oklch,var(--color-accent)_18%,transparent)] text-[--color-accent]",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeStyles>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeStyles({ tone }), className)} {...props} />;
}
