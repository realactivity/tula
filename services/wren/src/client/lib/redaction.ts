import type { CachedFhirData, SavedConnection } from './connections';

export type RedactionAction = 'send' | 'downloadJson' | 'downloadSkill';
export type RedactionTermSource = 'manual' | 'suggested';

export interface RedactionTerm {
  id: string;
  value: string;
  source: RedactionTermSource;
  createdAt: string;
}

export interface RedactionProfile {
  id: string;
  name: string;
  terms: RedactionTerm[];
  stripAttachmentBase64: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RedactionSettings {
  activeProfileId: string;
  appliedProfileId: string | null;
}

export interface RedactionState {
  profiles: RedactionProfile[];
  settings: RedactionSettings;
}

export interface RedactionRecordInput {
  connection: SavedConnection;
  data: CachedFhirData;
}

export type SuggestedTermCategory =
  | 'name'
  | 'address'
  | 'identifier'
  | 'phone'
  | 'email'
  | 'ssn'
  | 'dob'
  | 'other';

export const SUGGESTED_TERM_CATEGORY_ORDER: SuggestedTermCategory[] = [
  'name',
  'address',
  'identifier',
  'phone',
  'email',
  'ssn',
  'dob',
  'other',
];

export const SUGGESTED_TERM_CATEGORY_LABELS: Record<SuggestedTermCategory, string> = {
  name: 'Name',
  address: 'Address',
  identifier: 'Identifier',
  phone: 'Phone',
  email: 'Email',
  ssn: 'SSN',
  dob: 'Dates',
  other: 'Other',
};

export interface SuggestedTermGroup {
  key: string;
  primary: string;
  variants: string[];
  categories: SuggestedTermCategory[];
  primaryCategory: SuggestedTermCategory;
  occurrenceCount: number;
  groupHints?: string[];
}

const REDACTION_PROFILES_KEY = 'health_skillz_redaction_profiles_v1';
const REDACTION_SETTINGS_KEY = 'health_skillz_redaction_settings_v1';
const REDACTION_TOKEN = '[REDACTED]';

const ADDRESS_TOKEN_NORMALIZATION: Record<string, string> = {
  street: 'st',
  st: 'st',
  avenue: 'ave',
  ave: 'ave',
  road: 'rd',
  rd: 'rd',
  boulevard: 'blvd',
  blvd: 'blvd',
  drive: 'dr',
  dr: 'dr',
  lane: 'ln',
  ln: 'ln',
  court: 'ct',
  ct: 'ct',
  place: 'pl',
  pl: 'pl',
  terrace: 'ter',
  ter: 'ter',
  north: 'n',
  south: 's',
  east: 'e',
  west: 'w',
};

const ADDRESS_TOKEN_EXPANSIONS: Record<string, string[]> = (() => {
  const map = new Map<string, Set<string>>();
  for (const [raw, canonical] of Object.entries(ADDRESS_TOKEN_NORMALIZATION)) {
    if (!map.has(canonical)) map.set(canonical, new Set<string>());
    map.get(canonical)!.add(canonical);
    map.get(canonical)!.add(raw);
  }

  const out: Record<string, string[]> = {};
  for (const [canonical, values] of map.entries()) {
    out[canonical] = Array.from(values.values());
  }
  return out;
})();

function nowIso(): string {
  return new Date().toISOString();
}

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeWordTokens(term: string): string[] {
  const rawTokens = term.toLowerCase().match(/[a-z0-9]+/g) || [];
  const tokens: string[] = [];

  for (const raw of rawTokens) {
    const mapped = ADDRESS_TOKEN_NORMALIZATION[raw] || raw;
    if (mapped.length === 1 && !/^\d$/.test(mapped)) continue;
    tokens.push(mapped);
  }

  return tokens;
}

interface ParsedDate {
  year: string;
  month: string;
  day: string;
}

function parseDateValue(raw: string): ParsedDate | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const ymd = trimmed.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (ymd) {
    return normalizeDateParts(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  }

  const mdy = trimmed.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  if (mdy) {
    return normalizeDateParts(Number(mdy[3]), Number(mdy[1]), Number(mdy[2]));
  }

  return null;
}

function normalizeDateParts(year: number, month: number, day: number): ParsedDate | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1850 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    year: String(year).padStart(4, '0'),
    month: String(month).padStart(2, '0'),
    day: String(day).padStart(2, '0'),
  };
}

function buildDateHint(parsed: ParsedDate): string {
  return `dob:${parsed.year}${parsed.month}${parsed.day}`;
}

function canonicalTermKey(term: string): string {
  const trimmed = term.trim();
  if (!trimmed) return '';

  const parsedDate = parseDateValue(trimmed);
  if (parsedDate) {
    return buildDateHint(parsedDate);
  }

  const emailMatch = trimmed.match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i);
  if (emailMatch) {
    return `email:${trimmed.toLowerCase()}`;
  }

  const ssnMatch = trimmed.match(/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/);
  if (ssnMatch) {
    const digits = ssnMatch[0].replace(/\D/g, '');
    if (digits.length === 9) return `ssn:${digits}`;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `phone:${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `phone:${digits}`;
  }

  const tokens = normalizeWordTokens(trimmed);
  if (tokens.length === 0) return '';
  return `text:${tokens.join('')}`;
}

export function normalizeTermForCompare(term: string): string {
  return canonicalTermKey(term);
}

function dedupeTerms(terms: RedactionTerm[]): RedactionTerm[] {
  const seen = new Set<string>();
  const out: RedactionTerm[] = [];

  for (const term of terms) {
    const key = normalizeTermForCompare(term.value);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }

  return out;
}

function sanitizeTerm(raw: unknown): RedactionTerm | null {
  if (!isObject(raw)) return null;
  if (typeof raw.value !== 'string') return null;
  const value = raw.value.trim();
  if (!value) return null;

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : crypto.randomUUID(),
    value,
    source: raw.source === 'suggested' ? 'suggested' : 'manual',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso(),
  };
}

function sanitizeProfile(raw: unknown, fallbackName: string): RedactionProfile | null {
  if (!isObject(raw)) return null;

  const termsRaw = Array.isArray(raw.terms) ? raw.terms : [];
  const terms = dedupeTerms(termsRaw.map(sanitizeTerm).filter((x): x is RedactionTerm => Boolean(x)));

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : crypto.randomUUID(),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : fallbackName,
    terms,
    stripAttachmentBase64: raw.stripAttachmentBase64 !== false,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso(),
  };
}

function readProfilesFromStorage(): RedactionProfile[] {
  if (!hasLocalStorage()) return [];

  try {
    const raw = window.localStorage.getItem(REDACTION_PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const profiles = parsed
      .map((item, index) => sanitizeProfile(item, `Redaction Profile ${index + 1}`))
      .filter((x): x is RedactionProfile => Boolean(x));

    return profiles;
  } catch {
    return [];
  }
}

function readSettingsFromStorage(activeProfileId: string): RedactionSettings {
  if (!hasLocalStorage()) {
    return {
      activeProfileId,
      appliedProfileId: null,
    };
  }

  try {
    const raw = window.localStorage.getItem(REDACTION_SETTINGS_KEY);
    if (!raw) {
      return {
        activeProfileId,
        appliedProfileId: null,
      };
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) {
      return {
        activeProfileId,
        appliedProfileId: null,
      };
    }

    const requestedId = typeof parsed.activeProfileId === 'string' ? parsed.activeProfileId : activeProfileId;
    let appliedProfileId: string | null = null;
    if (typeof parsed.appliedProfileId === 'string') {
      appliedProfileId = parsed.appliedProfileId;
    } else if (parsed.appliedProfileId === null) {
      appliedProfileId = null;
    } else if (isObject(parsed.apply)) {
      // Backward-compat: old per-action toggles imply "apply currently active profile"
      const legacyApply = parsed.apply as Record<string, unknown>;
      const legacyEnabled = Boolean(legacyApply.send || legacyApply.downloadJson || legacyApply.downloadSkill);
      appliedProfileId = legacyEnabled ? requestedId : null;
    }

    return {
      activeProfileId: requestedId,
      appliedProfileId,
    };
  } catch {
    return {
      activeProfileId,
      appliedProfileId: null,
    };
  }
}

function createDefaultProfile(): RedactionProfile {
  const createdAt = nowIso();
  return {
    id: crypto.randomUUID(),
    name: 'Personal Redaction Profile',
    terms: [],
    stripAttachmentBase64: true,
    createdAt,
    updatedAt: createdAt,
  };
}

function ensureValidState(state: RedactionState): RedactionState {
  let profiles = state.profiles.map((profile) =>
    profile.name === 'Default'
      ? { ...profile, name: 'Personal Redaction Profile' }
      : profile
  );
  if (profiles.length === 0) {
    profiles = [createDefaultProfile()];
  }

  const hasActive = profiles.some((profile) => profile.id === state.settings.activeProfileId);
  const activeProfileId = hasActive ? state.settings.activeProfileId : profiles[0].id;
  const appliedProfileId =
    typeof state.settings.appliedProfileId === 'string' &&
    profiles.some((profile) => profile.id === state.settings.appliedProfileId)
      ? state.settings.appliedProfileId
      : null;

  return {
    profiles,
    settings: {
      activeProfileId,
      appliedProfileId,
    },
  };
}

export function loadRedactionState(): RedactionState {
  const profiles = readProfilesFromStorage();
  const initialProfileId = profiles[0]?.id || crypto.randomUUID();
  const settings = readSettingsFromStorage(initialProfileId);
  return ensureValidState({ profiles, settings });
}

export function saveRedactionState(state: RedactionState): void {
  const normalized = ensureValidState(state);
  if (!hasLocalStorage()) return;

  window.localStorage.setItem(REDACTION_PROFILES_KEY, JSON.stringify(normalized.profiles));
  window.localStorage.setItem(REDACTION_SETTINGS_KEY, JSON.stringify(normalized.settings));
}

export function createRedactionProfile(name: string): RedactionProfile {
  const createdAt = nowIso();
  return {
    id: crypto.randomUUID(),
    name: name.trim() || 'Redaction Profile',
    terms: [],
    stripAttachmentBase64: true,
    createdAt,
    updatedAt: createdAt,
  };
}

export function getActiveProfile(state: RedactionState): RedactionProfile {
  return state.profiles.find((profile) => profile.id === state.settings.activeProfileId) ?? state.profiles[0];
}

export function getAppliedProfile(state: RedactionState): RedactionProfile | null {
  if (!state.settings.appliedProfileId) return null;
  const profile = state.profiles.find((item) => item.id === state.settings.appliedProfileId) ?? null;
  if (!profile) return null;
  if (profile.terms.length === 0) return null;
  return profile;
}

export function upsertTerm(
  profile: RedactionProfile,
  value: string,
  source: RedactionTermSource,
): RedactionProfile {
  const trimmed = value.trim();
  if (!trimmed) return profile;

  const key = normalizeTermForCompare(trimmed);
  if (!key) return profile;

  const existing = profile.terms.find((term) => normalizeTermForCompare(term.value) === key);
  if (existing) {
    const existingScore = scoreVariant(existing.value);
    const incomingScore = scoreVariant(trimmed);
    const sourceUpgrade = source === 'manual' && existing.source !== 'manual';
    const shouldReplace =
      sourceUpgrade ||
      incomingScore > existingScore ||
      (incomingScore === existingScore && trimmed.length > existing.value.length);

    if (!shouldReplace) {
      return {
        ...profile,
        updatedAt: nowIso(),
      };
    }

    return {
      ...profile,
      terms: profile.terms.map((term) =>
        term.id === existing.id
          ? { ...term, value: trimmed, source, createdAt: term.createdAt }
          : term
      ),
      updatedAt: nowIso(),
    };
  }

  return {
    ...profile,
    terms: [
      ...profile.terms,
      {
        id: crypto.randomUUID(),
        value: trimmed,
        source,
        createdAt: nowIso(),
      },
    ],
    updatedAt: nowIso(),
  };
}

interface CandidateInfo {
  categories: Set<SuggestedTermCategory>;
  occurrenceCount: number;
  groupHints: Set<string>;
}

type CandidateCategoryMap = Map<string, CandidateInfo>;

const ADDRESS_HINT_RE = /\b(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|court|ct|place|pl|terrace|ter)\b/i;
const IDENTIFIER_LABEL =
  '(?:MRN|Acct|Account|Identifier|Member\\s*(?:ID|Number|No)?|Subscriber\\s*(?:ID|Number|No)?|Policy\\s*(?:ID|Number|No)?|Group\\s*(?:ID|Number|No)?|Claim\\s*(?:ID|Number|No)?|Coverage\\s*(?:ID|Number|No)?)';
const IDENTIFIER_HINT_RE = new RegExp(`\\b${IDENTIFIER_LABEL}\\s*[:#-]?\\s*[A-Z0-9][A-Z0-9-]{3,}\\b`, 'i');
const SSN_RE = /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g;
const PHONE_RE = /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\b/g;
const PHONE_RE_SINGLE = /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}\b/;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const EMAIL_RE_SINGLE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const ID_RE = new RegExp(`\\b${IDENTIFIER_LABEL}\\s*[:#-]?\\s*[A-Z0-9][A-Z0-9-]{3,}\\b`, 'gi');
const DATE_YMD_RE = /\b\d{4}[-./]\d{1,2}[-./]\d{1,2}\b/g;
const DATE_MDY_RE = /\b\d{1,2}[-./]\d{1,2}[-./]\d{4}\b/g;
const FHIR_REFERENCE_RE = /\b[A-Z][A-Za-z]+\/[A-Za-z0-9.-]{2,}\b/g;
const LABELLED_IDENTIFIER_RE = new RegExp(
  `\\b(${IDENTIFIER_LABEL})\\s*[:#-]?\\s*([A-Za-z0-9][A-Za-z0-9_.:-]{3,})\\b`,
  'i',
);

const IDENTIFIER_KEY_HINTS = new Set([
  'id',
  'identifier',
  'subscriberid',
  'memberid',
  'membernumber',
  'policynumber',
  'policyid',
  'groupnumber',
  'groupid',
  'claimnumber',
  'claimid',
  'accountnumber',
  'accountid',
  'coverageid',
  'externalid',
]);

const ADDRESS_FIELD_KEYS = new Set([
  'line',
  'city',
  'district',
  'state',
  'postalCode',
  'country',
  'text',
]);

const ALLOWED_STRUCTURED_SEED_RESOURCE_TYPES = new Set([
  'patient',
  'relatedperson',
]);

const ALLOWED_REFERENCE_RESOURCE_TYPES = new Set([
  'patient',
  'relatedperson',
  'coverage',
  'person',
  'account',
]);

const IDENTIFIER_LABEL_HINT_RE = /\b(id|identifier|member|subscriber|policy|account|claim|coverage|mrn|chart|login)\b/i;
const NON_SENSITIVE_SUGGESTION_KEYS = new Set([
  'use',
  'status',
  'mode',
  'language',
  'gender',
  'code',
  'display',
  'system',
  'unit',
  'version',
  'resourcetype',
]);

function shouldScanResourceTypeForSeeds(resourceType: string): boolean {
  return ALLOWED_STRUCTURED_SEED_RESOURCE_TYPES.has(resourceType.toLowerCase());
}

function shouldSeedReferenceResource(resourceType: string): boolean {
  return ALLOWED_REFERENCE_RESOURCE_TYPES.has(resourceType.toLowerCase());
}

function categorySort(a: SuggestedTermCategory, b: SuggestedTermCategory): number {
  return SUGGESTED_TERM_CATEGORY_ORDER.indexOf(a) - SUGGESTED_TERM_CATEGORY_ORDER.indexOf(b);
}

export function getSuggestedTermCategoryLabel(category: SuggestedTermCategory): string {
  return SUGGESTED_TERM_CATEGORY_LABELS[category];
}

function sortCategories(categories: Iterable<SuggestedTermCategory>): SuggestedTermCategory[] {
  return Array.from(new Set(categories)).sort(categorySort);
}

function scoreSuggestionGroupPriority(group: SuggestedTermGroup): number {
  const hints = new Set(group.groupHints || []);
  const isDobGroup = group.primaryCategory === 'dob' || group.categories.includes('dob');
  if (!isDobGroup) return 0;

  // Patient birth date seeds should surface first.
  if (hints.has('source:patientBirthDate') || hints.has('source:connectionBirthDate')) return 200;
  return 100;
}

function normalizeCandidateValue(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function lettersOnly(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

function wordsOnly(value: string): string[] {
  return value.toLowerCase().match(/[a-z]+/g) || [];
}

function buildNameGroupHintsFromParts(
  givenParts: string[],
  familyPart: string,
  textValue?: string,
): string[] {
  const hints = new Set<string>();
  const firstGiven = lettersOnly(givenParts[0] || '');
  const family = lettersOnly(familyPart);
  if (family.length >= 3 && firstGiven.length >= 2) {
    hints.add(`name:${family}:${firstGiven}`);
    hints.add(`name:${family}:${firstGiven[0]}`);
  }

  if (textValue) {
    const commaNameMatch = textValue.match(/^\s*([A-Za-z]{2,})\s*,\s*([A-Za-z]{1,})\s*$/);
    if (commaNameMatch) {
      const first = wordsOnly(commaNameMatch[2])[0];
      const last = wordsOnly(commaNameMatch[1])[0];
      if (first.length >= 2 && last.length >= 3) {
        hints.add(`name:${last}:${first}`);
        hints.add(`name:${last}:${first[0]}`);
      }
    } else {
      const words = wordsOnly(textValue);
      if (words.length >= 2) {
        const first = words[0];
        const last = words[words.length - 1];
        if (first.length >= 2 && last.length >= 3) {
          hints.add(`name:${last}:${first}`);
          hints.add(`name:${last}:${first[0]}`);
        }
      }
    }
  }

  return Array.from(hints.values());
}

function buildAddressGroupHintsFromParts(
  linePart: string,
  cityPart: string,
  postalPart: string,
  textValue?: string,
): string[] {
  const hints = new Set<string>();

  const lineTokens = normalizeWordTokens(`${linePart} ${textValue || ''}`)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length >= 2);
  const lineKey = lineTokens.join('');
  const cityKey = lettersOnly(cityPart);
  const postalKey = postalPart.replace(/\D/g, '').slice(0, 5);

  if (lineKey.length >= 6) {
    hints.add(`address:${lineKey}`);
    if (cityKey.length >= 4) hints.add(`address:${lineKey}:${cityKey}`);
    if (postalKey.length === 5) hints.add(`address:${lineKey}:${postalKey}`);
  }

  return Array.from(hints.values());
}

function buildDateVariants(value: string): { variants: string[]; hints: string[] } {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return { variants: [normalizeCandidateValue(value)], hints: [] };
  }

  const yyyyMmDd = `${parsed.year}-${parsed.month}-${parsed.day}`;
  const mmDdYyyy = `${parsed.month}/${parsed.day}/${parsed.year}`;
  const mDY = `${Number(parsed.month)}/${Number(parsed.day)}/${parsed.year}`;

  return {
    variants: [yyyyMmDd, mmDdYyyy, mDY],
    hints: [buildDateHint(parsed)],
  };
}

function extractPhoneCore(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 11 && digits.startsWith('1')) return digits.slice(1, 11);
  if (digits.length >= 10) return digits.slice(0, 10);
  return null;
}

function addPhoneVariants(
  candidates: CandidateCategoryMap,
  value: string,
  groupHints: Iterable<string> = [],
): void {
  const hints = new Set<string>(groupHints);
  const core = extractPhoneCore(value);
  if (core) hints.add(`phone:${core}`);

  addCandidateWithCategory(candidates, value, 'phone', hints.values());
  if (!core) return;

  const area = core.slice(0, 3);
  const prefix = core.slice(3, 6);
  const line = core.slice(6);

  addCandidateWithCategory(candidates, `${area}-${prefix}-${line}`, 'phone', hints.values());
  addCandidateWithCategory(candidates, `(${area}) ${prefix}-${line}`, 'phone', hints.values());
  addCandidateWithCategory(candidates, `+1 ${area}-${prefix}-${line}`, 'phone', hints.values());
}

function normalizeEmailAlias(localPartRaw: string, domainRaw: string): string {
  const localPart = localPartRaw.toLowerCase();
  const domain = domainRaw.toLowerCase();
  const [withoutPlus] = localPart.split('+', 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return withoutPlus.replace(/\./g, '');
  }
  return withoutPlus;
}

function addEmailVariants(
  candidates: CandidateCategoryMap,
  value: string,
  groupHints: Iterable<string> = [],
): void {
  const trimmed = normalizeCandidateValue(value);
  const match = trimmed.match(/^([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})$/i);
  if (!match) {
    addCandidateWithCategory(candidates, trimmed, 'email', groupHints);
    return;
  }

  const localPart = match[1];
  const domain = match[2].toLowerCase();
  const alias = normalizeEmailAlias(localPart, domain);
  const hints = new Set<string>(groupHints);
  hints.add(`email:${domain}:${alias}`);

  addCandidateWithCategory(candidates, `${localPart}@${domain}`, 'email', hints.values());
  addCandidateWithCategory(candidates, `${localPart.toLowerCase()}@${domain}`, 'email', hints.values());
  if (alias && alias !== localPart.toLowerCase()) {
    addCandidateWithCategory(candidates, `${alias}@${domain}`, 'email', hints.values());
  }
}

function isLikelyIdentifierValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length < 4 || trimmed.length > 64) return false;
  if (/\s/.test(trimmed)) return false;
  if (PHONE_RE_SINGLE.test(trimmed)) return false;
  if (EMAIL_RE_SINGLE.test(trimmed)) return false;
  if (parseDateValue(trimmed)) return false;
  if (!/^[A-Za-z0-9_.:-]+$/.test(trimmed)) return false;

  const hasDigit = /\d/.test(trimmed);
  const hasUpper = /[A-Z]/.test(trimmed);
  const hasLower = /[a-z]/.test(trimmed);
  const hasSeparator = /[-_.:]/.test(trimmed);

  if (!hasDigit) {
    if (!hasUpper) return false;
    if (/^[A-Za-z]+$/.test(trimmed)) {
      // Avoid ordinary words/labels while allowing strongly code-like uppercase IDs.
      if (trimmed !== trimmed.toUpperCase() || trimmed.length < 6) return false;
    } else if (!hasSeparator) {
      return false;
    }
  }

  const compact = trimmed.replace(/[-_.:]/g, '');
  const separatorCount = (trimmed.match(/[-_.:]/g) || []).length;
  const hasMixedCase = hasLower && hasUpper;
  if (
    compact.length >= 20 &&
    separatorCount <= 1 &&
    hasMixedCase &&
    /^[A-Za-z0-9_-]+$/.test(trimmed)
  ) {
    // Suppress likely opaque internal tokens (high-entropy base64/urlsafe IDs).
    return false;
  }

  return true;
}

function normalizePathKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function pathContainsKey(path: string[], rawKey: string): boolean {
  const target = normalizePathKey(rawKey);
  return path.some((key) => normalizePathKey(key) === target);
}

function pathIncludesNameContext(path: string[]): boolean {
  return path.some((segment) => {
    const normalized = normalizePathKey(segment);
    return normalized === 'name' || normalized.endsWith('name');
  });
}

function pathIncludesAddressContext(path: string[]): boolean {
  return path.some((segment) => {
    const normalized = normalizePathKey(segment);
    return normalized === 'address' || normalized.endsWith('address');
  });
}

function pathIncludesIdentifierContext(path: string[]): boolean {
  return path.some((segment) => {
    const normalized = normalizePathKey(segment);
    return (
      IDENTIFIER_KEY_HINTS.has(normalized) ||
      normalized.endsWith('identifier') ||
      normalized.endsWith('id') ||
      normalized.endsWith('number')
    );
  });
}

function pathIncludesTelecomContext(path: string[]): boolean {
  return path.some((segment) => {
    const normalized = normalizePathKey(segment);
    return normalized === 'telecom' || normalized.endsWith('telecom');
  });
}

function shouldIgnoreSuggestionPath(path: string[]): boolean {
  if (path.length === 0) return false;
  const normalized = path.map((segment) => normalizePathKey(segment));
  const last = normalized[normalized.length - 1];
  if (NON_SENSITIVE_SUGGESTION_KEYS.has(last)) return true;

  // Coding values are often vocabulary metadata, not user identity terms.
  if (
    normalized.includes('coding') &&
    (last === 'code' || last === 'display' || last === 'system' || last === 'version')
  ) {
    return true;
  }

  return false;
}

function collectReferenceParts(reference: string): { raw: string; resource: string; id: string } | null {
  const trimmed = reference.trim();
  const match = trimmed.match(/^([A-Z][A-Za-z]+)\/([A-Za-z0-9.-]{2,})$/);
  if (!match) return null;
  return {
    raw: trimmed,
    resource: match[1],
    id: match[2],
  };
}

function parseLabeledIdentifier(match: string): { label: string; value: string } | null {
  const parsed = match.match(LABELLED_IDENTIFIER_RE);
  if (!parsed) return null;
  return {
    label: normalizeCandidateValue(parsed[1]),
    value: normalizeCandidateValue(parsed[2]),
  };
}

function inferCategoryFromValue(value: string, fallback: SuggestedTermCategory = 'other'): SuggestedTermCategory {
  const trimmed = normalizeCandidateValue(value);
  if (!trimmed) return fallback;

  const canonical = canonicalTermKey(trimmed);
  if (canonical.startsWith('dob:')) return 'dob';
  if (canonical.startsWith('email:')) return 'email';
  if (canonical.startsWith('phone:')) return 'phone';
  if (canonical.startsWith('ssn:')) return 'ssn';

  if (IDENTIFIER_HINT_RE.test(trimmed)) return 'identifier';

  const hasZipLike = /\b\d{5}(?:-\d{4})?\b/.test(trimmed);
  const hasAddressStructure = /,/.test(trimmed) || /\b\d{1,6}\s+[A-Za-z]/.test(trimmed);
  if (ADDRESS_HINT_RE.test(trimmed) || (hasZipLike && hasAddressStructure)) return 'address';

  const looksLikeCommaName = /^[A-Za-z]{2,}\s*,\s*[A-Za-z]{1,}/.test(trimmed);
  const words = trimmed.match(/[A-Za-z]+/g) || [];
  if (!/\d/.test(trimmed) && (looksLikeCommaName || words.length >= 2)) return 'name';

  if (/^[A-Z0-9-]{5,}$/i.test(trimmed) && /\d/.test(trimmed)) return 'identifier';
  return fallback;
}

function addCandidate(
  candidates: CandidateCategoryMap,
  value: string | null | undefined,
  categories: Iterable<SuggestedTermCategory>,
  groupHints: Iterable<string> = [],
): void {
  if (!value) return;
  const trimmed = normalizeCandidateValue(value);
  if (!trimmed) return;
  const key = canonicalTermKey(trimmed);
  if (!key) return;
  const valuePortion = key.replace(/^[a-z]+:/, '');
  if (valuePortion.length < 4) return;

  if (!candidates.has(trimmed)) {
    candidates.set(trimmed, {
      categories: new Set<SuggestedTermCategory>(),
      occurrenceCount: 0,
      groupHints: new Set<string>(),
    });
  }
  const info = candidates.get(trimmed)!;
  info.occurrenceCount += 1;
  for (const category of categories) {
    info.categories.add(category);
  }
  for (const hint of groupHints) {
    if (hint) info.groupHints.add(hint);
  }
}

function addCandidateWithCategory(
  candidates: CandidateCategoryMap,
  value: string | null | undefined,
  category: SuggestedTermCategory,
  groupHints: Iterable<string> = [],
): void {
  addCandidate(candidates, value, [category], groupHints);
}

function mergeCandidateMaps(target: CandidateCategoryMap, incoming: CandidateCategoryMap): CandidateCategoryMap {
  for (const [value, info] of incoming.entries()) {
    if (!target.has(value)) {
      target.set(value, {
        categories: new Set<SuggestedTermCategory>(),
        occurrenceCount: 0,
        groupHints: new Set<string>(),
      });
    }
    const out = target.get(value)!;
    for (const category of info.categories) out.categories.add(category);
    out.occurrenceCount += info.occurrenceCount;
    for (const hint of info.groupHints) out.groupHints.add(hint);
  }
  return target;
}

function addDateVariants(
  candidates: CandidateCategoryMap,
  value: string,
  groupHints: Iterable<string> = [],
): void {
  const built = buildDateVariants(value);
  const hints = new Set<string>([...groupHints, ...built.hints]);
  for (const variant of built.variants) {
    addCandidateWithCategory(candidates, variant, 'dob', hints.values());
  }
}

function isHumanNameLikeObject(value: Record<string, unknown>, path: string[]): boolean {
  const hasExplicitNameParts =
    typeof value.family === 'string' ||
    Array.isArray(value.given) ||
    Array.isArray(value.prefix) ||
    Array.isArray(value.suffix);

  if (hasExplicitNameParts) return true;
  if (typeof value.text !== 'string') return false;
  return pathIncludesNameContext(path);
}

function isAddressLikeObject(value: Record<string, unknown>, path: string[]): boolean {
  let signalCount = 0;
  if (Array.isArray(value.line) || typeof value.line === 'string') signalCount += 1;
  if (typeof value.city === 'string') signalCount += 1;
  if (typeof value.state === 'string') signalCount += 1;
  if (typeof value.district === 'string') signalCount += 1;
  if (typeof value.postalCode === 'string') signalCount += 1;
  if (typeof value.country === 'string') signalCount += 1;

  if (signalCount >= 2) return true;
  if (signalCount >= 1 && pathIncludesAddressContext(path)) return true;
  return false;
}

function isIdentifierLikeObject(value: Record<string, unknown>, path: string[]): boolean {
  if (typeof value.value !== 'string') return false;
  if (!isLikelyIdentifierValue(value.value)) return false;

  return (
    pathIncludesIdentifierContext(path) ||
    typeof value.system === 'string' ||
    typeof value.use === 'string' ||
    isObject(value.type) ||
    isObject(value.assigner)
  );
}

function isContactPointLikeObject(value: Record<string, unknown>, path: string[]): boolean {
  if (typeof value.system !== 'string' || typeof value.value !== 'string') return false;
  if (!pathIncludesTelecomContext(path)) return false;
  const system = value.system.toLowerCase();
  return (
    system === 'phone' ||
    system === 'fax' ||
    system === 'email' ||
    system === 'sms' ||
    system === 'pager' ||
    system === 'url' ||
    system === 'other'
  );
}

function seedNameObject(
  candidates: CandidateCategoryMap,
  value: Record<string, unknown>,
  inheritedHints: Iterable<string> = [],
): void {
  const given = Array.isArray(value.given)
    ? value.given.filter((item: unknown): item is string => typeof item === 'string')
    : [];
  const family = typeof value.family === 'string' ? value.family : '';
  const text = typeof value.text === 'string' ? value.text : '';
  const hints = new Set<string>([...inheritedHints, ...buildNameGroupHintsFromParts(given, family, text)]);

  if (text) addCandidateWithCategory(candidates, text, 'name', hints.values());
  if (given.length || family) {
    addCandidateWithCategory(candidates, `${given.join(' ')} ${family}`.trim(), 'name', hints.values());
    addCandidateWithCategory(candidates, `${family}, ${given.join(' ')}`.trim(), 'name', hints.values());
  }
  for (const givenPart of given) {
    addCandidateWithCategory(candidates, givenPart, 'name', hints.values());
  }
  if (family) {
    addCandidateWithCategory(candidates, family, 'name', hints.values());
  }
}

function seedAddressObject(
  candidates: CandidateCategoryMap,
  value: Record<string, unknown>,
  inheritedHints: Iterable<string> = [],
): void {
  const text = typeof value.text === 'string' ? value.text : '';
  const line = Array.isArray(value.line)
    ? value.line.filter((item: unknown): item is string => typeof item === 'string').join(' ')
    : typeof value.line === 'string'
      ? value.line
      : '';
  const city = typeof value.city === 'string' ? value.city : '';
  const state = typeof value.state === 'string' ? value.state : '';
  const postalCode = typeof value.postalCode === 'string' ? value.postalCode : '';
  const textLooksGranular =
    Boolean(text) &&
    (/\d/.test(text) || ADDRESS_HINT_RE.test(text) || (/,/.test(text) && (wordsOnly(text).length >= 3)));
  const hasFineGrainedPart = Boolean(line || city || postalCode || textLooksGranular);
  if (!hasFineGrainedPart) return;

  const hints = new Set<string>([
    ...inheritedHints,
    ...buildAddressGroupHintsFromParts(line, city, postalCode, text),
  ]);

  const mergedParts: string[] = [];
  if (line) mergedParts.push(line);
  if (city) mergedParts.push(city);
  if ((line || city || postalCode) && state) mergedParts.push(state);
  if (postalCode) mergedParts.push(postalCode);
  const merged = mergedParts.join(', ');
  addCandidateWithCategory(candidates, merged, 'address', hints.values());
  addCandidateWithCategory(candidates, line, 'address', hints.values());
  addCandidateWithCategory(candidates, city, 'address', hints.values());
  addCandidateWithCategory(candidates, postalCode, 'address', hints.values());
  if (textLooksGranular) {
    addCandidateWithCategory(candidates, text, 'address', hints.values());
  }
}

function extractIdentifierTypeLabels(value: Record<string, unknown>): string[] {
  const labels = new Set<string>();
  const type = value.type;
  if (!isObject(type)) return [];

  const maybeAddLabel = (raw: string): void => {
    const label = normalizeCandidateValue(raw);
    if (!label) return;
    if (!IDENTIFIER_LABEL_HINT_RE.test(label)) return;
    labels.add(label);
  };

  if (typeof type.text === 'string') maybeAddLabel(type.text);
  if (Array.isArray(type.coding)) {
    for (const coding of type.coding) {
      if (!isObject(coding)) continue;
      if (typeof coding.display === 'string') maybeAddLabel(coding.display);
    }
  }

  return Array.from(labels.values());
}

function addIdentifierCandidate(
  candidates: CandidateCategoryMap,
  value: string,
  groupHints: Iterable<string> = [],
  labels: string[] = [],
  category: SuggestedTermCategory = 'identifier',
): void {
  const trimmed = normalizeCandidateValue(value);
  if (!isLikelyIdentifierValue(trimmed)) return;

  const compact = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hints = new Set<string>(groupHints);
  if (compact.length >= 4) hints.add(`identifier:${compact}`);
  addCandidateWithCategory(candidates, trimmed, category, hints.values());

  for (const label of labels) {
    const labelTrimmed = normalizeCandidateValue(label);
    if (!labelTrimmed) continue;
    addCandidateWithCategory(candidates, `${labelTrimmed}: ${trimmed}`, category, hints.values());
  }
}

function seedIdentifierObject(
  candidates: CandidateCategoryMap,
  value: Record<string, unknown>,
  inheritedHints: Iterable<string> = [],
): void {
  const labels = extractIdentifierTypeLabels(value);
  const system = typeof value.system === 'string' ? value.system : '';
  const isSsnIdentifier = /(?:^|\/)us-ssn$/i.test(system) || system.toLowerCase().includes('us-ssn');
  const category: SuggestedTermCategory = isSsnIdentifier ? 'ssn' : 'identifier';
  const hints = new Set<string>(inheritedHints);
  if (system) hints.add(`id-system:${system.toLowerCase()}`);

  if (typeof value.value === 'string') {
    addIdentifierCandidate(candidates, value.value, hints.values(), labels, category);
  }
}

function seedContactPointObject(
  candidates: CandidateCategoryMap,
  value: Record<string, unknown>,
  inheritedHints: Iterable<string> = [],
): void {
  const system = typeof value.system === 'string' ? value.system.toLowerCase() : '';
  const raw = typeof value.value === 'string' ? value.value : '';
  if (!raw) return;

  if (system === 'phone' || system === 'fax') {
    addPhoneVariants(candidates, raw, inheritedHints);
    return;
  }

  if (system === 'email') {
    addEmailVariants(candidates, raw, inheritedHints);
    return;
  }

  addCandidateWithCategory(candidates, raw, inferCategoryFromValue(raw, 'identifier'), inheritedHints);
}

function seedReferenceString(
  candidates: CandidateCategoryMap,
  value: string,
  inheritedHints: Iterable<string> = [],
): void {
  const ref = collectReferenceParts(value);
  if (!ref) return;
  if (!shouldSeedReferenceResource(ref.resource)) return;
  if (!isLikelyIdentifierValue(ref.id)) return;

  const idKey = ref.id.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hints = new Set<string>(inheritedHints);
  if (idKey.length >= 3) {
    hints.add(`reference:${ref.resource.toLowerCase()}:${idKey}`);
    hints.add(`identifier:${idKey}`);
  }

  addCandidateWithCategory(candidates, ref.raw, 'identifier', hints.values());
  addIdentifierCandidate(candidates, ref.id, hints.values(), [`${ref.resource} reference`], 'identifier');
}

function extractSensitiveSeeds(
  value: unknown,
  candidates: CandidateCategoryMap,
  path: string[] = [],
  depth = 0,
): void {
  if (depth > 16) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      extractSensitiveSeeds(item, candidates, path, depth + 1);
    }
    return;
  }

  if (!isObject(value)) return;

  if (isHumanNameLikeObject(value, path)) seedNameObject(candidates, value);
  if (isAddressLikeObject(value, path)) seedAddressObject(candidates, value);
  if (isIdentifierLikeObject(value, path)) seedIdentifierObject(candidates, value);
  if (isContactPointLikeObject(value, path)) seedContactPointObject(candidates, value);

  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = normalizePathKey(key);
    const nextPath = [...path, key];
    if (shouldIgnoreSuggestionPath(nextPath) && typeof entry === 'string') continue;

    if (typeof entry === 'string') {
      if (normalizedKey === 'reference') {
        seedReferenceString(candidates, entry);
      }

      if (normalizedKey.includes('birthdate') || normalizedKey === 'birthdate') {
        const hints = ['source:birthDate'];
        if (path[0]?.toLowerCase() === 'patient') hints.push('source:patientBirthDate');
        addDateVariants(candidates, entry, hints);
      }

      if (normalizedKey.includes('phone') || normalizedKey.includes('fax')) {
        addPhoneVariants(candidates, entry);
      } else if (normalizedKey.includes('email')) {
        addEmailVariants(candidates, entry);
      }

      if (
        IDENTIFIER_KEY_HINTS.has(normalizedKey) ||
        normalizedKey.endsWith('identifier') ||
        normalizedKey.endsWith('id') ||
        normalizedKey.endsWith('number')
      ) {
        addIdentifierCandidate(candidates, entry, [`source:${normalizedKey}`], [key], 'identifier');
      }

      if (normalizedKey.includes('address') && !pathContainsKey(path, 'country')) {
        addCandidateWithCategory(candidates, entry, 'address', [`source:${normalizedKey}`]);
      }

      continue;
    }

    extractSensitiveSeeds(entry, candidates, nextPath, depth + 1);
  }
}

function collectPatternMatches(text: string, candidates: CandidateCategoryMap): void {
  const ssnMatches = text.match(SSN_RE) || [];
  const phoneMatches = text.match(PHONE_RE) || [];
  const emailMatches = text.match(EMAIL_RE) || [];
  const idMatches = text.match(ID_RE) || [];
  const ymdDates = text.match(DATE_YMD_RE) || [];
  const mdyDates = text.match(DATE_MDY_RE) || [];
  const refs = text.match(FHIR_REFERENCE_RE) || [];

  for (const match of ssnMatches) addCandidateWithCategory(candidates, match, 'ssn');
  for (const match of phoneMatches) addPhoneVariants(candidates, match);
  for (const match of emailMatches) addEmailVariants(candidates, match);
  for (const match of idMatches) {
    const parsed = parseLabeledIdentifier(match);
    if (!parsed) continue;
    addIdentifierCandidate(candidates, parsed.value, ['source:attachmentLabel'], [parsed.label], 'identifier');
  }
  for (const date of ymdDates) addDateVariants(candidates, date);
  for (const date of mdyDates) addDateVariants(candidates, date);
  for (const ref of refs) seedReferenceString(candidates, ref);
}

function scoreVariant(variant: string): number {
  const trimmed = variant.trim();
  const tokens = normalizeWordTokens(trimmed);
  const letters = (trimmed.match(/[A-Za-z]/g) || []).length;
  const cleanChars = (trimmed.match(/[A-Za-z0-9 ]/g) || []).length;
  const specialChars = Math.max(0, trimmed.length - cleanChars);
  const isEmail = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(trimmed);
  const looksLikeCommaName = /^[A-Za-z]{2,}\s*,\s*[A-Za-z]{1,}/.test(trimmed);
  const words = trimmed.match(/[A-Za-z]+/g) || [];
  const looksLikeName = !isEmail && !/\d/.test(trimmed) && (words.length >= 2 || looksLikeCommaName);

  let score = 0;
  // Favor richer text while ignoring punctuation-heavy length inflation.
  score += letters;
  score += tokens.length * 4;
  score += cleanChars * 0.12;
  score -= specialChars * 1.8;

  if (looksLikeName) score += 10;
  if (looksLikeCommaName) score += 2;
  if (isEmail) score -= 12;

  return score;
}

function isLabelPrefixedVariant(variant: string): boolean {
  return /^[A-Za-z][A-Za-z0-9 _-]{2,32}\s*:\s*\S+/.test(variant.trim());
}

function scoreVariantForCategory(variant: string, category: SuggestedTermCategory): number {
  const trimmed = normalizeCandidateValue(variant);
  const base = scoreVariant(trimmed);
  const isEmail = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(trimmed);
  const looksLikeCommaName = /^[A-Za-z]{2,}\s*,\s*[A-Za-z]{1,}/.test(trimmed);
  const words = trimmed.match(/[A-Za-z]+/g) || [];
  const looksLikeName = !/\d/.test(trimmed) && (looksLikeCommaName || words.length >= 2);
  const isLabelPrefixed = isLabelPrefixedVariant(trimmed);

  let score = base;

  if (category === 'name') {
    if (looksLikeName) score += 12;
    if (looksLikeCommaName) score += 6;
    if (isEmail) score -= 28;
    if (isLabelPrefixed) score -= 32;
    if (/^[A-Z]{4,}$/.test(trimmed)) score -= 10;
    if (/^[A-Z]{2,}[A-Z0-9]*$/.test(trimmed) && words.length === 1) score -= 6;
  } else if (category === 'address') {
    if (/\b\d{1,6}\s+[A-Za-z]/.test(trimmed)) score += 10;
    if (ADDRESS_HINT_RE.test(trimmed)) score += 6;
    if (isLabelPrefixed) score -= 10;
  } else if (category === 'identifier' || category === 'ssn') {
    if (isLabelPrefixed) score -= 4;
    if (/^[A-Za-z0-9_.:-]{4,}$/.test(trimmed)) score += 6;
  }

  return score;
}

function extractLetters(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

function buildNameAliasKey(firstRaw: string, lastRaw: string): string | null {
  const first = extractLetters(firstRaw);
  const last = extractLetters(lastRaw);
  if (!first || last.length < 4) return null;
  return `name:${last}:${first[0]}`;
}

function parseHandleAsNameAlias(handleRaw: string): string | null {
  const handle = handleRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!/^[a-z][a-z]{4,}$/.test(handle)) return null;
  return buildNameAliasKey(handle[0], handle.slice(1));
}

function extractIdentityAliasKeys(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const keys = new Set<string>();

  const emailMatch = trimmed.match(/^([A-Z0-9._%+-]+)@[A-Z0-9.-]+\.[A-Z]{2,}$/i);
  if (emailMatch) {
    const localPart = emailMatch[1].toLowerCase();
    const localCompact = localPart.replace(/[^a-z0-9]/g, '');
    if (localCompact.length >= 4 && /[a-z]/.test(localCompact)) {
      keys.add(`handle:${localCompact}`);
      const alias = parseHandleAsNameAlias(localCompact);
      if (alias) keys.add(alias);
    }

    const localTokens = localPart.split(/[^a-z0-9]+/g).filter(Boolean);
    if (localTokens.length >= 2) {
      const first = localTokens[0];
      const last = localTokens[localTokens.length - 1];
      if (first && last) {
        const alias = buildNameAliasKey(first, last);
        if (alias) keys.add(alias);
      }
    }
  }

  const commaNameMatch = trimmed.match(/^\s*([A-Za-z]{2,})\s*,\s*([A-Za-z]{1,})\s*$/);
  if (commaNameMatch) {
    const alias = buildNameAliasKey(commaNameMatch[2], commaNameMatch[1]);
    if (alias) keys.add(alias);
  }

  if (!/\d/.test(trimmed)) {
    const words = trimmed.match(/[A-Za-z]+/g) || [];
    if (words.length >= 2) {
      const first = words[0];
      const last = words[words.length - 1];
      if (first && last) {
        const alias = buildNameAliasKey(first, last);
        if (alias) keys.add(alias);
      }
    }
  }

  return Array.from(keys.values());
}

function findParent(parents: Map<string, string>, key: string): string {
  let current = key;
  while (parents.get(current) && parents.get(current) !== current) {
    current = parents.get(current)!;
  }

  let walker = key;
  while (parents.get(walker) && parents.get(walker) !== current) {
    const next = parents.get(walker)!;
    parents.set(walker, current);
    walker = next;
  }

  return current;
}

function unionParents(parents: Map<string, string>, a: string, b: string): void {
  const rootA = findParent(parents, a);
  const rootB = findParent(parents, b);
  if (rootA === rootB) return;
  if (rootA < rootB) {
    parents.set(rootB, rootA);
  } else {
    parents.set(rootA, rootB);
  }
}

function mergeGroupsByIdentityAlias(groups: SuggestedTermGroup[]): SuggestedTermGroup[] {
  if (groups.length <= 1) return groups;

  const parents = new Map<string, string>();
  for (const group of groups) {
    parents.set(group.key, group.key);
  }

  const aliasBuckets = new Map<string, Set<string>>();
  const hintBuckets = new Map<string, Set<string>>();
  const hasCompositeNameSignal = (group: SuggestedTermGroup): boolean => {
    return group.variants.some((variant) => {
      if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(variant)) return true;
      if (/^[A-Za-z]{2,}\s*,\s*[A-Za-z]{1,}/.test(variant)) return true;
      const words = variant.match(/[A-Za-z]+/g) || [];
      return words.length >= 2;
    });
  };
  const singleWordValue = (group: SuggestedTermGroup): string | null => {
    const token = (group.primary.match(/[A-Za-z]+/g) || [])[0]?.toLowerCase() || '';
    if (!token) return null;
    const primaryWords = group.primary.match(/[A-Za-z]+/g) || [];
    if (primaryWords.length !== 1) return null;
    return token;
  };
  const parseNameHint = (hint: string): { last: string; first: string } | null => {
    const match = hint.match(/^name:([a-z]+):([a-z]+)$/);
    if (!match) return null;
    return { last: match[1], first: match[2] };
  };
  const shouldMergeOnHint = (hint: string): boolean => {
    if (
      hint.startsWith('name:') ||
      hint.startsWith('address:') ||
      hint.startsWith('phone:') ||
      hint.startsWith('email:') ||
      hint.startsWith('dob:') ||
      hint.startsWith('handle:')
    ) {
      return true;
    }
    if (hint.startsWith('identifier:')) {
      const key = hint.slice('identifier:'.length);
      return key.length >= 6;
    }
    return false;
  };
  const extractNameWords = (value: string): string[] => {
    return (value.match(/[A-Za-z]+/g) || [])
      .map((word) => word.toLowerCase())
      .filter((word) => word.length >= 2);
  };
  const compositeWordsByNameHint = new Map<string, Set<string>>();

  for (const group of groups) {
    if (!hasCompositeNameSignal(group)) continue;
    const words = new Set<string>();
    for (const variant of group.variants) {
      for (const word of extractNameWords(variant)) {
        words.add(word);
      }
    }
    if (words.size === 0) continue;
    for (const hint of group.groupHints || []) {
      if (!hint.startsWith('name:')) continue;
      if (!compositeWordsByNameHint.has(hint)) {
        compositeWordsByNameHint.set(hint, new Set<string>());
      }
      const bucket = compositeWordsByNameHint.get(hint)!;
      for (const word of words) {
        bucket.add(word);
      }
    }
  }

  for (const group of groups) {
    const aliases = new Set<string>();
    for (const variant of group.variants) {
      for (const alias of extractIdentityAliasKeys(variant)) {
        aliases.add(alias);
      }
    }
    for (const alias of aliases) {
      if (!aliasBuckets.has(alias)) aliasBuckets.set(alias, new Set<string>());
      aliasBuckets.get(alias)!.add(group.key);
    }

    for (const hint of group.groupHints || []) {
      if (!shouldMergeOnHint(hint)) continue;
      if (hint.startsWith('name:') && !hasCompositeNameSignal(group)) {
        const parsed = parseNameHint(hint);
        const word = singleWordValue(group);
        if (!parsed || !word) continue;
        // Avoid surname-only bridges (e.g., "Mandel") that collapse family members.
        if (word === parsed.last) continue;
        // Allow first-name and middle-name tokens to rejoin matching full-name groups.
        const compositeWords = compositeWordsByNameHint.get(hint);
        const appearsInComposite = Boolean(compositeWords && compositeWords.has(word));
        if (!appearsInComposite && !parsed.first.startsWith(word[0])) continue;
      }
      if (!hintBuckets.has(hint)) hintBuckets.set(hint, new Set<string>());
      hintBuckets.get(hint)!.add(group.key);
    }
  }

  for (const groupKeys of aliasBuckets.values()) {
    const keys = Array.from(groupKeys.values());
    if (keys.length < 2) continue;
    if (keys.length > 8) continue;
    const anchor = keys[0];
    for (let i = 1; i < keys.length; i += 1) {
      unionParents(parents, anchor, keys[i]);
    }
  }

  for (const groupKeys of hintBuckets.values()) {
    const keys = Array.from(groupKeys.values());
    if (keys.length < 2) continue;
    const anchor = keys[0];
    for (let i = 1; i < keys.length; i += 1) {
      unionParents(parents, anchor, keys[i]);
    }
  }

  const merged = new Map<string, Set<string>>();
  const mergedKeys = new Map<string, string[]>();
  const mergedCategories = new Map<string, Set<SuggestedTermCategory>>();
  const mergedOccurrences = new Map<string, number>();
  const mergedHints = new Map<string, Set<string>>();
  for (const group of groups) {
    const root = findParent(parents, group.key);
    if (!merged.has(root)) merged.set(root, new Set<string>());
    if (!mergedKeys.has(root)) mergedKeys.set(root, []);
    if (!mergedCategories.has(root)) mergedCategories.set(root, new Set<SuggestedTermCategory>());
    if (!mergedOccurrences.has(root)) mergedOccurrences.set(root, 0);
    if (!mergedHints.has(root)) mergedHints.set(root, new Set<string>());
    for (const variant of group.variants) {
      merged.get(root)!.add(variant);
    }
    for (const category of group.categories) {
      mergedCategories.get(root)!.add(category);
    }
    mergedOccurrences.set(root, (mergedOccurrences.get(root) || 0) + group.occurrenceCount);
    for (const hint of group.groupHints || []) {
      mergedHints.get(root)!.add(hint);
    }
    mergedKeys.get(root)!.push(group.key);
  }

  const out: SuggestedTermGroup[] = [];
  for (const [root, variantsSet] of merged.entries()) {
    const variants = Array.from(variantsSet.values()).filter(Boolean);
    if (variants.length === 0) continue;
    const categorySet = mergedCategories.get(root) || new Set<SuggestedTermCategory>();
    if (categorySet.size === 0) {
      for (const variant of variants) {
        categorySet.add(inferCategoryFromValue(variant, 'other'));
      }
    }
    const categories = sortCategories(categorySet.values());
    const primaryCategory = categories[0] || 'other';
    variants.sort(
      (a, b) =>
        scoreVariantForCategory(b, primaryCategory) - scoreVariantForCategory(a, primaryCategory) ||
        a.localeCompare(b),
    );
    const keys = (mergedKeys.get(root) || [root]).slice().sort();
    out.push({
      key: keys.join('+'),
      primary: variants[0],
      variants,
      categories,
      primaryCategory,
      occurrenceCount: mergedOccurrences.get(root) || 0,
      groupHints: Array.from(mergedHints.get(root) || []),
    });
  }

  return out;
}

function groupSuggestedTerms(candidates: CandidateCategoryMap, maxGroups: number): SuggestedTermGroup[] {
  const grouped = new Map<string, { variants: Set<string>; categories: Set<SuggestedTermCategory>; occurrenceCount: number; groupHints: Set<string> }>();

  for (const [candidate, info] of candidates.entries()) {
    const key = canonicalTermKey(candidate);
    if (!key) continue;
    if (!grouped.has(key)) {
      grouped.set(key, {
        variants: new Set<string>(),
        categories: new Set<SuggestedTermCategory>(),
        occurrenceCount: 0,
        groupHints: new Set<string>(),
      });
    }
    const bucket = grouped.get(key)!;
    bucket.variants.add(candidate.trim());
    bucket.occurrenceCount += info.occurrenceCount;
    for (const category of info.categories) {
      bucket.categories.add(category);
    }
    for (const hint of info.groupHints) {
      bucket.groupHints.add(hint);
    }
  }

  const groups: SuggestedTermGroup[] = [];
  for (const [key, group] of grouped.entries()) {
    const variants = Array.from(group.variants).filter(Boolean);
    if (variants.length === 0) continue;
    if (group.categories.size === 0) {
      for (const variant of variants) {
        group.categories.add(inferCategoryFromValue(variant, 'other'));
      }
    }
    const categories = sortCategories(group.categories.values());
    const primaryCategory = categories[0] || 'other';
    variants.sort(
      (a, b) =>
        scoreVariantForCategory(b, primaryCategory) - scoreVariantForCategory(a, primaryCategory) ||
        a.localeCompare(b),
    );
    const primary = variants[0];
    groups.push({
      key,
      primary,
      variants,
      categories,
      primaryCategory,
      occurrenceCount: group.occurrenceCount,
      groupHints: Array.from(group.groupHints.values()),
    });
  }

  const mergedGroups = mergeGroupsByIdentityAlias(groups);

  mergedGroups.sort((a, b) => {
    const priorityDiff = scoreSuggestionGroupPriority(b) - scoreSuggestionGroupPriority(a);
    if (priorityDiff !== 0) return priorityDiff;
    if (b.variants.length !== a.variants.length) return b.variants.length - a.variants.length;
    if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
    return a.primary.localeCompare(b.primary);
  });

  return mergedGroups.slice(0, maxGroups);
}

function isLikelyNarrativeString(value: string): boolean {
  const trimmed = normalizeCandidateValue(value);
  if (trimmed.length < 24) return false;
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return false;
  return /[\s,.;:()[\]{}]/.test(trimmed);
}

function shouldIncludeStringForFuzzyScan(path: string[], value: string): boolean {
  if (shouldIgnoreSuggestionPath(path)) return false;
  if (isAttachmentPlaintextPath(path)) return true;
  if (
    pathIncludesNameContext(path) ||
    pathIncludesAddressContext(path) ||
    pathIncludesIdentifierContext(path) ||
    pathIncludesTelecomContext(path) ||
    pathContainsKey(path, 'reference') ||
    pathContainsKey(path, 'birthDate')
  ) {
    return true;
  }
  return isLikelyNarrativeString(value);
}

function collectStringValues(
  value: unknown,
  out: string[],
  maxCount: number,
  maxLength: number,
  path: string[] = [],
): void {
  if (out.length >= maxCount) return;

  if (typeof value === 'string') {
    const trimmed = normalizeCandidateValue(value);
    if (trimmed && shouldIncludeStringForFuzzyScan(path, trimmed)) {
      out.push(trimmed.slice(0, maxLength));
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (out.length >= maxCount) break;
      collectStringValues(item, out, maxCount, maxLength, path);
    }
    return;
  }

  if (!isObject(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (out.length >= maxCount) break;
    const nextPath = [...path, key];
    if (normalizePathKey(key) === 'contentbase64' && typeof entry === 'string') continue;
    if (shouldIgnoreSuggestionPath(nextPath) && typeof entry === 'string') continue;
    collectStringValues(entry, out, maxCount, maxLength, nextPath);
  }
}

function scanFuzzyVariantsFromRecords(records: RedactionRecordInput[], seeds: SuggestedTermGroup[]): CandidateCategoryMap {
  const discovered: CandidateCategoryMap = new Map();
  const compiledSeeds = seeds
    .map((group) => {
      const regex = buildFlexibleRegex(group.primary);
      if (!regex) return null;
      const category = group.primaryCategory || group.categories[0] || 'other';
      return {
        regex,
        category,
        groupHints: new Set<string>(group.groupHints || []),
        matches: 0,
      };
    })
    .filter((x): x is { regex: RegExp; category: SuggestedTermCategory; groupHints: Set<string>; matches: number } => Boolean(x));

  if (compiledSeeds.length === 0) return discovered;

  const texts: string[] = [];
  for (const record of records) {
    if (texts.length >= 4000) break;
    collectStringValues(record.data.fhir, texts, 4000, 2400, ['fhir']);
    collectStringValues(record.data.attachments, texts, 4000, 2400, ['attachments']);
  }

  for (const text of texts) {
    let activeSeedCount = 0;
    for (const seed of compiledSeeds) {
      if (seed.matches >= 32) continue;
      activeSeedCount += 1;
      seed.regex.lastIndex = 0;

      let match: RegExpExecArray | null = null;
      while ((match = seed.regex.exec(text)) !== null) {
        addCandidateWithCategory(discovered, match[0], seed.category, seed.groupHints.values());
        if (seed.category === 'name') {
          const words = (match[0].match(/[A-Za-z]+/g) || [])
            .map((word) => word.trim())
            .filter((word) => word.length >= 4);
          for (const word of words) {
            addCandidateWithCategory(discovered, word, 'name', seed.groupHints.values());
          }
        }
        seed.matches += 1;
        if (seed.matches >= 32) break;
        if (match.index === seed.regex.lastIndex) seed.regex.lastIndex += 1;
      }
    }

    if (activeSeedCount === 0) break;
  }

  return discovered;
}

function collectAttachmentPlaintexts(attachments: unknown): string[] {
  if (!Array.isArray(attachments)) return [];
  const out: string[] = [];
  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== 'object') continue;
    const record = attachment as Record<string, unknown>;

    if (typeof record.contentPlaintext === 'string' && record.contentPlaintext.trim()) {
      out.push(record.contentPlaintext);
      continue;
    }

    if (typeof record.bestEffortPlaintext === 'string' && record.bestEffortPlaintext.trim()) {
      out.push(record.bestEffortPlaintext);
    }

    if (Array.isArray(record.originals)) {
      for (const original of record.originals) {
        if (!original || typeof original !== 'object') continue;
        const originalText = (original as Record<string, unknown>).contentPlaintext;
        if (typeof originalText === 'string' && originalText.trim()) {
          out.push(originalText);
        }
      }
    }
  }
  return out;
}

export function suggestTermGroupsFromRecords(records: RedactionRecordInput[], maxSuggestions = 60): SuggestedTermGroup[] {
  const seedCandidates: CandidateCategoryMap = new Map();

  for (const record of records) {
    addCandidateWithCategory(seedCandidates, record.connection.patientDisplayName || null, 'name');
    if (record.connection.patientBirthDate) {
      addDateVariants(seedCandidates, record.connection.patientBirthDate, [
        'source:connectionBirthDate',
        'source:patientBirthDate',
      ]);
    }

    const fhir = record.data.fhir || {};
    for (const [resourceType, resources] of Object.entries(fhir)) {
      if (!shouldScanResourceTypeForSeeds(resourceType)) continue;
      if (!Array.isArray(resources)) continue;
      for (const resource of resources.slice(0, 8)) {
        extractSensitiveSeeds(resource, seedCandidates, [resourceType], 0);
      }
    }

    for (const text of collectAttachmentPlaintexts(record.data.attachments)) {
      if (!text) continue;
      collectPatternMatches(text.slice(0, 12000), seedCandidates);
      if (seedCandidates.size >= maxSuggestions) break;
    }

    if (seedCandidates.size >= maxSuggestions) break;
  }

  const seedGroups = groupSuggestedTerms(seedCandidates, Math.max(maxSuggestions, 80));
  const scanSeeds = seedGroups.slice(0, Math.min(48, seedGroups.length));
  const fuzzyMatches = scanFuzzyVariantsFromRecords(records, scanSeeds);
  const mergedCandidates = mergeCandidateMaps(new Map(seedCandidates), fuzzyMatches);
  return groupSuggestedTerms(mergedCandidates, maxSuggestions);
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTokenFuzzyPattern(token: string): string {
  return token
    .split('')
    .map((char) => escapeRegex(char))
    .join('[\\s\\W_]*');
}

function buildDigitSequencePattern(digits: string): string {
  return digits
    .split('')
    .map((char) => escapeRegex(char))
    .join('[\\s\\W_]*');
}

function isLikelyNameTerm(term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed) return false;
  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(trimmed)) return false;
  if (/\d/.test(trimmed)) return false;
  const words = trimmed.match(/[A-Za-z]+/g) || [];
  const looksLikeCommaName = /^[A-Za-z]{2,}\s*,\s*[A-Za-z]{1,}/.test(trimmed);
  return looksLikeCommaName || words.length >= 2;
}

function isLikelyAddressTerm(term: string): boolean {
  return inferCategoryFromValue(term, 'other') === 'address';
}

function buildExpandedTokenPattern(token: string): string {
  const expanded = ADDRESS_TOKEN_EXPANSIONS[token] || [token];
  const tokenOptions = Array.from(new Set(expanded.map((value) => value.toLowerCase())));
  const optionPatterns = tokenOptions.map((value) => buildTokenFuzzyPattern(value));
  return optionPatterns.length === 1 ? optionPatterns[0] : `(?:${optionPatterns.join('|')})`;
}

function buildAuxiliaryTermRegexes(term: string): RegExp[] {
  const out: RegExp[] = [];
  const seen = new Set<string>();
  const addRegex = (regex: RegExp | null): void => {
    if (!regex) return;
    const key = `${regex.source}::${regex.flags}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(regex);
  };

  const labelledIdentifier = term.match(
    new RegExp(`\\b${IDENTIFIER_LABEL}\\s*[:#-]?\\s*([A-Za-z0-9_.:-]{4,})\\b`, 'i')
  );
  if (labelledIdentifier && isLikelyIdentifierValue(labelledIdentifier[1])) {
    addRegex(new RegExp(`\\b${escapeRegex(labelledIdentifier[1])}\\b`, 'gi'));
  }

  const labelledReference = term.match(/\b[A-Z][A-Za-z]+\s+reference\s*[:#-]?\s*([A-Za-z0-9.-]{2,})\b/i);
  if (labelledReference && isLikelyIdentifierValue(labelledReference[1])) {
    addRegex(new RegExp(`\\b${escapeRegex(labelledReference[1])}\\b`, 'gi'));
  }

  return out;
}

function buildFlexibleRegex(term: string): RegExp | null {
  const canonical = canonicalTermKey(term);
  if (!canonical) return null;

  if (canonical.startsWith('email:')) {
    const email = canonical.slice('email:'.length);
    return new RegExp(`\\b${escapeRegex(email)}\\b`, 'gi');
  }

  if (canonical.startsWith('ssn:')) {
    const digits = canonical.slice('ssn:'.length);
    if (digits.length !== 9) return null;
    return new RegExp(buildDigitSequencePattern(digits), 'g');
  }

  if (canonical.startsWith('phone:')) {
    const digits = canonical.slice('phone:'.length);
    if (digits.length !== 10) return null;
    const withOptionalCountryCode = `(?:\\+?[\\s\\W_]*1[\\s\\W_]*)?${buildDigitSequencePattern(digits)}`;
    return new RegExp(withOptionalCountryCode, 'g');
  }

  if (canonical.startsWith('dob:')) {
    const digits = canonical.slice('dob:'.length);
    if (!/^\d{8}$/.test(digits)) return null;

    const year = digits.slice(0, 4);
    const month = digits.slice(4, 6);
    const day = digits.slice(6, 8);
    const monthNoPad = String(Number(month));
    const dayNoPad = String(Number(day));
    const monthPattern = monthNoPad === month ? month : `(?:${month}|${monthNoPad})`;
    const dayPattern = dayNoPad === day ? day : `(?:${day}|${dayNoPad})`;
    const sep = '[\\s./_-]*';
    const ymd = `${year}${sep}${monthPattern}${sep}${dayPattern}`;
    const mdy = `${monthPattern}${sep}${dayPattern}${sep}${year}`;
    return new RegExp(`\\b(?:${ymd}|${mdy})\\b`, 'g');
  }

  const tokens = normalizeWordTokens(term);
  if (tokens.length === 0) return null;

  const looksLikeName = isLikelyNameTerm(term);
  const looksLikeAddress = isLikelyAddressTerm(term);

  let patternBody: string;
  if (tokens.length === 1) {
    if (tokens[0].length < 3) return null;
    patternBody = buildExpandedTokenPattern(tokens[0]);
  } else {
    const gapPattern =
      looksLikeName || looksLikeAddress
        // Tolerate compacted strings with inserted words (e.g. county/state labels).
        ? '(?:[\\s\\W_]*[a-z]{0,10}[\\s\\W_]*)'
        : '[\\s\\W_]*';

    patternBody = tokens
      .map((token) => buildExpandedTokenPattern(token))
      .join(gapPattern);
  }

  if ((looksLikeName || looksLikeAddress) && tokens.length >= 2) {
    // Names in attachments are often concatenated (e.g., JoshuaCMandelJoshMandel)
    // and addresses are often compacted similarly, so strict boundaries miss PHI.
    return new RegExp(patternBody, 'gi');
  }

  return new RegExp(`\\b${patternBody}\\b`, 'gi');
}

function buildAttachmentRegex(term: string): RegExp | null {
  const canonical = canonicalTermKey(term);
  if (!canonical) return null;

  if (canonical.startsWith('email:') || canonical.startsWith('ssn:') || canonical.startsWith('phone:') || canonical.startsWith('dob:')) {
    return buildFlexibleRegex(term);
  }

  const tokens = normalizeWordTokens(term);
  if (tokens.length === 0) return null;
  if (tokens.length === 1 && tokens[0].length < 3) return null;

  const gapPattern = '(?:[\\s\\W_]*[a-z0-9]{0,12}[\\s\\W_]*)';
  const patternBody =
    tokens.length === 1
      ? buildExpandedTokenPattern(tokens[0])
      : tokens.map((token) => buildExpandedTokenPattern(token)).join(gapPattern);

  // Attachment plaintext can be highly compacted (no delimiters), so match without boundaries.
  return new RegExp(patternBody, 'gi');
}

function compileRegexes(profile: RedactionProfile): RegExp[] {
  const regexes: RegExp[] = [];
  const seen = new Set<string>();

  const addRegex = (regex: RegExp | null): void => {
    if (!regex) return;
    const key = `${regex.source}::${regex.flags}`;
    if (seen.has(key)) return;
    seen.add(key);
    regexes.push(regex);
  };

  for (const term of profile.terms) {
    addRegex(buildFlexibleRegex(term.value));
    for (const regex of buildAuxiliaryTermRegexes(term.value)) {
      addRegex(regex);
    }
  }

  return regexes;
}

function compileAttachmentRegexes(profile: RedactionProfile): RegExp[] {
  const regexes: RegExp[] = [];
  const seen = new Set<string>();
  const addRegex = (regex: RegExp | null): void => {
    if (!regex) return;
    const key = `${regex.source}::${regex.flags}`;
    if (seen.has(key)) return;
    seen.add(key);
    regexes.push(regex);
  };

  for (const term of profile.terms) {
    addRegex(buildAttachmentRegex(term.value));
  }

  return regexes;
}

function redactTextValue(text: string, regexes: RegExp[]): { value: string; changed: boolean } {
  let next = text;
  let changed = false;
  for (const regex of regexes) {
    regex.lastIndex = 0;
    const replaced = next.replace(regex, REDACTION_TOKEN);
    if (replaced !== next) changed = true;
    next = replaced;
  }
  return { value: next, changed };
}

function isAttachmentPlaintextPath(path: string[]): boolean {
  if (path.length === 0) return false;
  const normalized = path.map((part) => normalizePathKey(part));
  const last = normalized[normalized.length - 1];
  return normalized.includes('attachments') && (last === 'contentplaintext' || last.endsWith('plaintext'));
}

function normalizeBase64Input(value: string): string {
  const compact = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const mod = compact.length % 4;
  if (mod === 1) return '';
  if (mod === 0) return compact;
  return compact.padEnd(compact.length + (4 - mod), '=');
}

function tryDecodeBase64Sample(value: string, maxChars = 32768): Uint8Array | null {
  const normalized = normalizeBase64Input(value);
  if (!normalized) return null;

  const sampleLen = Math.min(normalized.length, maxChars);
  const safeLen = sampleLen - (sampleLen % 4);
  if (safeLen < 8) return null;

  try {
    const binary = atob(normalized.slice(0, safeLen));
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

function printableByteRatio(bytes: Uint8Array): number {
  if (bytes.length === 0) return 1;
  let printable = 0;
  for (const b of bytes) {
    const isWhitespace = b === 9 || b === 10 || b === 13;
    const isPrintableAscii = b >= 32 && b <= 126;
    if (isWhitespace || isPrintableAscii) printable += 1;
  }
  return printable / bytes.length;
}

function hasLikelyBlobKeyHint(path: string[], key: string): boolean {
  const normalizedKey = normalizePathKey(key);
  if (
    normalizedKey === 'contentbase64' ||
    normalizedKey === 'data' ||
    normalizedKey.includes('base64') ||
    normalizedKey.includes('binary') ||
    normalizedKey.includes('blob') ||
    normalizedKey.includes('payload')
  ) {
    return true;
  }

  const normalizedPath = path.map((part) => normalizePathKey(part));
  return (
    normalizedPath.includes('attachments') ||
    normalizedPath.includes('attachment') ||
    normalizedPath.includes('presentedform')
  );
}

function shouldStripLikelyBase64Blob(path: string[], key: string, value: string): boolean {
  const compact = value.replace(/\s+/g, '');
  if (compact.length < 64) return false;
  if (!/^[A-Za-z0-9+/=_-]+$/.test(compact)) return false;

  const decoded = tryDecodeBase64Sample(compact);
  if (!decoded) return false;

  const keyHint = hasLikelyBlobKeyHint(path, key);
  const ratio = printableByteRatio(decoded);
  const hasNullBytes = decoded.some((byte) => byte === 0);
  if (keyHint) {
    // Key/path hints are useful but not sufficient for smaller textual payloads.
    if (compact.length >= 2048) return true;
    return hasNullBytes || ratio < 0.55;
  }

  if (compact.length < 1024) return false;

  return hasNullBytes || ratio < 0.72;
}

function isFhirHumanNameObject(value: Record<string, unknown>): boolean {
  const hasNameShape =
    'text' in value ||
    'family' in value ||
    'given' in value ||
    'prefix' in value ||
    'suffix' in value;
  if (!hasNameShape) return false;
  return (
    typeof value.text === 'string' ||
    typeof value.family === 'string' ||
    Array.isArray(value.given) ||
    Array.isArray(value.prefix) ||
    Array.isArray(value.suffix)
  );
}

function isLikelyAddressPath(path: string[]): boolean {
  return path.some((segment) => {
    const normalized = normalizePathKey(segment);
    return normalized === 'address' || normalized.endsWith('address') || normalized === 'addr';
  });
}

function isFhirAddressObject(value: Record<string, unknown>): boolean {
  let signalCount = 0;
  if (Array.isArray(value.line) || typeof value.line === 'string') signalCount += 1;
  if (typeof value.city === 'string') signalCount += 1;
  if (typeof value.state === 'string') signalCount += 1;
  if (typeof value.postalCode === 'string') signalCount += 1;
  if (typeof value.country === 'string') signalCount += 1;
  if (typeof value.text === 'string') signalCount += 1;
  return signalCount >= 2;
}

function isLikelyIdentifierPath(path: string[]): boolean {
  return path.some((segment) => {
    const normalized = normalizePathKey(segment);
    return (
      IDENTIFIER_KEY_HINTS.has(normalized) ||
      normalized.endsWith('identifier') ||
      normalized.endsWith('id') ||
      normalized.endsWith('number') ||
      normalized === 'reference'
    );
  });
}

function isFhirIdentifierObject(value: Record<string, unknown>): boolean {
  const hasValue = typeof value.value === 'string';
  const hasSystem = typeof value.system === 'string';
  const hasUse = typeof value.use === 'string';
  const hasType = isObject(value.type);
  const hasAssigner = isObject(value.assigner);
  if (hasValue && (hasSystem || hasType || hasAssigner || hasUse)) return true;
  if (hasSystem && hasType) return true;
  if (typeof value.reference === 'string') return true;
  return false;
}

function intersectsChangedKeys(changedKeys: Set<string>, expectedKeys: Iterable<string>): boolean {
  for (const expected of expectedKeys) {
    if (changedKeys.has(expected)) return true;
  }
  return false;
}

function redactAllStringsDeep(value: unknown): unknown {
  if (typeof value === 'string') return REDACTION_TOKEN;
  if (Array.isArray(value)) return value.map((item) => redactAllStringsDeep(item));
  if (!isObject(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = redactAllStringsDeep(entry);
  }
  return out;
}

function redactWholeHumanName(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...value };

  for (const key of ['text', 'family']) {
    if (typeof out[key] === 'string') {
      out[key] = REDACTION_TOKEN;
    }
  }

  for (const key of ['given', 'prefix', 'suffix']) {
    const current = out[key];
    if (Array.isArray(current)) {
      out[key] = current.map((item) => (typeof item === 'string' ? REDACTION_TOKEN : item));
    } else if (typeof current === 'string') {
      out[key] = REDACTION_TOKEN;
    }
  }

  return out;
}

function buildHumanNameCompositeStrings(value: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const text = typeof value.text === 'string' ? normalizeCandidateValue(value.text) : '';
  if (text) out.add(text);

  const family = typeof value.family === 'string' ? normalizeCandidateValue(value.family) : '';
  const given = Array.isArray(value.given)
    ? value.given.filter((item: unknown): item is string => typeof item === 'string').map(normalizeCandidateValue).filter(Boolean)
    : typeof value.given === 'string'
      ? [normalizeCandidateValue(value.given)].filter(Boolean)
      : [];
  const prefix = Array.isArray(value.prefix)
    ? value.prefix.filter((item: unknown): item is string => typeof item === 'string').map(normalizeCandidateValue).filter(Boolean)
    : typeof value.prefix === 'string'
      ? [normalizeCandidateValue(value.prefix)].filter(Boolean)
      : [];
  const suffix = Array.isArray(value.suffix)
    ? value.suffix.filter((item: unknown): item is string => typeof item === 'string').map(normalizeCandidateValue).filter(Boolean)
    : typeof value.suffix === 'string'
      ? [normalizeCandidateValue(value.suffix)].filter(Boolean)
      : [];

  if (given.length || family) {
    out.add(`${given.join(' ')} ${family}`.trim());
    out.add(`${family}, ${given.join(' ')}`.trim());
  }

  const expanded = [...prefix, ...given, family, ...suffix].filter(Boolean).join(' ').trim();
  if (expanded) out.add(expanded);

  return Array.from(out.values()).filter((value) => value.length >= 3);
}

function matchesAnyRegex(value: string, regexes: RegExp[]): boolean {
  for (const regex of regexes) {
    regex.lastIndex = 0;
    if (regex.test(value)) return true;
  }
  return false;
}

function redactWholeFhirAddress(value: Record<string, unknown>): Record<string, unknown> {
  return redactAllStringsDeep(value) as Record<string, unknown>;
}

function redactWholeFhirIdentifier(value: Record<string, unknown>): Record<string, unknown> {
  return redactAllStringsDeep(value) as Record<string, unknown>;
}

function redactValueDetailed(
  value: unknown,
  regexes: RegExp[],
  stripAttachmentBase64: boolean,
  path: string[] = [],
  attachmentRegexes: RegExp[] = [],
): { value: unknown; changed: boolean } {
  if (typeof value === 'string') {
    const firstPass = redactTextValue(value, regexes);
    if (!attachmentRegexes.length || !isAttachmentPlaintextPath(path)) {
      return firstPass;
    }
    const secondPass = redactTextValue(firstPass.value, attachmentRegexes);
    return {
      value: secondPass.value,
      changed: firstPass.changed || secondPass.changed,
    };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const redacted = redactValueDetailed(item, regexes, stripAttachmentBase64, path, attachmentRegexes);
      if (redacted.changed) changed = true;
      return redacted.value;
    });
    return { value: out, changed };
  }

  if (!isObject(value)) {
    return { value, changed: false };
  }

  const out: Record<string, unknown> = {};
  let changed = false;
  const changedKeys = new Set<string>();
  for (const [key, entry] of Object.entries(value)) {
    if (
      stripAttachmentBase64 &&
      typeof entry === 'string' &&
      shouldStripLikelyBase64Blob(path, key, entry)
    ) {
      out[key] = null;
      changed = true;
      changedKeys.add(key);
      continue;
    }
    const redacted = redactValueDetailed(entry, regexes, stripAttachmentBase64, [...path, key], attachmentRegexes);
    out[key] = redacted.value;
    if (redacted.changed) {
      changed = true;
      changedKeys.add(key);
    }
  }

  if (!changed && isFhirHumanNameObject(out)) {
    const composites = buildHumanNameCompositeStrings(out);
    if (composites.some((nameValue) => matchesAnyRegex(nameValue, regexes))) {
      return {
        value: redactWholeHumanName(out),
        changed: true,
      };
    }
  }

  if (
    changed &&
    isFhirHumanNameObject(out) &&
    intersectsChangedKeys(changedKeys, ['text', 'family', 'given', 'prefix', 'suffix'])
  ) {
    return {
      value: redactWholeHumanName(out),
      changed: true,
    };
  }

  if (
    changed &&
    isFhirAddressObject(out) &&
    intersectsChangedKeys(changedKeys, ADDRESS_FIELD_KEYS) &&
    (isLikelyAddressPath(path) || intersectsChangedKeys(changedKeys, ['line', 'city', 'postalCode']))
  ) {
    return {
      value: redactWholeFhirAddress(out),
      changed: true,
    };
  }

  if (
    changed &&
    isFhirIdentifierObject(out) &&
    intersectsChangedKeys(changedKeys, ['value', 'system', 'use', 'type', 'assigner', 'reference']) &&
    (isLikelyIdentifierPath(path) || intersectsChangedKeys(changedKeys, ['value', 'system', 'reference']))
  ) {
    return {
      value: redactWholeFhirIdentifier(out),
      changed: true,
    };
  }

  return { value: out, changed };
}

export function redactPayloadWithProfile<T>(payload: T, profile: RedactionProfile): T {
  const regexes = compileRegexes(profile);
  const attachmentRegexes = compileAttachmentRegexes(profile);
  if (regexes.length === 0 && !profile.stripAttachmentBase64) {
    return payload;
  }
  return redactValueDetailed(payload, regexes, profile.stripAttachmentBase64, [], attachmentRegexes).value as T;
}

export function getRedactionContextForAction(_action: RedactionAction): {
  state: RedactionState;
  profile: RedactionProfile | null;
  shouldApply: boolean;
} {
  const state = loadRedactionState();
  const profile = getAppliedProfile(state);
  const shouldApply = Boolean(profile);
  return {
    state,
    profile,
    shouldApply,
  };
}

export function countEnabledTerms(profile: RedactionProfile | null): number {
  if (!profile) return 0;
  return profile.terms.length;
}
