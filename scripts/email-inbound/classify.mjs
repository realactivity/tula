// classify.mjs — Phase C: Rule-based classifier for inbound email router.
// Pure function, no side effects, easy to unit test.
//
// Input: object with at least { subject, fromAddress?, bodyPreview?, attachments? }
//   attachments: array of { name, contentType? }
//
// Output:
// {
//   route: 'med-pdf' | 'wearable-ingest' | 'unclassified',
//   confidence: 'high' | 'medium' | 'low',
//   reason: string
// }
//
// Rules are intentionally simple and deterministic first.
// See inbound-email-router-build-spec.md §8 for rationale.

const WEARABLE_HINTS = [
  'garmin', 'withings', 'scale', 'body comp', 'bodycomp', 'body-composition',
  'fitbit', 'oura', 'whoop', 'steps', 'vo2', 'heart rate', 'hrv', 'sleep',
  // Common wearable export signals (weight data, CSV/JSON exports from Garmin/Withings/etc.)
  'weight', 'csv', 'json', 'export', 'body mass', 'lean mass', 'fat mass'
];

// Screenshot / portal capture signals. These are common when people photograph
// pharmacy portals (CVS, Walgreens, etc.), MyChart, Epic, or other health apps.
// Treated as strong signals for medical images (not just PDFs).
const SCREENSHOT_HINTS = [
  'screenshot', 'screen shot', 'cvs', 'walgreens', 'rite aid', 'pharmacy',
  'prescription', 'rx', 'refill', 'portal', 'medication', 'meds', 'your prescription'
];

// Cell phone / personal health photo signals.
// Covers photos taken with a phone of skin issues, rashes, bumps, moles, wounds,
// swelling, bruising, symptoms, etc. These are very common for longitudinal tracking.
// Subject lines are often vague ("this bump", "photo of my leg", "IMG_1234").
// We bias toward med-pdf so vision/OCR can describe them for later use in notes or prep packages.
const PERSONAL_HEALTH_PHOTO_HINTS = [
  'photo', 'picture', 'pic', 'bump', 'rash', 'spot', 'mole', 'skin', 'lesion',
  'swelling', 'bruise', 'bruising', 'wound', 'cut', 'sore', 'infection', 'redness',
  'discoloration', 'lump', 'growth', 'mark', 'this on my', 'on my skin', 'on my arm',
  'on my leg', 'on my back', 'on my face', 'looks like', 'what is this'
];

const MED_HINTS = [
  'lab', 'labs', 'result', 'report', 'mychart', 'epic', 'quest', 'labcorp',
  'pathology', 'radiology', 'discharge', 'imaging', 'cbc', 'metabolic',
  'blood', 'cholesterol', 'lipid', 'a1c', 'glucose', 'colonoscopy', 'mri', 'ct',
  // Portal / pharmacy / prescription screenshot signals
  'prescription', 'rx', 'refill', 'pharmacy', 'cvs', 'walgreens', 'rite aid', 'portal', 'medication', 'meds', 'dosage'
];

// Wearable detection is intentionally stricter on subject + attachment names
// to avoid over-triggering on body previews that mention devices in passing.
// Per spec: "Health report" + Withings PDF should route to med-pdf in v1.

function containsAny(text, hints) {
  const t = (text || '').toLowerCase();
  return hints.some(h => t.includes(h));
}

function getAttachmentNames(attachments = []) {
  return attachments.map(a => (a.name || '').toLowerCase());
}

export function classify(input = {}) {
  const {
    subject = '',
    fromAddress = '',
    bodyPreview = '',
    attachments = []
  } = input;

  const subj = subject.toLowerCase();
  const from = fromAddress.toLowerCase();
  const preview = bodyPreview.toLowerCase();
  const names = getAttachmentNames(attachments);

  const primaryText = [subj, ...names].join(' ');   // subject + filenames (strong signals)
  const allText = [subj, from, preview, ...names].join(' ');

  const hasPdf = names.some(n => n.endsWith('.pdf'));
  const hasImage = names.some(n => /\.(jpe?g|png|heic|webp)$/.test(n));

  // Wearable: prefer strong signals in subject or attachment names
  const wearableInPrimary = containsAny(primaryText, WEARABLE_HINTS);
  const wearableInPreview = containsAny(preview, WEARABLE_HINTS);

  if (wearableInPrimary || (wearableInPreview && !hasPdf)) {
    const isVendor = ['garmin', 'withings', 'fitbit', 'oura', 'whoop'].some(v => primaryText.includes(v));
    const confidence = (isVendor || wearableInPrimary) ? 'high' : 'medium';

    return {
      route: 'wearable-ingest',
      confidence,
      reason: `wearable hint matched${isVendor ? ' (vendor/known device)' : ''}`
    };
  }

  // Medical PDF / report (strong preference for PDFs with med keywords in subject)
  if (hasPdf && containsAny(primaryText, MED_HINTS)) {
    const isStrong = containsAny(subj, ['lab', 'result', 'report', 'mychart', 'epic']);
    return {
      route: 'med-pdf',
      confidence: isStrong ? 'high' : 'medium',
      reason: 'PDF with medical keywords in subject/filename'
    };
  }

  // Generic PDF (default for health-related PDFs when no stronger signal)
  if (hasPdf) {
    return {
      route: 'med-pdf',
      confidence: 'medium',
      reason: 'PDF attachment, defaulting to med-pdf (health context)'
    };
  }

  // Health-related image (no PDF) - includes screenshots of portals/pharmacies + cell phone photos of skin/symptoms
  const hasScreenshotSignal = containsAny(allText, SCREENSHOT_HINTS);
  const hasPersonalPhotoSignal = containsAny(allText, PERSONAL_HEALTH_PHOTO_HINTS);

  if (hasImage && (
    containsAny(allText, [...WEARABLE_HINTS, ...MED_HINTS]) ||
    hasScreenshotSignal ||
    hasPersonalPhotoSignal
  )) {
    const route = containsAny(primaryText, WEARABLE_HINTS) ? 'wearable-ingest' : 'med-pdf';

    let confidence = 'medium';
    let reason = 'health-related image attachment';

    if (hasScreenshotSignal) {
      confidence = 'high';
      reason = 'health screenshot / portal capture (likely needs vision/OCR)';
    } else if (hasPersonalPhotoSignal) {
      confidence = 'high';
      reason = 'personal health photo (skin/symptom capture, likely needs vision/OCR for description)';
    }

    return { route, confidence, reason };
  }

  // Fallback
  return {
    route: 'unclassified',
    confidence: 'low',
    reason: 'no strong rule matched'
  };
}

// Convenience helper for messages that have already been materialized
export function classifyFromMetadata(metadata, attachmentList = []) {
  return classify({
    subject: metadata.subject,
    fromAddress: metadata.from?.address || metadata.from?.emailAddress?.address || '',
    bodyPreview: metadata.bodyPreview,
    attachments: attachmentList
  });
}
