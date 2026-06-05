// FHIR client for fetching patient data

import { extractAttachments, type ProcessedAttachment } from './attachments';

export interface FHIRBundle {
  resourceType: 'Bundle';
  type: string;
  total?: number;
  link?: Array<{ relation: string; url: string }>;
  entry?: Array<{ resource: any }>;
}

export interface EHRData {
  fhir: Record<string, any[]>;
  attachments: ProcessedAttachment[];
}

// ---------------------------------------------------------------------------
// Progress model
// ---------------------------------------------------------------------------

export type QueryState =
  | { status: 'pending' }
  | { status: 'active'; resourcesSoFar: number }
  | { status: 'done'; count: number }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export interface QuerySlot {
  label: string;
  group: number;
  state: QueryState;
  activeSince: number;  // timestamp when query became active (0 if not yet)
}

export interface FetchProgress {
  phase: 'resources' | 'references' | 'attachments';
  queries: QuerySlot[];         // always length 44
  totalResources: number;       // running sum across all queries
  settledCount: number;         // how many of 44 are done/empty/error
  references: { completed: number; total: number } | null;
  attachments: { completed: number; total: number } | null;
}

export type ProgressCallback = (progress: FetchProgress) => void;

// ---------------------------------------------------------------------------
// Query definitions
// ---------------------------------------------------------------------------

// Patient search queries - resources that support patient search parameter
// Based on US Core IG mandatory search requirements (SHALL support)
const PATIENT_SEARCH_QUERIES = [
  // Patient demographics
  { resourceType: 'Patient', params: {} as Record<string, string>, patientInPath: true, label: 'Patient', group: 7 },

  // Observation by category (US Core observation profiles)
  // Base FHIR observation categories
  { resourceType: 'Observation', params: { category: 'laboratory' }, label: 'Labs', group: 1 },
  { resourceType: 'Observation', params: { category: 'vital-signs' }, label: 'Vitals', group: 1 },
  { resourceType: 'Observation', params: { category: 'social-history' }, label: 'Social History', group: 1 },
  { resourceType: 'Observation', params: { category: 'survey' }, label: 'Surveys', group: 1 },
  { resourceType: 'Observation', params: { category: 'exam' }, label: 'Exams', group: 1 },
  { resourceType: 'Observation', params: { category: 'therapy' }, label: 'Therapy', group: 1 },
  { resourceType: 'Observation', params: { category: 'activity' }, label: 'Activity', group: 1 },
  { resourceType: 'Observation', params: { category: 'imaging' }, label: 'Imaging', group: 1 },
  { resourceType: 'Observation', params: { category: 'procedure' }, label: 'Procedures', group: 1 },
  // US Core extension categories (screening/assessment)
  { resourceType: 'Observation', params: { category: 'sdoh' }, label: 'SDOH', group: 1 },
  { resourceType: 'Observation', params: { category: 'functional-status' }, label: 'Functional', group: 1 },
  { resourceType: 'Observation', params: { category: 'disability-status' }, label: 'Disability', group: 1 },
  { resourceType: 'Observation', params: { category: 'cognitive-status' }, label: 'Cognitive', group: 1 },
  // US Core extension categories (clinical result)
  { resourceType: 'Observation', params: { category: 'clinical-test' }, label: 'Clinical Tests', group: 1 },
  // US Core extension categories (ADI - Advance Directive Interoperability)
  { resourceType: 'Observation', params: { category: 'observation-adi-documentation' }, label: 'ADI', group: 1 },
  { resourceType: 'Observation', params: { category: 'care-experience-preference' }, label: 'Care Experience', group: 1 },
  { resourceType: 'Observation', params: { category: 'treatment-intervention-preference' }, label: 'Treatment Prefs', group: 1 },

  // Condition by category (US Core condition profiles)
  { resourceType: 'Condition', params: { category: 'problem-list-item' }, label: 'Problems', group: 2 },
  { resourceType: 'Condition', params: { category: 'health-concern' }, label: 'Health Concerns', group: 2 },
  { resourceType: 'Condition', params: { category: 'encounter-diagnosis' }, label: 'Diagnoses', group: 2 },

  // DiagnosticReport by category (US Core diagnosticreport profiles)
  { resourceType: 'DiagnosticReport', params: { category: 'http://terminology.hl7.org/CodeSystem/v2-0074|LAB' }, label: 'Lab Reports', group: 1 },
  { resourceType: 'DiagnosticReport', params: { category: 'http://loinc.org|LP29708-2' }, label: 'Radiology', group: 1 },

  // DocumentReference by category (US Core documentreference profile)
  { resourceType: 'DocumentReference', params: { category: 'clinical-note' }, label: 'Clinical Notes', group: 3 },
  { resourceType: 'DocumentReference', params: {}, label: 'Documents', group: 3 },

  // CarePlan by category (US Core careplan profile)
  { resourceType: 'CarePlan', params: { category: 'http://hl7.org/fhir/us/core/CodeSystem/careplan-category|assess-plan' }, label: 'Care Plan', group: 6 },

  // ServiceRequest by category (US Core servicerequest profile)
  { resourceType: 'ServiceRequest', params: { category: 'http://snomed.info/sct|386053000' }, label: 'Evaluations', group: 4 },
  { resourceType: 'ServiceRequest', params: { category: 'http://snomed.info/sct|410606002' }, label: 'Social Services', group: 4 },
  { resourceType: 'ServiceRequest', params: { category: 'sdoh' }, label: 'SDOH Services', group: 4 },
  { resourceType: 'ServiceRequest', params: {}, label: 'Services', group: 4 },

  // Resources without category search (patient-only search)
  { resourceType: 'AllergyIntolerance', params: {}, label: 'Allergies', group: 6 },
  { resourceType: 'CareTeam', params: { status: 'active' }, label: 'Care Team', group: 6 },
  { resourceType: 'Coverage', params: {}, label: 'Coverage', group: 7 },
  { resourceType: 'Device', params: {}, label: 'Devices', group: 7 },
  { resourceType: 'Encounter', params: {}, label: 'Encounters', group: 7 },
  { resourceType: 'FamilyMemberHistory', params: {}, label: 'Family History', group: 7 },
  { resourceType: 'Goal', params: {}, label: 'Goals', group: 7 },
  { resourceType: 'Immunization', params: {}, label: 'Immunizations', group: 6 },
  { resourceType: 'MedicationDispense', params: {}, label: 'Dispensing', group: 5 },
  { resourceType: 'MedicationRequest', params: { intent: 'order' }, label: 'Medications', group: 5 },
  { resourceType: 'MedicationStatement', params: {}, label: 'Med History', group: 5 },
  { resourceType: 'Procedure', params: {}, label: 'Procedures', group: 7 },
  { resourceType: 'QuestionnaireResponse', params: {}, label: 'Questionnaires', group: 7 },
  { resourceType: 'RelatedPerson', params: {}, label: 'Related Persons', group: 7 },
];

// Reference resource types - resources commonly referenced but not patient-searchable
// These will be fetched individually when referenced from patient data
const REFERENCE_RESOURCE_TYPES = new Set([
  'Practitioner',
  'PractitionerRole',
  'Organization',
  'Location',
  'Medication',
  'Specimen',
  'Questionnaire',
  'Provenance',
]);

const REQUEST_TIMEOUT_MS = 30000;
const MAX_CONCURRENT_REQUESTS = 5;

/**
 * Fetch all patient data from FHIR server.
 */
export async function fetchPatientData(
  fhirBaseUrl: string,
  accessToken: string,
  patientId: string,
  onProgress?: ProgressCallback,
): Promise<EHRData> {
  const base = fhirBaseUrl.replace(/\/+$/, '');
  const result: EHRData = { fhir: {}, attachments: [] };

  // Track fetched resource IDs to avoid duplicates
  const fetchedIds = new Set<string>();

  // Track referenced resources to fetch later
  const referencedResources = new Set<string>();

  const semaphore = new Semaphore(MAX_CONCURRENT_REQUESTS);

  // -------------------------------------------------------------------------
  // Progress tracking
  // -------------------------------------------------------------------------
  const fp: FetchProgress = {
    phase: 'resources',
    queries: PATIENT_SEARCH_QUERIES.map(q => ({
      label: q.label,
      group: q.group,
      state: { status: 'pending' as const },
      activeSince: 0,
    })),
    totalResources: 0,
    settledCount: 0,
    references: null,
    attachments: null,
  };

  let refResourceCount = 0;  // resources discovered during reference chasing

  function recomputeTotals() {
    let total = 0;
    let settled = 0;
    for (const q of fp.queries) {
      if (q.state.status === 'done') { total += q.state.count; settled++; }
      else if (q.state.status === 'active') { total += q.state.resourcesSoFar; }
      else if (q.state.status === 'empty') { settled++; }
      else if (q.state.status === 'error') { settled++; }
    }
    fp.totalResources = total + refResourceCount;
    fp.settledCount = settled;
  }

  function emit() {
    onProgress?.({ ...fp, queries: fp.queries.map(q => ({ ...q })) });
  }

  // Emit initial state (all pending)
  emit();

  // ==========================================================================
  // Phase 1: Resource searches
  // ==========================================================================
  const queryPromises = PATIENT_SEARCH_QUERIES.map(async (query, queryIndex) => {
    await semaphore.acquire();
    try {
      const resourceType = query.resourceType;

      // Mark slot as active
      fp.queries[queryIndex].state = { status: 'active', resourcesSoFar: 0 };
      fp.queries[queryIndex].activeSince = Date.now();
      recomputeTotals();
      emit();

      let url: string;
      if (query.patientInPath) {
        url = `${base}/Patient/${patientId}`;
      } else {
        const searchParams = new URLSearchParams();
        searchParams.set('patient', patientId);
        searchParams.set('_count', '100');
        for (const [key, value] of Object.entries(query.params)) {
          if (value) searchParams.set(key, String(value));
        }
        url = `${base}/${resourceType}?${searchParams}`;
      }

      let slotResourceCount = 0;
      const resources = query.patientInPath
        ? await fetchSingleResource(url, accessToken)
        : await fetchWithPagination(url, accessToken, (_pageNum, _totalPages, pageEntryCount) => {
            slotResourceCount += pageEntryCount;
            fp.queries[queryIndex].state = { status: 'active', resourcesSoFar: slotResourceCount };
            recomputeTotals();
            emit();
          });

      if (!result.fhir[resourceType]) {
        result.fhir[resourceType] = [];
      }

      for (const resource of resources) {
        const resourceId = `${resource.resourceType}/${resource.id}`;
        if (!fetchedIds.has(resourceId)) {
          fetchedIds.add(resourceId);
          result.fhir[resourceType].push(resource);
          extractReferences(resource, referencedResources);
        }
      }

      // Mark slot as done or empty
      const count = resources.length;
      if (count > 0) {
        fp.queries[queryIndex].state = { status: 'done', count };
      } else {
        fp.queries[queryIndex].state = { status: 'empty' };
      }
      recomputeTotals();
      emit();
    } catch (err) {
      console.warn(`Failed to fetch ${query.resourceType}:`, err);
      fp.queries[queryIndex].state = {
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      };
      recomputeTotals();
      emit();
    } finally {
      semaphore.release();
    }
  });

  await Promise.all(queryPromises);

  // ==========================================================================
  // Phase 2: Referenced resources
  // ==========================================================================
  fp.phase = 'references';

  const refsToFetch = Array.from(referencedResources).filter(ref => {
    const [resourceType] = ref.split('/');
    return REFERENCE_RESOURCE_TYPES.has(resourceType) && !fetchedIds.has(ref);
  });

  const totalRefs = refsToFetch.length;
  let completedRefs = 0;

  console.log(`[FHIR] Fetching ${totalRefs} referenced resources`);

  fp.references = { completed: 0, total: totalRefs };
  emit();

  if (totalRefs > 0) {
    const refPromises = refsToFetch.map(async (ref) => {
      await semaphore.acquire();
      try {
        const url = `${base}/${ref}`;
        const resources = await fetchSingleResource(url, accessToken);

        for (const resource of resources) {
          const resType = resource.resourceType;
          const resourceId = `${resType}/${resource.id}`;

          if (!fetchedIds.has(resourceId)) {
            fetchedIds.add(resourceId);
            if (!result.fhir[resType]) {
              result.fhir[resType] = [];
            }
            result.fhir[resType].push(resource);
            refResourceCount++;
          }
        }

        completedRefs++;
        fp.references = { completed: completedRefs, total: totalRefs };
        recomputeTotals();
        emit();
      } catch (err) {
        console.warn(`Failed to fetch reference ${ref}:`, err);
        completedRefs++;
        fp.references = { completed: completedRefs, total: totalRefs };
        emit();
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(refPromises);
  }

  // ==========================================================================
  // Phase 3: Attachments
  // ==========================================================================
  fp.phase = 'attachments';

  const docRefs = result.fhir['DocumentReference'] || [];
  const diagReports = result.fhir['DiagnosticReport'] || [];
  const attachmentSources = [...docRefs, ...diagReports];

  // Count total attachments to extract
  let totalAttachments = 0;
  for (const resource of attachmentSources) {
    if (resource.content) {
      totalAttachments += resource.content.length;
    }
    if (resource.presentedForm) {
      totalAttachments += resource.presentedForm.length;
    }
  }

  console.log(`[FHIR] Extracting ${totalAttachments} attachments from ${attachmentSources.length} resources`);

  fp.attachments = { completed: 0, total: totalAttachments };
  emit();

  if (attachmentSources.length > 0) {
    result.attachments = await extractAttachments(
      attachmentSources,
      base,
      accessToken,
      (completed, _total, _detail) => {
        fp.attachments = { completed, total: totalAttachments };
        emit();
      },
    );

    // Strip inline attachment.data from FHIR resources - content is now in result.attachments
    // (grouped by source resource). This avoids data duplication.
    for (const resource of attachmentSources) {
      if (resource.resourceType === 'DocumentReference') {
        for (const content of resource.content || []) {
          if (content.attachment?.data) {
            delete content.attachment.data;
          }
        }
      } else if (resource.resourceType === 'DiagnosticReport') {
        for (const form of resource.presentedForm || []) {
          if (form.data) {
            delete form.data;
          }
        }
      }
    }
  }

  // Final emission
  emit();

  // Log summary
  console.log('[FHIR] Fetch complete. Resources by type:');
  for (const [type, resources] of Object.entries(result.fhir)) {
    console.log(`  ${type}: ${resources.length}`);
  }
  console.log(`  Attachments: ${result.attachments.length}`);

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers (unchanged)
// ---------------------------------------------------------------------------

/**
 * Extract all relative references from a FHIR resource.
 */
function extractReferences(obj: any, references: Set<string>, path = ''): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractReferences(item, references, path);
    }
    return;
  }

  // Check for reference field
  if (obj.reference && typeof obj.reference === 'string') {
    const ref = obj.reference;
    // Only include relative references (ResourceType/id format)
    // Exclude absolute URLs and contained references (#id)
    if (/^[A-Z][a-zA-Z]+\/[^/]+$/.test(ref)) {
      references.add(ref);
    }
  }

  // Recurse into nested objects
  for (const key of Object.keys(obj)) {
    if (key !== 'reference') {
      extractReferences(obj[key], references, `${path}.${key}`);
    }
  }
}

/**
 * Fetch a single resource by URL.
 */
async function fetchSingleResource(
  url: string,
  accessToken: string,
): Promise<any[]> {
  console.log(`[FHIR] Fetching: ${url}`);

  const response = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      console.log(`[FHIR] 404 - resource not found: ${url}`);
      return [];
    }
    throw new Error(`FHIR request failed: ${response.status}`);
  }

  const resource = await response.json();
  return [resource];
}

/**
 * Fetch a FHIR search with pagination - follows all pages.
 */
async function fetchWithPagination(
  initialUrl: string,
  accessToken: string,
  onPage?: (pageNum: number, totalPages: number | null, pageEntryCount: number) => void,
): Promise<any[]> {
  const resources: any[] = [];
  let url: string | null = initialUrl;
  let pageCount = 0;

  console.log(`[FHIR] Starting fetch: ${initialUrl}`);

  while (url) {
    pageCount++;
    const response = await fetchWithTimeout(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/fhir+json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[FHIR] 404 - resource type not supported`);
        return [];
      }
      throw new Error(`FHIR request failed: ${response.status}`);
    }

    const bundle: FHIRBundle = await response.json();

    const entryCount = bundle.entry?.length || 0;
    const nextLink = bundle.link?.find((l) => l.relation === 'next')?.url || null;

    // Estimate total pages from bundle.total (if available) and page size
    // Note: Some servers (Epic) incorrectly set total to current page count, so
    // if there's a next link but total suggests only 1 page, ignore total
    const pageSize = entryCount || 100;
    let estimatedTotalPages: number | null = null;
    if (bundle.total) {
      const calculated = Math.ceil(bundle.total / pageSize);
      if (!nextLink || calculated > pageCount) {
        estimatedTotalPages = calculated;
      }
    }

    console.log(`[FHIR] Page ${pageCount}/${estimatedTotalPages || '?'}: ${entryCount} entries, total: ${bundle.total}, hasNext: ${!!nextLink}`);

    // Report page progress
    onPage?.(pageCount, estimatedTotalPages, entryCount);

    // Extract resources from bundle entries
    if (bundle.entry) {
      for (const entry of bundle.entry) {
        if (entry.resource) {
          resources.push(entry.resource);
        }
      }
    }

    url = nextLink;
  }

  console.log(`[FHIR] Finished: ${resources.length} total resources from ${pageCount} pages`);
  return resources;
}

/**
 * Fetch with timeout.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timed out: ${url}`);
    }
    throw err;
  }
}

/**
 * Simple semaphore for concurrency control.
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}
