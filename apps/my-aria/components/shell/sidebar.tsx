"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  NAV_ITEMS,
  LONGITUDINAL_NAV_ITEMS,
  DE_IDENTIFICATION_NAV_ITEM,
  HOME_DEVICES_NAV_ITEM,
  NUTRITION_NAV_ITEMS,
  SDOH_NAV_ITEMS,
  TRAVEL_NAV_ITEMS,
  type NavItem,
  type RoadmapNavItem,
} from "./nav-items";

const SECTION_STORAGE_KEY = "my-aria.sidebar.sections.v1";

type SidebarSection = {
  id: string;
  label: string;
  items: Array<NavItem | RoadmapNavItem>;
};

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    id: "patient-portals",
    label: "Patient portals",
    items: NAV_ITEMS,
  },
  {
    id: "longitudinal-feeds",
    label: "Longitudinal feeds",
    items: [...LONGITUDINAL_NAV_ITEMS, DE_IDENTIFICATION_NAV_ITEM],
  },
  {
    id: "home-devices",
    label: "Home devices",
    items: [HOME_DEVICES_NAV_ITEM],
  },
  {
    id: "intelligent-nutrition",
    label: "Intelligent Nutrition",
    items: NUTRITION_NAV_ITEMS,
  },
  {
    id: "intelligent-sdoh",
    label: "Intelligent SDOH",
    items: SDOH_NAV_ITEMS,
  },
  {
    id: "intelligent-travel",
    label: "Intelligent Travel",
    items: TRAVEL_NAV_ITEMS,
  },
];

function getAllCollapsedState(): Record<string, boolean> {
  return Object.fromEntries(
    SIDEBAR_SECTIONS.map((section) => [section.id, false] as const)
  );
}

function getAllExpandedState(): Record<string, boolean> {
  return Object.fromEntries(
    SIDEBAR_SECTIONS.map((section) => [section.id, true] as const)
  );
}

function NavLink({
  item,
  active,
}: {
  item: NavItem | RoadmapNavItem;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
        active
          ? "bg-[--color-accent-soft] text-[--color-fg]"
          : "text-[--color-fg-muted] hover:bg-[--color-bg-elevated] hover:text-[--color-fg]"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-[--color-accent]" : "text-[--color-fg-subtle]"
        )}
      />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const defaultOpen = useMemo(() => getAllCollapsedState(), []);
  const [openSections, setOpenSections] =
    useState<Record<string, boolean>>(defaultOpen);

  const persistSections = (next: Record<string, boolean>) => {
    try {
      window.localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage might be unavailable in private mode; no-op.
    }
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SECTION_STORAGE_KEY);
      if (!raw) {
        // First visit only: auto-open the active section, keep others minimized.
        const firstVisitState = getAllCollapsedState();
        for (const section of SIDEBAR_SECTIONS) {
          const hasActive = section.items.some((item) =>
            isActive(pathname, item.href)
          );
          if (hasActive) {
            firstVisitState[section.id] = true;
            break;
          }
        }
        setOpenSections(firstVisitState);
        persistSections(firstVisitState);
        return;
      }

      const parsedUnknown = JSON.parse(raw) as unknown;
      if (!parsedUnknown || typeof parsedUnknown !== "object") {
        return;
      }

      const parsed = parsedUnknown as Record<string, unknown>;
      const normalized: Record<string, boolean> = { ...defaultOpen };
      for (const section of SIDEBAR_SECTIONS) {
        if (typeof parsed[section.id] === "boolean") {
          normalized[section.id] = parsed[section.id] as boolean;
        }
      }
      setOpenSections(normalized);
    } catch {
      // Ignore malformed local state and keep defaults.
    }
  }, [defaultOpen, pathname]);

  const toggleSection = (sectionId: string) => {
    setOpenSections((current) => {
      const next = { ...current, [sectionId]: !current[sectionId] };
      persistSections(next);
      return next;
    });
  };

  const expandAll = () => {
    const next = getAllExpandedState();
    setOpenSections(next);
    persistSections(next);
  };

  const collapseAll = () => {
    const next = getAllCollapsedState();
    setOpenSections(next);
    persistSections(next);
  };

  return (
    <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:gap-3 md:py-6">
      <div className="mb-1 flex items-center justify-end gap-1 px-1">
        <button
          type="button"
          onClick={expandAll}
          className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[--color-fg-subtle] transition-colors hover:bg-[--color-bg-elevated] hover:text-[--color-fg]"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[--color-fg-subtle] transition-colors hover:bg-[--color-bg-elevated] hover:text-[--color-fg]"
        >
          Collapse all
        </button>
      </div>

      <nav className="flex flex-col gap-2" aria-label="Main">
        {SIDEBAR_SECTIONS.map((section) => {
          const expanded = openSections[section.id];
          const sectionHasActive = section.items.some((item) =>
            isActive(pathname, item.href)
          );

          return (
            <section
              key={section.id}
              className={cn(
                "rounded-2xl border border-[--color-border] bg-[--color-bg-elevated]/55 px-2 py-2 backdrop-blur-sm transition-colors",
                sectionHasActive && "border-[--color-accent]/35"
              )}
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={expanded}
                aria-controls={`section-${section.id}`}
                className={cn(
                  "group flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left transition-colors",
                  "hover:bg-[--color-bg-elevated] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-accent]/50"
                )}
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[--color-fg-subtle]">
                    {section.label}
                  </p>
                  <p className="text-[10px] text-[--color-fg-subtle]">
                    {section.items.length} item{section.items.length === 1 ? "" : "s"}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[--color-fg-subtle] transition-transform duration-300 ease-out",
                    expanded ? "rotate-0" : "-rotate-90"
                  )}
                />
              </button>

              <div
                id={`section-${section.id}`}
                className={cn(
                  "grid overflow-hidden transition-all duration-300 ease-out",
                  expanded
                    ? "mt-1 grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="min-h-0 space-y-0.5 overflow-hidden px-1 pb-1">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      active={isActive(pathname, item.href)}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-[--color-border] bg-[--color-bg-elevated]/40 px-4 py-4 text-xs text-[--color-fg-subtle] font-mono backdrop-blur-sm">
        <p>single user</p>
        <p>local data</p>
        <p>private network</p>
      </div>
    </aside>
  );
}
