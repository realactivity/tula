"use client";

import Link from "next/link";
import { RefreshCw, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [spinKey, setSpinKey] = useState(0);

  const onRefresh = () => {
    setSpinKey((k) => k + 1);
    startTransition(() => router.refresh());
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[--color-border] bg-[--color-bg]/85 backdrop-blur supports-[backdrop-filter]:bg-[--color-bg]/65">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">
            My <span className="text-[--color-accent]">Aria</span>
          </span>
          <span className="hidden text-xs text-[--color-fg-subtle] font-mono sm:inline">
            personal patient view
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            aria-label="Refresh data"
            disabled={isPending}
          >
            <RefreshCw
              key={spinKey}
              className={cn(
                "h-4 w-4",
                isPending && "animate-spin"
              )}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <button
            type="button"
            aria-label="Open account menu"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[--color-bg-elevated] border border-[--color-border] text-[--color-fg-muted] hover:text-[--color-fg] transition-colors"
          >
            <User className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
