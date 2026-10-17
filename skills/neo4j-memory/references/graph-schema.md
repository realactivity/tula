# Graph Schema

Node labels, relationship types, and key properties written by the ingest
scripts. Use this when translating natural language to Cypher.

## Node labels

### `:Observation`

Lab results and vitals from `health-records` (FHIR Observation) and
`med-pdf` (parse_labs.mjs output).

| Property | Type | Notes |
|---|---|---|
| `id` | string | SHA-256 of source + code + effectiveDate (first 16 hex chars) |
| `code` | string | LOINC code, or empty string if unavailable |
| `display` | string | Human-readable name, e.g. "Glucose", "HbA1c" |
| `value` | string | Numeric value as string |
| `unit` | string | e.g. "mg/dL", "%" |
| `referenceRangeLow` | float \| null | Lower bound of reference range |
| `referenceRangeHigh` | float \| null | Upper bound |
| `effectiveDate` | string | ISO date or datetime |
| `abnormal` | boolean | True if outside reference range or flagged H/L |
| `source` | string | `"health-records"` or `"med-pdf"` |
| `createdAt` | datetime | When the node was first written |
| `updatedAt` | datetime | When the node was last merged |

### `:Condition`

Active and resolved diagnoses from `health-records` FHIR Condition resources.

| Property | Type | Notes |
|---|---|---|
| `id` | string | SHA-256 of code + system |
| `code` | string | ICD-10 or SNOMED code |
| `system` | string | Coding system URI |
| `display` | string | Human-readable diagnosis name |
| `status` | string | `"active"`, `"resolved"`, `"inactive"`, `"unknown"` |
| `onsetDate` | string | ISO date, if available |
| `source` | string | Always `"health-records"` |

### `:Medication`

Medications from `health-records` FHIR MedicationStatement/MedicationRequest.

| Property | Type | Notes |
|---|---|---|
| `id` | string | SHA-256 of RxNorm code or display name |
| `code` | string | RxNorm code, or empty |
| `display` | string | Drug name, e.g. "Metformin 500mg" |
| `status` | string | `"active"`, `"stopped"`, `"completed"`, `"unknown"` |
| `startDate` | string | ISO date, if available |
| `stopDate` | string | ISO date, if available |
| `source` | string | Always `"health-records"` |

### `:DiagnosticReport`

Imaging and radiology reports from `med-pdf` (parse_imaging.mjs output).

| Property | Type | Notes |
|---|---|---|
| `id` | string | SHA-256 of source + effectiveDate + studyType |
| `studyType` | string | CT, MRI, X-ray, US, mammogram, DEXA, echo, PET |
| `impression` | string | Concatenated impression lines |
| `examDescription` | string | Study description |
| `effectiveDate` | string | ISO date |
| `source` | string | Always `"med-pdf"` |
| `sourceSlug` | string | The med-pdf cache slug |

### `:DocumentReference`

Provenance record for each ingested file. Every clinical node links back to
the workspace file it came from.

| Property | Type | Notes |
|---|---|---|
| `id` | string | SHA-256 of sourceType + absolute file path |
| `sourceType` | string | `"health-records"`, `"med-pdf-labs"`, `"med-pdf-imaging"` |
| `path` | string | Absolute path to the source file |
| `date` | datetime | When this DocumentReference was first created |

## Relationships

| Relationship | From | To | Notes |
|---|---|---|---|
| `FROM_DOCUMENT` | Observation | DocumentReference | Provenance |
| `FROM_DOCUMENT` | Condition | DocumentReference | Provenance |
| `FROM_DOCUMENT` | Medication | DocumentReference | Provenance |
| `FROM_DOCUMENT` | DiagnosticReport | DocumentReference | Provenance |

## Constraints and indexes

Created by `schema-init.mjs`:

- Uniqueness constraints on `id` for all five node labels
- Index on `Observation.code` (fast lookup by LOINC)
- Index on `Observation.effectiveDate` (fast range queries)
- Index on `Observation.abnormal` (fast abnormal-only filters)

## Common Cypher patterns

**Glucose trend (last 90 days):**
```cypher
MATCH (o:Observation)
WHERE o.display =~ '(?i)glucose'
  AND o.effectiveDate >= date() - duration('P90D')
RETURN o.effectiveDate AS date, o.value AS value, o.unit AS unit, o.abnormal AS abnormal
ORDER BY o.effectiveDate
```

**All active conditions:**
```cypher
MATCH (c:Condition {status: 'active'})
RETURN c.display AS condition, c.onsetDate AS since
ORDER BY c.onsetDate
```

**Active medications:**
```cypher
MATCH (m:Medication {status: 'active'})
RETURN m.display AS medication, m.startDate AS since
ORDER BY m.startDate
```

**All abnormal labs (ever):**
```cypher
MATCH (o:Observation {abnormal: true})
RETURN o.display AS test, o.value AS value, o.unit AS unit, o.effectiveDate AS date
ORDER BY o.effectiveDate DESC
```

**What changed since a date:**
```cypher
MATCH (o:Observation)
WHERE o.effectiveDate >= '2026-04-01'
RETURN o.display, o.value, o.unit, o.abnormal, o.effectiveDate
ORDER BY o.effectiveDate DESC
```

**Ingest history (what's been loaded):**
```cypher
MATCH (d:DocumentReference)
RETURN d.sourceType, d.path, d.date
ORDER BY d.date DESC
```
