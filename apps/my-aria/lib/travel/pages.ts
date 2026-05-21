import type { LucideIcon } from "lucide-react";
import {
  Plane,
  CalendarClock,
  Activity,
  Stethoscope,
  Globe,
  NotebookPen,
  ListChecks,
} from "lucide-react";
import type { Route } from "next";

export type TravelPageConfig = {
  id: string;
  href: Route;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tracks: string[];
};

export const TRAVEL_PAGES: TravelPageConfig[] = [
  {
    id: "trips",
    href: "/travel/trips",
    label: "Trips",
    icon: Plane,
    title: "Trips",
    description:
      "A unified log of business and personal travel - destination, dates, purpose, and links to itinerary, on-trip vitals, and post-trip catch-up. Tag each trip so Tula can compare conference season vs recovery vacations.",
    tracks: [
      "Business vs personal tags",
      "Trip intensity (meetings, miles, time away)",
      "Link to labs & appointments before/after departure",
    ],
  },
  {
    id: "itineraries",
    href: "/travel/itineraries",
    label: "Itineraries & time zones",
    icon: CalendarClock,
    title: "Itineraries & time zones",
    description:
      "Flights, lodging, and calendar blocks ingested from email (TripIt-style) with automatic time-zone shifts. Medication schedules adjust so dose timing stays clinically sensible across zones.",
    tracks: [
      "Flight & hotel confirmations from inbox",
      "Jet-lag / circadian disruption score",
      "Medication timing across time zones",
    ],
  },
  {
    id: "on-trip-health",
    href: "/travel/on-trip-health",
    label: "On-trip health",
    icon: Activity,
    title: "On-trip health",
    description:
      "Wearable and journal signals while you are away - sleep debt, HRV, steps, stress, diet deviation - compared to your home baseline so you see when travel is helping or hurting recovery.",
    tracks: [
      "Sleep & HRV vs home baseline",
      "Activity and sedentary time (flights, drives)",
      "Business-travel stress proxies (late meetings, red-eyes)",
    ],
  },
  {
    id: "care-away",
    href: "/travel/care-away",
    label: "Care away from home",
    icon: Stethoscope,
    title: "Care away from home",
    description:
      "Nearest in-network urgent care, pharmacies that can fill travel emergencies, and telehealth options for the ZIP you are in - plus your travel insurance snapshot when you need it.",
    tracks: [
      "Urgent care & ER proximity",
      "Pharmacy refill routing on the road",
      "Telehealth & travel insurance card",
    ],
  },
  {
    id: "destination-brief",
    href: "/travel/destination-brief",
    label: "Destination brief",
    icon: Globe,
    title: "Destination brief",
    description:
      "Pre-trip health brief for each destination: CDC advisories, vaccine reminders, local air quality (ties to Intelligent SDOH), altitude and climate notes, and seasonal illness patterns.",
    tracks: [
      "CDC destination health notices",
      "Vaccination & prophylaxis reminders",
      "Local air quality & environmental risks",
    ],
  },
  {
    id: "journal",
    href: "/travel/journal",
    label: "Travel journal",
    icon: NotebookPen,
    title: "Travel journal",
    description:
      "Agent-captured notes per trip - how you felt, what you ate, caregiver coverage at home, and anything you want Tula to remember when synthesizing your longitudinal record.",
    tracks: [
      "Daily check-ins via Telegram",
      "Diet, alcohol, hydration notes",
      "Caregiver & family coordination while away",
    ],
  },
  {
    id: "return",
    href: "/travel/return",
    label: "Return checklist",
    icon: ListChecks,
    title: "Return checklist",
    description:
      "Post-trip tasks so nothing slips after you land: catch up on portal messages, schedule follow-up labs, re-sync wearables, and a short recovery window before the next trip stacks on.",
    tracks: [
      "Unread messages & lab results",
      "Post-travel lab or vitals comparison",
      "Recovery days before next business trip",
    ],
  },
];
