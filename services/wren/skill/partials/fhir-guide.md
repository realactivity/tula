# FHIR Data Reference

## Data Structure

The decrypted data contains an array of providers (one per connected health system):

```javascript
{
  "providers": [
    {
      "name": "UnityPoint Health",
      "fhirBaseUrl": "https://epicfhir.unitypoint.org/.../R4",
      "connectedAt": "2026-01-13T02:43:20.009Z",
      "fhir": {
        "Patient": [...],
        "Condition": [...],
        "MedicationRequest": [...],
        "Observation": [...],
        "DocumentReference": [...],
        // more resource types...
      },
      "attachments": [
        {
          "source": {
            "resourceType": "DocumentReference",
            "resourceId": "abc123"
          },
          "bestEffortFrom": 0,
          "bestEffortPlaintext": "extracted clinical note text...",
          "originals": [
            {
              "contentIndex": 0,
              "contentType": "text/html",
              "contentPlaintext": "extracted clinical note text...",
              "contentBase64": "PGh0bWw+Li4uPC9odG1sPg=="
            }
          ]
        }
      ]
    }
  ]
}
```

For single-provider queries, use `data.providers[0]`. For multi-provider, iterate over all.

## Key Resource Types

### Patient
```javascript
const provider = data.providers[0];
const patient = provider.fhir.Patient[0];
const name = `${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}`;
const dob = patient.birthDate;
const age = new Date().getFullYear() - new Date(dob).getFullYear();
```

### Condition (Diagnoses)
```javascript
const activeConditions = provider.fhir.Condition
  ?.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active')
  .map(c => ({
    name: c.code?.coding?.[0]?.display,
    onset: c.onsetDateTime
  }));
```

Status values: `active`, `inactive`, `resolved`, `remission`

### MedicationRequest
```javascript
const meds = provider.fhir.MedicationRequest?.map(m => ({
  name: m.medicationCodeableConcept?.coding?.[0]?.display,
  status: m.status, // active, completed, stopped
  dosage: m.dosageInstruction?.[0]?.text,
  startDate: m.authoredOn
}));
```

### Observation (Labs, Vitals)
```javascript
function getObservations(provider, loincCode) {
  return provider.fhir.Observation?.filter(obs =>
    obs.code?.coding?.some(c => c.code === loincCode)
  ).map(obs => ({
    value: obs.valueQuantity?.value ?? obs.valueString,
    unit: obs.valueQuantity?.unit,
    date: obs.effectiveDateTime,
    interpretation: obs.interpretation?.[0]?.coding?.[0]?.code,
    refLow: obs.referenceRange?.[0]?.low?.value,
    refHigh: obs.referenceRange?.[0]?.high?.value
  })).sort((a,b) => new Date(b.date) - new Date(a.date));
}
```

Interpretation codes: `H` (high), `L` (low), `N` (normal), `HH`/`LL` (critical)

### Procedure
```javascript
const procedures = provider.fhir.Procedure?.map(p => ({
  name: p.code?.coding?.[0]?.display,
  date: p.performedDateTime,
  status: p.status
}));
```

### Immunization
```javascript
const vaccines = provider.fhir.Immunization?.map(i => ({
  name: i.vaccineCode?.coding?.[0]?.display,
  date: i.occurrenceDateTime
}));
```

### AllergyIntolerance
```javascript
const allergies = provider.fhir.AllergyIntolerance?.map(a => ({
  substance: a.code?.coding?.[0]?.display,
  reaction: a.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display,
  severity: a.reaction?.[0]?.severity
}));
```

### Encounter (Visits)
```javascript
const visits = provider.fhir.Encounter?.map(e => ({
  type: e.type?.[0]?.coding?.[0]?.display,
  date: e.period?.start,
  reason: e.reasonCode?.[0]?.coding?.[0]?.display
}));
```

### DocumentReference timing semantics (important)

For `DocumentReference`, do **not** treat `docRef.date` as the date care occurred.

- `docRef.date` is usually a document metadata timestamp (indexing/creation/import time).
- For clinical chronology, prefer `docRef.context?.period?.start` / `end`.
- If `docRef.context?.encounter[]` points to an `Encounter`, use that encounter's `period.start` as the visit date.
- If context/encounter timing is missing, label timing as uncertain instead of inferring from `docRef.date`.

```javascript
function getDocumentTimeline(provider) {
  const encounters = new Map(
    (provider.fhir.Encounter || []).map(e => [e.id, e])
  );

  return (provider.fhir.DocumentReference || []).map(docRef => {
    const encounterRef = docRef.context?.encounter?.[0]?.reference; // "Encounter/{id}"
    const encounterId = encounterRef?.split('/')[1];
    const encounter = encounterId ? encounters.get(encounterId) : null;

    const clinicalDate =
      docRef.context?.period?.start ||
      encounter?.period?.start ||
      null;

    return {
      id: docRef.id,
      type: docRef.type?.text || docRef.type?.coding?.[0]?.display || 'Document',
      clinicalDate,            // preferred for care timeline
      metadataDate: docRef.date, // useful metadata, not care timing
      encounter: encounter?.type?.[0]?.coding?.[0]?.display || docRef.context?.encounter?.[0]?.display || null,
    };
  });
}
```

## LOINC Code Reference

| Category | Test | LOINC |
|----------|------|-------|
| Glucose | Fasting | 1558-6 |
| Glucose | Random | 2345-7 |
| Glucose | A1c | 4548-4 |
| Lipids | Total Chol | 2093-3 |
| Lipids | HDL | 2085-9 |
| Lipids | LDL | 13457-7 |
| Lipids | Triglycerides | 2571-8 |
| Kidney | Creatinine | 2160-0 |
| Kidney | BUN | 3094-0 |
| Kidney | eGFR | 33914-3 |
| Liver | ALT | 1742-6 |
| Liver | AST | 1920-8 |
| Blood | Hemoglobin | 718-7 |
| Blood | WBC | 6690-2 |
| Blood | Platelets | 777-3 |
| Vitals | Systolic BP | 8480-6 |
| Vitals | Diastolic BP | 8462-4 |
| Vitals | Heart Rate | 8867-4 |
| Vitals | Weight | 29463-7 |
| Vitals | Height | 8302-2 |
| Vitals | BMI | 39156-5 |
| Thyroid | TSH | 3016-3 |
| Thyroid | Free T4 | 3024-7 |

## Searching Clinical Notes

```javascript
function searchNotes(provider, terms) {
  const termList = Array.isArray(terms) ? terms : [terms];
  
  return provider.attachments?.filter(att => {
    const text = (att.bestEffortPlaintext || '').toLowerCase();
    return termList.some(t => text.includes(t.toLowerCase()));
  }).map(att => {
    const text = att.bestEffortPlaintext || '';
    // Find context around first match
    for (const term of termList) {
      const idx = text.toLowerCase().indexOf(term.toLowerCase());
      if (idx !== -1) {
        const docRef = provider.fhir.DocumentReference?.find(d => d.id === att.source?.resourceId);
        return {
          docId: att.source?.resourceId,
          clinicalDate: docRef?.context?.period?.start ?? null,
          metadataDate: docRef?.date ?? null,
          context: text.substring(
            Math.max(0, idx - 150),
            Math.min(text.length, idx + term.length + 150)
          )
        };
      }
    }
  });
}

// Example: Find diabetes-related notes
const notes = searchNotes(provider, ['diabetes', 'a1c', 'metformin', 'glucose']);
```

## Trend Analysis

```javascript
function analyzeTrend(values) {
  if (values.length < 2) return 'insufficient data';
  const recent = values[0].value;
  const previous = values[1].value;
  const pctChange = ((recent - previous) / previous * 100).toFixed(1);
  
  if (pctChange > 5) return `increased ${pctChange}%`;
  if (pctChange < -5) return `decreased ${Math.abs(pctChange)}%`;
  return 'stable';
}

// Example
const a1cValues = getObservations(provider, '4548-4');
console.log('A1c trend:', analyzeTrend(a1cValues));
```

## Finding Abnormal Results

```javascript
function findAbnormalLabs(provider) {
  return provider.fhir.Observation?.filter(obs => {
    const code = obs.interpretation?.[0]?.coding?.[0]?.code;
    return ['H', 'L', 'HH', 'LL', 'A'].includes(code);
  }).map(obs => ({
    test: obs.code?.coding?.[0]?.display,
    value: obs.valueQuantity?.value,
    unit: obs.valueQuantity?.unit,
    flag: obs.interpretation?.[0]?.coding?.[0]?.display,
    date: obs.effectiveDateTime
  }));
}
```
