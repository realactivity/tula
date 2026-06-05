// Build a local skill zip in the browser with selected health records bundled in.

import JSZip from 'jszip';
import { getSkillTemplate } from './api';
import { getFhirData, type SavedConnection } from './connections';
import { redactPayloadWithProfile, type RedactionProfile } from './redaction';

/**
 * Build a skill zip containing the local SKILL.md, references, and
 * the user's selected health records in a data/ directory.
 */
export async function buildLocalSkillZip(
  connections: SavedConnection[],
  redactionProfile?: RedactionProfile | null,
): Promise<Blob> {
  const template = await getSkillTemplate();
  const zip = new JSZip();
  const root = zip.folder('health-record-assistant')!;

  // SKILL.md (local variant - references data/ directory)
  root.file('SKILL.md', template.skillMd);

  // Reference docs
  const refs = root.folder('references')!;
  for (const [name, content] of Object.entries(template.references)) {
    refs.file(name, content);
  }

  // Bundle selected health records into data/
  const dataDir = root.folder('data')!;
  const usedNames = new Set<string>();
  for (const conn of connections) {
    const cached = await getFhirData(conn.id);
    if (!cached) continue;

    const payload = {
      provider: conn.providerName,
      patientDisplayName: conn.patientDisplayName || conn.patientId,
      patientBirthDate: conn.patientBirthDate || null,
      fhir: cached.fhir,
      attachments: cached.attachments,
      fetchedAt: cached.fetchedAt,
    };
    const payloadToWrite = redactionProfile
      ? redactPayloadWithProfile(payload, redactionProfile)
      : payload;

    // Sanitise provider name into a safe filename, deduplicating collisions
    let safeName = conn.providerName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'provider';
    if (usedNames.has(safeName)) {
      let n = 2;
      while (usedNames.has(`${safeName}-${n}`)) n++;
      safeName = `${safeName}-${n}`;
    }
    usedNames.add(safeName);
    dataDir.file(`${safeName}.json`, JSON.stringify(payloadToWrite, null, 2));
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
