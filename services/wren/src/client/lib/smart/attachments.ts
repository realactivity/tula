// Attachment extraction for clinical documents

export interface ProcessedAttachmentOriginal {
  contentIndex: number;        // Index within resource's content/presentedForm array (0-based)
  contentType: string;
  contentPlaintext: string | null;
  contentBase64: string | null;
  sourceFormatCode?: string | null;
  sourceFormatDisplay?: string | null;
  sourceFormatSystem?: string | null;
  sourceProfiles?: string[] | null;
  sourceTypeCode?: string | null;
  sourceTypeDisplay?: string | null;
  sourceTypeSystem?: string | null;
  sourceTypeText?: string | null;
}

export interface ProcessedAttachment {
  source: {
    resourceType: string;
    resourceId: string;
  };
  // Index into originals[]; mirrors original content/presentedForm index.
  bestEffortFrom: number | null;
  bestEffortPlaintext: string | null;
  originals: ProcessedAttachmentOriginal[];
}

const MAX_CONCURRENT_ATTACHMENTS = 5;
let rtfModulePromise: Promise<any> | null = null;
let rtfLoggingConfigured = false;

export type AttachmentProgressCallback = (completed: number, total: number, detail: string) => void;

interface ExtractedAttachment extends ProcessedAttachmentOriginal {
  resourceType: string;
  resourceId: string;
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

/**
 * Extract and process attachments from DocumentReference and DiagnosticReport resources.
 */
export async function extractAttachments(
  resources: any[],
  fhirBaseUrl: string,
  accessToken: string,
  onProgress?: AttachmentProgressCallback
): Promise<ProcessedAttachment[]> {
  const extractedByEntryKey = new Map<string, ExtractedAttachment>();

  // First pass: count total attachments to process
  const toProcess: Array<{
    node: any;
    resourceType: string;
    resourceId: string;
    contentIndex: number;
    contentType: string;
    sourceHints: AttachmentSourceHints | null;
  }> = [];
  for (const resource of resources) {
    const resourceType = resource.resourceType;
    const resourceId = resource.id;
    const nodes = findAttachmentNodes(resource);
    
    for (const { node, index, sourceHints } of nodes) {
      const contentType = node.contentType || 'application/octet-stream';
      toProcess.push({ node, resourceType, resourceId, contentIndex: index, contentType, sourceHints });
    }
  }

  const total = toProcess.length;
  onProgress?.(0, total, '');

  // Second pass: fetch and process in parallel with semaphore
  const semaphore = new Semaphore(MAX_CONCURRENT_ATTACHMENTS);
  let completed = 0;

  const promises = toProcess.map(async ({ node, resourceType, resourceId, contentIndex, contentType, sourceHints }) => {
    await semaphore.acquire();
    const typeLabel = getContentTypeLabel(contentType);
    
    try {
      const processed = await fetchAndProcessAttachment(
        node,
        resourceType,
        resourceId,
        contentIndex,
        fhirBaseUrl,
        accessToken,
        sourceHints,
      );
      if (processed) {
        const entryKey = `${processed.resourceType}/${processed.resourceId}/${processed.contentIndex}`;
        extractedByEntryKey.set(entryKey, processed);
      }
    } catch (err) {
      console.warn(`Failed to process attachment:`, err);
    } finally {
      completed++;
      onProgress?.(completed, total, typeLabel);
      semaphore.release();
    }
  });

  await Promise.all(promises);

  const groupedBySource = new Map<string, ProcessedAttachment>();
  for (const item of toProcess) {
    const sourceKey = `${item.resourceType}/${item.resourceId}`;
    let group = groupedBySource.get(sourceKey);
    if (!group) {
      group = {
        source: {
          resourceType: item.resourceType,
          resourceId: item.resourceId,
        },
        bestEffortFrom: null,
        bestEffortPlaintext: null,
        originals: [],
      };
      groupedBySource.set(sourceKey, group);
    }

    const entryKey = `${item.resourceType}/${item.resourceId}/${item.contentIndex}`;
    const extracted = extractedByEntryKey.get(entryKey);
    group.originals[item.contentIndex] = extracted
      ? {
          contentIndex: extracted.contentIndex,
          contentType: extracted.contentType,
          contentPlaintext: extracted.contentPlaintext,
          contentBase64: extracted.contentBase64,
          sourceFormatCode: extracted.sourceFormatCode ?? null,
          sourceFormatDisplay: extracted.sourceFormatDisplay ?? null,
          sourceFormatSystem: extracted.sourceFormatSystem ?? null,
          sourceProfiles: extracted.sourceProfiles ?? null,
          sourceTypeCode: extracted.sourceTypeCode ?? null,
          sourceTypeDisplay: extracted.sourceTypeDisplay ?? null,
          sourceTypeSystem: extracted.sourceTypeSystem ?? null,
          sourceTypeText: extracted.sourceTypeText ?? null,
        }
      : {
          contentIndex: item.contentIndex,
          contentType: item.contentType,
          contentPlaintext: null,
          contentBase64: null,
          sourceFormatCode: item.sourceHints?.format?.code ?? null,
          sourceFormatDisplay: item.sourceHints?.format?.display ?? null,
          sourceFormatSystem: item.sourceHints?.format?.system ?? null,
          sourceProfiles: item.sourceHints?.profiles?.length ? item.sourceHints.profiles : null,
          sourceTypeCode: item.sourceHints?.type?.code ?? null,
          sourceTypeDisplay: item.sourceHints?.type?.display ?? null,
          sourceTypeSystem: item.sourceHints?.type?.system ?? null,
          sourceTypeText: item.sourceHints?.typeText ?? null,
        };
  }

  const grouped = Array.from(groupedBySource.values());
  for (const group of grouped) {
    for (let i = 0; i < group.originals.length; i += 1) {
      if (group.originals[i]) continue;
      group.originals[i] = {
        contentIndex: i,
        contentType: 'application/octet-stream',
        contentPlaintext: null,
        contentBase64: null,
        sourceFormatCode: null,
        sourceFormatDisplay: null,
        sourceFormatSystem: null,
        sourceProfiles: null,
        sourceTypeCode: null,
        sourceTypeDisplay: null,
        sourceTypeSystem: null,
        sourceTypeText: null,
      };
    }
    const bestIndex = chooseBestEffortOriginalIndex(group.originals);
    group.bestEffortFrom = bestIndex;
    group.bestEffortPlaintext =
      bestIndex === null ? null : group.originals[bestIndex]?.contentPlaintext ?? null;
  }

  return grouped;
}

function mimePreferenceRank(contentType: string): number {
  const mime = contentType.toLowerCase();
  if (mime.includes('html') || mime.includes('xhtml')) return 0;
  if (mime.includes('rtf')) return 1;
  if (mime.includes('xml')) return 2;
  if (mime.startsWith('text/')) return 3;
  if (mime.includes('json')) return 4;
  return 5;
}

function chooseBestEffortOriginalIndex(originals: ProcessedAttachmentOriginal[]): number | null {
  let best: ProcessedAttachmentOriginal | null = null;
  for (const original of originals) {
    if (!original) continue;
    const hasPayload = Boolean(original.contentBase64 || original.contentPlaintext);
    if (!hasPayload) continue;
    if (!best) {
      best = original;
      continue;
    }
    const rankA = mimePreferenceRank(original.contentType || '');
    const rankB = mimePreferenceRank(best.contentType || '');
    if (rankA !== rankB) {
      if (rankA < rankB) best = original;
      continue;
    }
    const textLenA = original.contentPlaintext?.length || 0;
    const textLenB = best.contentPlaintext?.length || 0;
    if (textLenA !== textLenB) {
      if (textLenA > textLenB) best = original;
      continue;
    }
    const base64LenA = original.contentBase64?.length || 0;
    const base64LenB = best.contentBase64?.length || 0;
    if (base64LenA !== base64LenB) {
      if (base64LenA > base64LenB) best = original;
      continue;
    }
    if (original.contentIndex < best.contentIndex) best = original;
  }
  return best ? best.contentIndex : null;
}

/**
 * Get a friendly label for a content type.
 */
function getContentTypeLabel(contentType: string): string {
  const type = contentType.toLowerCase();
  if (type.includes('pdf')) return 'PDF';
  if (type.includes('html')) return 'HTML';
  if (type.includes('xml')) return 'XML';
  if (type.includes('rtf')) return 'RTF';
  if (type.includes('plain')) return 'Text';
  if (type.includes('json')) return 'JSON';
  if (type.includes('image')) return 'Image';
  if (type.includes('dicom')) return 'DICOM';
  // Return the subtype (after the /)
  const parts = contentType.split('/');
  return parts[1]?.split(';')[0] || contentType;
}

interface AttachmentNode {
  node: any;
  index: number;
  sourceHints: AttachmentSourceHints | null;
}

interface NormalizedCoding {
  system: string | null;
  code: string | null;
  display: string | null;
}

interface AttachmentSourceHints {
  format: NormalizedCoding | null;
  profiles: string[];
  type: NormalizedCoding | null;
  typeText: string | null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeCoding(codingLike: unknown): NormalizedCoding | null {
  if (!codingLike || typeof codingLike !== 'object') return null;
  const record = codingLike as Record<string, unknown>;
  const system = normalizeString(record.system);
  const code = normalizeString(record.code);
  const display = normalizeString(record.display);
  if (!system && !code && !display) return null;
  return { system, code, display };
}

function extractFirstCoding(value: unknown): NormalizedCoding | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const coding = extractFirstCoding(entry);
      if (coding) return coding;
    }
    return null;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.coding)) {
      for (const entry of record.coding) {
        const coding = normalizeCoding(entry);
        if (coding) return coding;
      }
    }

    const direct = normalizeCoding(record);
    if (direct) return direct;
  }

  return null;
}

function extractProfileHints(profileLike: unknown): string[] {
  const out = new Set<string>();
  const add = (value: unknown): void => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) out.add(trimmed);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    for (const key of ['canonical', 'url', 'uri', 'valueCanonical', 'valueUri', 'reference', 'value']) {
      const raw = record[key];
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed) out.add(trimmed);
      } else if (Array.isArray(raw)) {
        raw.forEach(add);
      }
    }
  };

  if (Array.isArray(profileLike)) profileLike.forEach(add);
  else add(profileLike);
  return Array.from(out);
}

function buildAttachmentSourceHints(resource: any, contentEntry: any): AttachmentSourceHints {
  return {
    format: extractFirstCoding(contentEntry?.format),
    profiles: extractProfileHints(contentEntry?.profile),
    type: extractFirstCoding(resource?.type),
    typeText: normalizeString(resource?.type?.text),
  };
}

/**
 * Find attachment nodes in a FHIR resource.
 */
function findAttachmentNodes(resource: any): AttachmentNode[] {
  const nodes: AttachmentNode[] = [];

  // DocumentReference.content[].attachment
  if (resource.content && Array.isArray(resource.content)) {
    for (let i = 0; i < resource.content.length; i++) {
      if (resource.content[i].attachment) {
        nodes.push({
          node: resource.content[i].attachment,
          index: i,
          sourceHints: resource.resourceType === 'DocumentReference'
            ? buildAttachmentSourceHints(resource, resource.content[i])
            : null,
        });
      }
    }
  }

  // DiagnosticReport.presentedForm[]
  if (resource.presentedForm && Array.isArray(resource.presentedForm)) {
    for (let i = 0; i < resource.presentedForm.length; i++) {
      nodes.push({ node: resource.presentedForm[i], index: i, sourceHints: null });
    }
  }

  return nodes;
}

/**
 * Fetch and process a single attachment.
 */
async function fetchAndProcessAttachment(
  attachment: any,
  resourceType: string,
  resourceId: string,
  contentIndex: number,
  fhirBaseUrl: string,
  accessToken: string,
  sourceHints: AttachmentSourceHints | null,
): Promise<ExtractedAttachment | null> {
  const contentType = attachment.contentType || 'application/octet-stream';
  let url = attachment.url;

  // Handle relative URLs
  if (url && !url.startsWith('http')) {
    url = `${fhirBaseUrl.replace(/\/+$/, '')}/${url}`;
  }

  // Handle inline base64 data
  if (attachment.data) {
    const data = attachment.data;
    const plaintext = await extractTextFromBase64(data, contentType, sourceHints);
    return {
      resourceType,
      resourceId,
      contentIndex,
      contentType,
      contentPlaintext: plaintext,
      contentBase64: data,
      sourceFormatCode: sourceHints?.format?.code ?? null,
      sourceFormatDisplay: sourceHints?.format?.display ?? null,
      sourceFormatSystem: sourceHints?.format?.system ?? null,
      sourceProfiles: sourceHints?.profiles?.length ? sourceHints.profiles : null,
      sourceTypeCode: sourceHints?.type?.code ?? null,
      sourceTypeDisplay: sourceHints?.type?.display ?? null,
      sourceTypeSystem: sourceHints?.type?.system ?? null,
      sourceTypeText: sourceHints?.typeText ?? null,
    };
  }

  if (!url) return null;

  // Fetch the attachment
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: contentType,
    },
  });

  if (!response.ok) {
    console.warn(`Failed to fetch attachment: ${response.status}`);
    return null;
  }

  const blob = await response.blob();

  // Convert to base64
  const base64 = await blobToBase64(blob);

  // Extract text
  const plaintext = await extractTextFromBlob(blob, contentType, sourceHints);

  return {
    resourceType,
    resourceId,
    contentIndex,
    contentType,
    contentPlaintext: plaintext,
    contentBase64: base64,
    sourceFormatCode: sourceHints?.format?.code ?? null,
    sourceFormatDisplay: sourceHints?.format?.display ?? null,
    sourceFormatSystem: sourceHints?.format?.system ?? null,
    sourceProfiles: sourceHints?.profiles?.length ? sourceHints.profiles : null,
    sourceTypeCode: sourceHints?.type?.code ?? null,
    sourceTypeDisplay: sourceHints?.type?.display ?? null,
    sourceTypeSystem: sourceHints?.type?.system ?? null,
    sourceTypeText: sourceHints?.typeText ?? null,
  };
}

/**
 * Convert blob to base64.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Extract plain text from blob based on content type.
 */
async function extractTextFromBlob(
  blob: Blob,
  contentType: string,
  sourceHints: AttachmentSourceHints | null,
): Promise<string | null> {
  try {
    const text = await blob.text();
    const mime = contentType.toLowerCase();

    if (mime.startsWith('text/html') || mime.includes('xhtml')) {
      return htmlToText(text);
    }

    if (mime.includes('xml')) {
      return xmlToText(text, sourceHints);
    }

    if (mime.startsWith('application/rtf') || mime.startsWith('text/rtf')) {
      return await rtfToText(text);
    }

    if (
      mime.startsWith('text/') ||
      mime === 'application/json' ||
      mime === 'application/fhir+json'
    ) {
      return text;
    }

    // For PDFs and other binary, return null (base64 is still available)
    return null;
  } catch (err) {
    console.warn('Text extraction failed:', err);
    return null;
  }
}

/**
 * Extract text from base64-encoded data.
 */
async function extractTextFromBase64(
  data: string,
  contentType: string,
  sourceHints: AttachmentSourceHints | null,
): Promise<string | null> {
  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const text = new TextDecoder().decode(bytes);
    const mime = contentType.toLowerCase();

    if (mime.startsWith('text/html') || mime.includes('xhtml')) {
      return htmlToText(text);
    }
    if (mime.includes('xml')) {
      return xmlToText(text, sourceHints);
    }
    if (mime.startsWith('application/rtf') || mime.startsWith('text/rtf')) {
      return await rtfToText(text);
    }
    if (mime.startsWith('text/')) {
      return text;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Convert HTML to plain text.
 */
function htmlToText(html: string): string {
  // Create a DOM parser
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // Remove script and style elements
  const scripts = doc.querySelectorAll('script, style');
  scripts.forEach((el) => el.remove());

  // Get text content
  let text = doc.body?.textContent || doc.documentElement?.textContent || '';

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Convert XML to plain text (extract text nodes).
 */
function xmlToText(xml: string, sourceHints: AttachmentSourceHints | null): string {
  const genericFallback = (): string => xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      return genericFallback();
    }

    const ccdaNarrative = extractCcdaNarrativeText(doc, sourceHints);
    if (ccdaNarrative) {
      return ccdaNarrative;
    }

    // Extract all text content
    const text = doc.documentElement?.textContent || '';
    return normalizeExtractedText(text) || genericFallback();
  } catch {
    return genericFallback();
  }
}

function localNameLower(node: Node | null): string {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as Element;
  return (el.localName || el.nodeName || '').toLowerCase();
}

function directChildElements(parent: Element): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i += 1) {
    const child = parent.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) out.push(child as Element);
  }
  return out;
}

function directChildByLocalName(parent: Element, name: string): Element | null {
  const target = name.toLowerCase();
  for (const child of directChildElements(parent)) {
    if (localNameLower(child) === target) return child;
  }
  return null;
}

function isLikelyCcdaDocument(doc: Document, sourceHints: AttachmentSourceHints | null): boolean {
  const code = sourceHints?.format?.code?.toLowerCase() || '';
  const display = sourceHints?.format?.display?.toLowerCase() || '';
  if (code.includes('ccda') || code.includes('clinicaldocument') || code.includes('structuredbody')) return true;
  if (display.includes('c-cda') || display.includes('ccda')) return true;

  const root = doc.documentElement;
  if (!root) return false;
  const rootName = localNameLower(root);
  const ns = (root.namespaceURI || '').toLowerCase();
  return rootName === 'clinicaldocument' && ns.includes('hl7-org:v3');
}

function normalizeCcdaNarrativeText(input: string): string {
  return input
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function narrativeElementToText(element: Element): string {
  const lines: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue || '';
      if (value) lines.push(value);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const name = localNameLower(el);

    if (name === 'br') {
      lines.push('\n');
      return;
    }

    const blockLike =
      name === 'paragraph' ||
      name === 'p' ||
      name === 'item' ||
      name === 'list' ||
      name === 'table' ||
      name === 'tr' ||
      name === 'caption' ||
      name === 'title';
    if (blockLike && lines.length > 0 && !lines[lines.length - 1].endsWith('\n')) {
      lines.push('\n');
    }

    const isCell = name === 'td' || name === 'th';
    if (isCell && lines.length > 0 && !lines[lines.length - 1].endsWith('\n')) {
      lines.push(' | ');
    }

    for (let i = 0; i < el.childNodes.length; i += 1) {
      walk(el.childNodes[i]);
    }

    if ((name === 'tr' || blockLike) && !lines[lines.length - 1]?.endsWith('\n')) {
      lines.push('\n');
    }
  };

  walk(element);
  return normalizeCcdaNarrativeText(lines.join(''));
}

function extractCcdaNarrativeText(doc: Document, sourceHints: AttachmentSourceHints | null): string | null {
  if (!isLikelyCcdaDocument(doc, sourceHints)) return null;
  const root = doc.documentElement;
  if (!root) return null;

  const component = directChildByLocalName(root, 'component');
  const structuredBody = component ? directChildByLocalName(component, 'structuredBody') : null;
  if (!structuredBody) return null;

  const sectionTexts: string[] = [];

  const walkComponent = (componentEl: Element): void => {
    const section = directChildByLocalName(componentEl, 'section');
    if (section) {
      const titleEl = directChildByLocalName(section, 'title');
      const textEl = directChildByLocalName(section, 'text');
      const titleText = normalizeCcdaNarrativeText(titleEl?.textContent || '');
      const bodyText = textEl ? narrativeElementToText(textEl) : normalizeCcdaNarrativeText(section.textContent || '');

      const sectionLines: string[] = [];
      if (titleText) sectionLines.push(titleText);
      if (bodyText) sectionLines.push(bodyText);
      if (sectionLines.length > 0) sectionTexts.push(sectionLines.join('\n'));

      for (const child of directChildElements(section)) {
        if (localNameLower(child) !== 'component') continue;
        walkComponent(child);
      }
      return;
    }

    for (const child of directChildElements(componentEl)) {
      if (localNameLower(child) !== 'component') continue;
      walkComponent(child);
    }
  };

  for (const child of directChildElements(structuredBody)) {
    if (localNameLower(child) !== 'component') continue;
    walkComponent(child);
  }

  const joined = normalizeCcdaNarrativeText(sectionTexts.join('\n\n'));
  if (joined) return joined;

  // Some CCDAs place narrative in non-standard spots; fallback to whole-document text.
  const docText = normalizeCcdaNarrativeText(root.textContent || '');
  return docText || null;
}

function stringToRtfBuffer(value: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(value);
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
}

async function getRtfModule(): Promise<any> {
  if (!rtfModulePromise) {
    rtfModulePromise = import('rtf.js');
  }
  return rtfModulePromise;
}

/**
 * Convert RTF to plain text via rtf.js rendering.
 */
async function rtfToText(rtf: string): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  try {
    const mod = await getRtfModule();
    const RTFJS = mod?.RTFJS;
    const WMFJS = mod?.WMFJS;
    const EMFJS = mod?.EMFJS;
    if (!RTFJS?.Document) return null;

    if (!rtfLoggingConfigured) {
      try {
        RTFJS.loggingEnabled?.(false);
        WMFJS?.loggingEnabled?.(false);
        EMFJS?.loggingEnabled?.(false);
      } catch {
        // ignore logging config failures
      }
      rtfLoggingConfigured = true;
    }

    const doc = new RTFJS.Document(stringToRtfBuffer(rtf));
    const elements = await doc.render();
    const container = document.createElement('div');
    for (const el of elements || []) {
      if (el instanceof HTMLElement) container.appendChild(el);
    }
    const extracted =
      ((container as any).innerText as string | undefined) ||
      container.textContent ||
      '';
    const normalized = normalizeExtractedText(extracted);
    return normalized || null;
  } catch (err) {
    console.warn('RTF text extraction failed:', err);
    return null;
  }
}
