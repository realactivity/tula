/**
 * My Aria - typed data layer.
 *
 * Clinical data flows through FHIR R4 types in `lib/fhir/types.ts`.
 * Patient-portal UX state (balances, quick actions, content copy) lives here.
 */

export type {
  Observation,
  DiagnosticReport,
  Appointment,
  MedicationStatement,
  DocumentReference,
  ActivityEvent,
  TulaMeta,
  Coding,
  CodeableConcept,
  Quantity,
  ReferenceRange,
} from "@/lib/fhir/types";

import type {
  Observation,
  Appointment,
  MedicationStatement,
} from "@/lib/fhir/types";

/** One displayed lab result with optional 8-point history for sparklines. */
export type LabTrend = {
  /** The most recent observation. */
  latest: Observation;
  /** Historical values, oldest first. Latest is always last and equals `latest.valueQuantity?.value`. */
  history: number[];
  /** Optional clinical context, e.g., "down 0.4 from last visit". */
  delta?: string;
};

/** A quick-action tile on the dashboard. Pure UI config. */
export type QuickAction = {
  id: string;
  label: string;
  description: string;
  icon: "calendar" | "message" | "pill" | "file";
  href: string;
};

/** Planned capability tile - Tula roadmap items, not live portal tasks. */
export type PlannedCapability = {
  id: string;
  label: string;
  description: string;
  icon: "watch" | "scan" | "dna" | "shield";
  href: string;
};

/** Editable copy loaded from data/content/*.md via gray-matter. */
export type ContentBlock = {
  frontmatter: Record<string, unknown>;
  content: string;
};

/** The full payload powering the dashboard page. */
export type DashboardData = {
  greeting: string;
  patientFirstName: string;
  upcomingAppointment?: Appointment;
  recentLabs: LabTrend[];
  activeMedications: MedicationStatement[];
  quickActions: QuickAction[];
  longitudinalFeeds: PlannedCapability[];
  deIdentification: PlannedCapability;
  refreshedAt: string;
};
