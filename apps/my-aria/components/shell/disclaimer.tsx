export function Disclaimer() {
  return (
    <div className="border-b border-[--color-border] bg-[--color-bg-elevated]/60">
      <div className="mx-auto max-w-6xl px-4 py-1.5 text-[11px] text-[--color-fg-subtle] sm:px-6">
        <span className="font-medium text-[--color-fg-muted]">Personal demo.</span>{" "}
        Built on{" "}
        <a
          href="https://github.com/realactivity/tula"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-[--color-fg-subtle]/40 underline-offset-2 hover:text-[--color-fg-muted]"
        >
          open-source Tula
        </a>
        . Not affiliated with Epic Systems Corporation or MyChart. Not medical advice.
      </div>
    </div>
  );
}

export function DisclaimerFull() {
  return (
    <section
      aria-label="Disclaimer"
      className="mt-12 rounded-2xl border border-[--color-border] bg-[--color-bg-elevated]/50 p-5 text-sm leading-relaxed text-[--color-fg-muted]"
    >
      <p className="font-medium text-[--color-fg]">
        Personal demo, not clinical software.
      </p>
      <p className="mt-2">
        My Aria is an open-source patient-view UI built on the{" "}
        <a
          href="https://github.com/realactivity/tula"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-[--color-fg]"
        >
          Tula health agent
        </a>
        . It is not affiliated with, endorsed by, or derived from Epic Systems
        Corporation or its MyChart product. It is not a medical device, not
        FDA-cleared, and not intended to diagnose, treat, cure, or prevent any
        disease or medical condition. Talk to your doctor about anything that
        matters.
      </p>
    </section>
  );
}
