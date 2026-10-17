"use client";

import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Bot, MessageSquare, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { aiChatsSdohFixture } from "@/lib/sdoh/fixtures";
import type { AiChatsSdohReport } from "@/lib/sdoh/types";

const SOURCE_LABELS = {
  telegram: "Telegram",
  portal: "Patient portal",
  sms: "SMS",
} as const;

function confidenceTone(c: "high" | "medium" | "low") {
  return c === "high" ? "ok" : c === "medium" ? "neutral" : "low";
}

export function AiChatsView() {
  const [report, setReport] = useState<AiChatsSdohReport>(aiChatsSdohFixture);
  const [scanning, setScanning] = useState(false);

  const onRescan = () => {
    setScanning(true);
    window.setTimeout(() => {
      setReport({
        ...aiChatsSdohFixture,
        analyzedAt: new Date().toISOString(),
      });
      setScanning(false);
    }, 900);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI chats to SDOH</h1>
          <p className="mt-2 max-w-prose text-sm text-[--color-fg-muted]">
            Tula scans your agent chat histories (Telegram, portal drafts, SMS) and
            extracts social-determinant signals - transportation, food, housing,
            financial strain, and environmental barriers - for your longitudinal record.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRescan}
          disabled={scanning}
        >
          <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning..." : "Rescan chats"}
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-[--color-fg-subtle]">
            Threads analyzed
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold">{report.threadCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-[--color-fg-subtle]">
            SDOH signals found
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold">{report.signalCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-[--color-fg-subtle]">
            Last scan
          </p>
          <p className="mt-1 text-sm text-[--color-fg]">
            {format(new Date(report.analyzedAt), "MMM d, h:mm a")}
          </p>
        </Card>
      </div>

      <ul className="space-y-4">
        {report.threads.map((thread) => (
          <li key={thread.id}>
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[--color-accent-soft] text-[--color-accent]">
                    {thread.source === "telegram" ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">{thread.title}</h2>
                    <p className="text-xs text-[--color-fg-subtle]">
                      {SOURCE_LABELS[thread.source]} ·{" "}
                      {formatDistanceToNow(new Date(thread.lastMessageAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
                <Badge tone="accent">{thread.signals.length} signals</Badge>
              </div>

              <blockquote className="mt-4 rounded-xl border border-[--color-border]/60 bg-[--color-bg-elevated] px-4 py-3 text-sm italic text-[--color-fg-muted]">
                {thread.excerpt}
              </blockquote>

              <ul className="mt-4 space-y-2">
                {thread.signals.map((signal, i) => (
                  <li
                    key={`${thread.id}-${i}`}
                    className="rounded-xl bg-[--color-bg-elevated] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-[--color-fg]">
                        {signal.theme}
                      </span>
                      <Badge tone={confidenceTone(signal.confidence)}>
                        {signal.confidence} confidence
                      </Badge>
                      {signal.icd10ZCode && (
                        <span className="font-mono text-[11px] text-[--color-fg-subtle]">
                          {signal.icd10ZCode}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[--color-fg-muted]">
                      {signal.evidence}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </li>
        ))}
      </ul>

      <p className="text-xs text-[--color-fg-subtle]">
        Phase 1 uses fixture extractions. Production will run on
        ~/.openclaw/workspace memory and Telegram history with a dedicated SDOH
        skill.
      </p>
    </div>
  );
}
