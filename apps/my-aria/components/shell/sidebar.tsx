"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  NAV_ITEMS,
  LONGITUDINAL_NAV_ITEMS,
  DE_IDENTIFICATION_NAV_ITEM,
  HOME_DEVICES_NAV_ITEM,
  SDOH_NAV_ITEMS,
  TRAVEL_NAV_ITEMS,
  type NavItem,
  type RoadmapNavItem,
} from "./nav-items";

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

  return (
    <aside className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-1 md:py-6">
      <nav className="flex flex-col gap-0.5" aria-label="Main">
        <p className="px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[--color-fg-subtle]">
          Patient portals
        </p>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}

        <p className="mt-4 px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[--color-fg-subtle]">
          Longitudinal feeds
        </p>
        {LONGITUDINAL_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}

        <NavLink
          item={DE_IDENTIFICATION_NAV_ITEM}
          active={isActive(pathname, DE_IDENTIFICATION_NAV_ITEM.href)}
        />

        <p className="mt-4 px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[--color-fg-subtle]">
          Home devices
        </p>
        <NavLink
          item={HOME_DEVICES_NAV_ITEM}
          active={isActive(pathname, HOME_DEVICES_NAV_ITEM.href)}
        />

        <p className="mt-4 px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[--color-fg-subtle]">
          Intelligent SDOH
        </p>
        {SDOH_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}

        <p className="mt-4 px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[--color-fg-subtle]">
          Intelligent Travel
        </p>
        {TRAVEL_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}
      </nav>

      <div className="mt-auto px-3 py-4 text-xs text-[--color-fg-subtle] font-mono">
        <p>single user</p>
        <p>local data</p>
        <p>private network</p>
      </div>
    </aside>
  );
}
