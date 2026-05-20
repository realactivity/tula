"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function DashboardSection({
  index,
  title,
  action,
  className,
  children,
}: {
  index: number;
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: Math.min(index, 8) * 0.04,
        ease: [0.2, 0.0, 0.0, 1],
      }}
      className={cn("mb-5", className)}
    >
      {(title || action) && (
        <header className="mb-2.5 flex items-baseline justify-between">
          {title && (
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[--color-fg-subtle]">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </motion.section>
  );
}
