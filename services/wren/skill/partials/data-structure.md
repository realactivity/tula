## Data Structure

Each provider file contains:

```typescript
interface ProviderData {
  name: string;           // Provider display name
  fhirBaseUrl: string;    // FHIR server URL
  connectedAt: string;    // ISO timestamp
  fhir: {
    // Common resource types (always check what's available — more may appear)
    Patient?: Patient[];
    Condition?: Condition[];
    Observation?: Observation[];  // Labs, vitals
    MedicationRequest?: MedicationRequest[];
    Procedure?: Procedure[];
    Immunization?: Immunization[];
    AllergyIntolerance?: AllergyIntolerance[];
    Encounter?: Encounter[];
    DiagnosticReport?: DiagnosticReport[];
    DocumentReference?: DocumentReference[];  // Note: attachment.data stripped, see attachments[]
    CareTeam?: CareTeam[];
    Goal?: Goal[];
    CarePlan?: CarePlan[];
    Coverage?: Coverage[];
    // Other types may also be present (Device, MedicationDispense, etc.)
    [resourceType: string]: any[];
  };
  attachments: AttachmentSource[];  // Canonical location for all attachment content, grouped by source document
}

interface AttachmentSource {
  source: {
    resourceType: string;    // Usually "DocumentReference" (rarely "DiagnosticReport")
    resourceId: string;      // FHIR resource ID this came from
  };
  bestEffortFrom: number | null;    // Index into originals[] (same index as source content/presentedForm index)
  bestEffortPlaintext: string | null;
  originals: AttachmentOriginal[];  // originals[contentIndex] maps directly to source content index
}

interface AttachmentOriginal {
  contentIndex: number;      // Mirrors its array index in originals[]
  contentType: string;       // "text/html", "text/rtf", "application/xml", etc.
  contentPlaintext: string | null;  // Extracted plain text for this rendition
  contentBase64: string | null;     // Raw content, base64 encoded
}
```

**Important:** Attachment content is stored ONLY in the `attachments[]` array. Inline `attachment.data` 
is stripped from FHIR resources (DocumentReference, DiagnosticReport) to avoid duplication. The FHIR 
resources retain `attachment.url` and metadata but not the raw content. To find attachment content:
1. Look up the source document in `attachments[]` by `source.resourceId`
2. Use `bestEffortPlaintext` for the preferred rendition
3. Use `originals[bestEffortFrom]` for the exact source rendition, or inspect other `originals[]` entries

Each provider is a separate slice — no merging, preserves data provenance.
