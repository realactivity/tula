import Link from "next/link";

const NAV = [
  { href: "/", label: "Activity" },
  { href: "/labs", label: "Labs" },
  { href: "/imaging", label: "Imaging" },
  { href: "/medications", label: "Meds" },
  { href: "/appointments", label: "Appointments" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 sm:px-6 lg:px-8 py-6 sm:py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2 group">
          <span className="text-2xl font-semibold tracking-tight">agent-studio</span>
          <span className="text-xs text-[--color-fg-subtle] font-mono">tula health agent</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-1 text-sm text-[--color-fg-muted]">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href as any}
              className="rounded-lg px-2.5 py-1.5 hover:bg-[--color-bg-elevated] hover:text-[--color-fg] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
