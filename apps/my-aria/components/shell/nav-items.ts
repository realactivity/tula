import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FlaskConical,
  Pill,
  MessageSquare,
  CalendarDays,
  Watch,
  Scan,
  Dna,
  ShieldCheck,
  Wind,
  Bot,
  Home,
} from "lucide-react";
import { TRAVEL_PAGES } from "@/lib/travel/pages";
import { NUTRITION_PAGES } from "@/lib/nutrition/pages";

export type NavItem = {
  id: string;
  href: Route;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

/** Connected patient portals (FHIR) — one or many hospitals; also used by bottom nav on mobile. */
export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    href: "/dashboard",
    label: "Dashboard",
    shortLabel: "Home",
    icon: LayoutDashboard,
  },
  {
    id: "labs",
    href: "/labs",
    label: "Lab results",
    shortLabel: "Labs",
    icon: FlaskConical,
  },
  {
    id: "medications",
    href: "/medications",
    label: "Medications",
    shortLabel: "Meds",
    icon: Pill,
  },
  {
    id: "messages",
    href: "/messages",
    label: "Messages",
    shortLabel: "Inbox",
    icon: MessageSquare,
  },
  {
    id: "appointments",
    href: "/appointments",
    label: "Appointments",
    shortLabel: "Visits",
    icon: CalendarDays,
  },
];

export type RoadmapNavItem = {
  id: string;
  href: Route;
  label: string;
  icon: LucideIcon;
};

/** Longitudinal feeds — sidebar only (planned capabilities). */
export const LONGITUDINAL_NAV_ITEMS: RoadmapNavItem[] = [
  {
    id: "wearables",
    href: "/integrations/wearables",
    label: "Wearables",
    icon: Watch,
  },
  {
    id: "imaging",
    href: "/integrations/imaging",
    label: "Medical imaging",
    icon: Scan,
  },
  {
    id: "genomics",
    href: "/integrations/genomics",
    label: "Genomic reports",
    icon: Dna,
  },
];

/** Home clinical peripherals — single hub; categories live on the page. */
export const HOME_DEVICES_NAV_ITEM: RoadmapNavItem = {
  id: "home-devices",
  href: "/home-devices",
  label: "Overview",
  icon: Home,
};

export const DE_IDENTIFICATION_NAV_ITEM: RoadmapNavItem = {
  id: "de-identification",
  href: "/integrations/de-identification",
  label: "De-identification",
  icon: ShieldCheck,
};

/** Intelligent SDOH — environmental + conversational determinants. */
export const SDOH_NAV_ITEMS: RoadmapNavItem[] = [
  {
    id: "air-quality",
    href: "/sdoh/air-quality",
    label: "Air quality",
    icon: Wind,
  },
  {
    id: "ai-chats",
    href: "/sdoh/ai-chats",
    label: "AI chats",
    icon: Bot,
  },
];

/** Intelligent Nutrition — MyFitnessPal intake + CGM correlation + clinical diet plan. */
export const NUTRITION_NAV_ITEMS: RoadmapNavItem[] = NUTRITION_PAGES.map(
  ({ id, href, label, icon }) => ({ id, href, label, icon })
);

/**
 * Intelligent Travel — health journey across business & personal trips.
 *
 * Sidebar shows the 3 primary surfaces (Trips, On-trip health, Return checklist).
 * The remaining 4 pages (Itineraries, Care-away, Destination brief, Travel journal)
 * still exist at their URLs and are reachable from the Trips hub. Same pattern
 * as Home Devices: one sidebar slot, deeper surface lives on the hub page.
 */
const PRIMARY_TRAVEL_IDS = ["trips", "on-trip-health", "return"] as const;

export const TRAVEL_NAV_ITEMS: RoadmapNavItem[] = TRAVEL_PAGES.filter((p) =>
  (PRIMARY_TRAVEL_IDS as readonly string[]).includes(p.id)
).map(({ id, href, label, icon }) => ({ id, href, label, icon }));

export const SECONDARY_TRAVEL_PAGE_IDS = TRAVEL_PAGES.filter(
  (p) => !(PRIMARY_TRAVEL_IDS as readonly string[]).includes(p.id)
).map((p) => p.id);
