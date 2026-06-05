import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { getFhirData, type CachedFhirData } from '../lib/connections';
import type { ProcessedAttachment, ProcessedAttachmentOriginal } from '../lib/smart/attachments';
import { useRecordsStore } from '../store/records';
import RecordsHeaderBar from '../components/RecordsHeaderBar';

const MAIN_RESOURCE_TYPES = [
  'patient',
  'relatedperson',
  'condition',
  'allergyintolerance',
  'observation',
  'medicationrequest',
  'medicationstatement',
  'procedure',
  'encounter',
  'diagnosticreport',
  'documentreference',
  'immunization',
  'careplan',
  'careteam',
  'goal',
  'coverage',
];

const JSON_STRING_CACHE = new WeakMap<object, string>();
const RESOURCE_FORMATTED_CACHE = new WeakMap<object, { fields: ResourceField[]; remainingLines: StructuredTreeLine[] }>();
const ATTACHMENT_FORMATTED_CACHE = new WeakMap<object, StructuredTreeLine[]>();
const ATTACHMENT_RENDER_CACHE = new WeakMap<object, AttachmentRenderModel>();
const ATTACHMENT_RTF_HTML_CACHE = new WeakMap<object, string>();
const INITIAL_ROWS_PER_SECTION = 24;
const ROW_BATCH_SIZE = 64;
let rtfModulePromise: Promise<any> | null = null;
let rtfLoggingConfigured = false;

function fmtSize(b: number | null): string {
  if (!b) return 'no data';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString();
}

function normalizeString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function formatDateLike(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value.includes('T')) {
    const t = new Date(value).getTime();
    if (!Number.isNaN(t)) return new Date(t).toLocaleString();
  }
  return value;
}

function shortenReference(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const slash = trimmed.indexOf('/');
  if (slash > 0 && slash < trimmed.length - 1) {
    const kind = trimmed.slice(0, slash);
    const id = trimmed.slice(slash + 1);
    if (id.length > 18) return `${kind}/${id.slice(0, 8)}...${id.slice(-6)}`;
    return trimmed;
  }

  if (trimmed.length > 56) return `${trimmed.slice(0, 28)}...${trimmed.slice(-16)}`;
  return trimmed;
}

function shortenOpaqueToken(value: string, max = 28): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, 12)}...${trimmed.slice(-8)}`;
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 1)}…`;
}

function looksOpaqueIdentifier(value: string): boolean {
  if (value.length < 20) return false;
  if (/\s/.test(value)) return false;
  const alphaNum = value.match(/[A-Za-z0-9]/g)?.length || 0;
  const ratio = alphaNum / value.length;
  return ratio > 0.8;
}

function codeText(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const directText = normalizeString(obj.text);
  if (directText) return directText;
  const coding = Array.isArray(obj.coding) ? obj.coding : [];
  for (const entry of coding) {
    if (!entry || typeof entry !== 'object') continue;
    const codingObj = entry as Record<string, unknown>;
    const display = normalizeString(codingObj.display);
    if (display) return display;
    const code = normalizeString(codingObj.code);
    if (code) return code;
  }
  return null;
}

function summarizeHumanName(name: unknown): string {
  if (!name || typeof name !== 'object') return '';
  const obj = name as Record<string, unknown>;
  const text = normalizeString(obj.text);
  if (text) return text;
  const family = normalizeString(obj.family) || '';
  const given = Array.isArray(obj.given)
    ? obj.given.filter((item: unknown): item is string => typeof item === 'string').join(' ')
    : '';
  return `${given} ${family}`.trim();
}

function summarizeResource(resource: any, index: number): string {
  const resourceType = normalizeString(resource?.resourceType) || 'Resource';
  const name = Array.isArray(resource?.name) && resource.name.length > 0
    ? summarizeHumanName(resource.name[0])
    : '';
  const code = codeText(resource?.code);
  const description = normalizeString(resource?.description);
  const title = normalizeString(resource?.title);
  const primary = name || code || description || title;
  if (primary) return `${resourceType}: ${truncateText(primary, 120)}`;

  const status = normalizeString(resource?.status);
  if (status) return `${resourceType}: ${status}`;
  return `${resourceType} ${index + 1}`;
}

interface ResourceField {
  label: string;
  value: string;
}

interface ResourcePreviewResult {
  fields: ResourceField[];
  coveredPaths: string[];
}

function formatFieldLabel(label: string): string {
  switch (label) {
    case 'status':
      return 'Status';
    case 'code':
      return 'Code';
    case 'category':
      return 'Category';
    case 'value':
      return 'Value';
    case 'date':
      return 'Date';
    case 'subject':
      return 'Subject';
    case 'encounter':
      return 'Encounter';
    case 'performer':
      return 'Performer';
    case 'medication':
      return 'Medication';
    case 'reason':
      return 'Reason';
    case 'note':
      return 'Note';
    case 'severity':
      return 'Severity';
    case 'clinical':
      return 'Clinical status';
    case 'verification':
      return 'Verification';
    case 'onset':
      return 'Onset';
    case 'abatement':
      return 'Abatement';
    default:
      return label;
  }
}

function formatFieldValue(label: string, rawString: string): string {
  let value = rawString;
  if (
    label === 'subject' ||
    label === 'encounter' ||
    label === 'performer' ||
    label === 'reference'
  ) {
    value = shortenReference(value);
  }
  if (label.includes('date') || label === 'onset' || label === 'issued') {
    value = formatDateLike(value);
  }
  if (label === 'note') {
    value = truncateText(value.replace(/\s+/g, ' ').trim(), 200);
  }
  if (label === 'id' && looksOpaqueIdentifier(value)) {
    value = shortenOpaqueToken(value);
  }
  if (looksOpaqueIdentifier(value) && value.length > 44) {
    value = shortenOpaqueToken(value, 44);
  }
  return value;
}

function resourcePreviewFields(resource: any): ResourcePreviewResult {
  const fields: ResourceField[] = [];
  const coveredPaths = new Set<string>();
  const seen = new Set<string>();
  const addField = (label: string, raw: unknown, paths: string[] = []) => {
    const rawString = normalizeString(raw) || codeText(raw);
    if (!rawString) return;
    const value = formatFieldValue(label, rawString);

    const line = `${label}:${value}`;
    if (seen.has(line)) return;
    seen.add(line);
    fields.push({ label, value });
    for (const path of paths) coveredPaths.add(path);
  };

  addField('status', resource?.status, ['status']);
  addField('code', resource?.code, ['code']);
  addField('category', Array.isArray(resource?.category) ? resource.category[0] : resource?.category, ['category']);
  addField('value', normalizeString(resource?.valueString), ['valueString']);
  if (resource?.valueQuantity && typeof resource.valueQuantity === 'object') {
    const q = resource.valueQuantity as Record<string, unknown>;
    const qv = normalizeString(q.value);
    const qu = normalizeString(q.unit);
    if (qv || qu) addField('value', [qv, qu].filter(Boolean).join(' '), ['valueQuantity']);
  }
  addField('value', resource?.valueCodeableConcept, ['valueCodeableConcept']);
  addField('date', resource?.effectiveDateTime || resource?.recordedDate || resource?.authoredOn || resource?.issued, [
    'effectiveDateTime',
    'recordedDate',
    'authoredOn',
    'issued',
  ]);
  addField('subject', resource?.subject?.reference, ['subject.reference']);
  addField('encounter', resource?.encounter?.reference, ['encounter.reference']);
  addField(
    'performer',
    Array.isArray(resource?.performer) ? resource.performer[0]?.display || resource.performer[0]?.reference : null,
    ['performer'],
  );
  addField('medication', resource?.medicationCodeableConcept || resource?.medicationReference?.reference, [
    'medicationCodeableConcept',
    'medicationReference.reference',
  ]);
  addField('reason', Array.isArray(resource?.reasonCode) ? resource.reasonCode[0] : null, ['reasonCode']);
  addField('note', Array.isArray(resource?.note) ? resource.note[0]?.text : null, ['note']);
  addField('severity', resource?.severity, ['severity']);
  addField('clinical', resource?.clinicalStatus, ['clinicalStatus']);
  addField('verification', resource?.verificationStatus, ['verificationStatus']);
  addField('onset', resource?.onsetDateTime || resource?.onsetString, ['onsetDateTime', 'onsetString']);
  addField('abatement', resource?.abatementDateTime || resource?.abatementString, ['abatementDateTime', 'abatementString']);

  return {
    fields: fields.slice(0, 7),
    coveredPaths: Array.from(coveredPaths.values()),
  };
}

function formatPrimitive(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function pathToString(path: Array<string | number>): string {
  if (path.length === 0) return '';
  let out = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      out += `[${segment}]`;
      continue;
    }
    if (!out) out = segment;
    else out += `.${segment}`;
  }
  return out;
}

function isCoveredPath(path: string, coveredPaths: Set<string>): boolean {
  if (!path) return false;
  for (const covered of coveredPaths) {
    if (path === covered) return true;
    if (path.startsWith(`${covered}.`)) return true;
    if (path.startsWith(`${covered}[`)) return true;
  }
  return false;
}

function formatStructuredPrimitive(value: unknown, keyName: string): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'string') return formatPrimitive(value);

  const normalized = value.replace(/\s+/g, ' ').trim();
  const lowerKey = keyName.toLowerCase();
  const keepFull =
    lowerKey === 'reference' ||
    lowerKey.endsWith('reference') ||
    lowerKey === 'subject' ||
    lowerKey === 'encounter' ||
    lowerKey === 'id' ||
    lowerKey.endsWith('id') ||
    lowerKey.includes('identifier') ||
    lowerKey === 'fullurl' ||
    lowerKey === 'url' ||
    lowerKey.endsWith('url') ||
    lowerKey === 'system' ||
    lowerKey.endsWith('system') ||
    lowerKey === 'value' ||
    lowerKey.startsWith('value') ||
    lowerKey.endsWith('value');
  if (keepFull) {
    return normalized;
  }

  return truncateText(normalized, 240);
}

interface StructuredTreeLine {
  kind: 'group' | 'leaf' | 'empty' | 'notice';
  depth: number;
  label: string;
  value?: string;
  tone?: 'extension';
}

type AttachmentRenderModel =
  | { kind: 'html'; html: string }
  | { kind: 'rtf'; rtf: string }
  | { kind: 'xml'; xml: string; flavor: string }
  | { kind: 'text'; text: string | null; flavor?: string | null };

type AttachmentOriginal = ProcessedAttachmentOriginal;
type AttachmentSourceGroup = ProcessedAttachment;

function humanizeKeyLabel(label: string): string {
  if (!label) return label;
  if (label.toLowerCase() === 'extension') return 'Extension';
  const noIndex = label.replace(/^\[(\d+)\]$/, 'Item $1');
  const spaced = noIndex.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function summarizeExtensionName(url: string): string {
  const raw = url.trim();
  if (!raw) return 'Item';
  try {
    const parsed = new URL(raw);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (parsed.hostname.endsWith('hl7.org')) {
      const structureIdx = pathParts.findIndex((part) => part.toLowerCase() === 'structuredefinition');
      if (structureIdx >= 0 && structureIdx < pathParts.length - 1) {
        return pathParts.slice(structureIdx + 1).join('/');
      }
      if (pathParts.length > 0) return pathParts.join('/');
      return parsed.hostname;
    }
    const tail = pathParts[pathParts.length - 1];
    return tail || parsed.hostname;
  } catch {
    const pieces = raw.split('/').filter(Boolean);
    return pieces[pieces.length - 1] || raw;
  }
}

function summarizeExtensionUrl(url: string): string {
  return `Ext: ${summarizeExtensionName(url)}`;
}

function summarizeArrayObjectEntry(value: Record<string, unknown>): string | null {
  const url = normalizeString(value.url);
  if (url) return summarizeExtensionUrl(url);
  const display = normalizeString(value.display);
  if (display) return truncateText(display, 90);
  const text = normalizeString(value.text);
  if (text) return truncateText(text, 90);
  const name = normalizeString(value.name);
  if (name) return truncateText(name, 90);
  const code = normalizeString(value.code);
  if (code) return truncateText(code, 70);
  const use = normalizeString(value.use);
  if (use) return truncateText(use, 70);
  const system = normalizeString(value.system);
  if (system) return shortenReference(system);
  return null;
}

function renderRemainingTreeLines(value: unknown, covered: string[] = []): StructuredTreeLine[] {
  const lines: StructuredTreeLine[] = [];
  const coveredPaths = new Set<string>(covered);

  const walk = (node: unknown, path: Array<string | number>, depth: number, label: string): void => {
    const pathLabel = pathToString(path);
    if (isCoveredPath(pathLabel, coveredPaths)) return;

    if (node === null || typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      lines.push({
        kind: 'leaf',
        depth,
        label: humanizeKeyLabel(label),
        value: formatStructuredPrimitive(node, label),
      });
      return;
    }

    if (Array.isArray(node)) {
      const isExtensionArray =
        label.toLowerCase() === 'extension' &&
        node.every((item) => item && typeof item === 'object' && !Array.isArray(item));
      if (isExtensionArray) {
        if (node.length === 0) {
          lines.push({ kind: 'empty', depth, label: 'No extensions' });
          return;
        }
        for (let i = 0; i < node.length; i += 1) {
          const child = node[i] as Record<string, unknown>;
          const url = normalizeString(child.url);
          const title = url ? summarizeExtensionName(url) : `Item ${i + 1}`;
          lines.push({ kind: 'group', depth, label: title, tone: 'extension' });
          if (url) {
            lines.push({ kind: 'leaf', depth: depth + 1, label: 'URL', value: url });
          }
          const childEntries = Object.entries(child).filter(([childKey]) => childKey !== 'url');
          if (childEntries.length === 0) {
            lines.push({ kind: 'empty', depth: depth + 1, label: 'No fields' });
            continue;
          }
          for (const [childKey, grandChild] of childEntries) {
            walk(grandChild, [...path, i, childKey], depth + 1, childKey);
          }
        }
        return;
      }

      lines.push({
        kind: 'group',
        depth,
        label: humanizeKeyLabel(label),
      });
      if (node.length === 0) {
        lines.push({ kind: 'empty', depth: depth + 1, label: 'No items' });
        return;
      }

      const allPrimitive = node.every(
        (item) =>
          item === null ||
          typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean',
      );
      if (allPrimitive) {
        const joined = node
          .map((item) => formatStructuredPrimitive(item, label))
          .join(', ');
        lines.push({
          kind: 'leaf',
          depth: depth + 1,
          label: 'Values',
          value: truncateText(joined, 220),
        });
        return;
      }

      for (let i = 0; i < node.length; i += 1) {
        const child = node[i];
        if (child && typeof child === 'object' && !Array.isArray(child)) {
          const childEntries = Object.entries(child as Record<string, unknown>);
          const summary = summarizeArrayObjectEntry(child as Record<string, unknown>);
          const withHeading = Boolean(summary) && node.length > 1;
          const childDepth = withHeading ? depth + 2 : depth + 1;
          if (withHeading && summary) {
            lines.push({ kind: 'group', depth: depth + 1, label: summary });
          }
          if (childEntries.length === 0) {
            lines.push({ kind: 'empty', depth: childDepth, label: 'No fields' });
            continue;
          }
          for (const [childKey, grandChild] of childEntries) {
            walk(grandChild, [...path, i, childKey], childDepth, childKey);
          }
          continue;
        }

        if (Array.isArray(child)) {
          const nestedLabel = node.length > 1 ? `Entry ${i + 1}` : 'Value';
          walk(child, [...path, i], depth + 1, nestedLabel);
          continue;
        }

        lines.push({
          kind: 'leaf',
          depth: depth + 1,
          label: node.length > 1 ? `Entry ${i + 1}` : 'Value',
          value: formatStructuredPrimitive(child, label),
        });
      }
      return;
    }

    if (node && typeof node === 'object') {
      const entries = Object.entries(node as Record<string, unknown>);
      lines.push({ kind: 'group', depth, label: humanizeKeyLabel(label) });
      if (entries.length === 0) {
        lines.push({ kind: 'empty', depth: depth + 1, label: 'No fields' });
      }
      for (const [key, child] of entries) {
        walk(child, [...path, key], depth + 1, key);
      }
    }
  };

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walk(child, [key], 0, key);
    }
  } else if (Array.isArray(value)) {
    walk(value, [], 0, 'root');
  } else {
    lines.push({
      kind: 'leaf',
      depth: 0,
      label: 'Value',
      value: formatStructuredPrimitive(value, 'value'),
    });
  }
  return lines;
}

function treeIndentStyle(depth: number): CSSProperties {
  return { paddingLeft: `${depth * 14}px` };
}

function getFormattedResourceModel(resource: unknown): { fields: ResourceField[]; remainingLines: StructuredTreeLine[] } {
  if (!resource || typeof resource !== 'object') return { fields: [], remainingLines: [] };
  const cached = RESOURCE_FORMATTED_CACHE.get(resource as object);
  if (cached) return cached;
  const preview = resourcePreviewFields(resource);
  const computed = {
    fields: preview.fields,
    remainingLines: renderRemainingTreeLines(resource, ['resourceType', 'id', ...preview.coveredPaths]),
  };
  RESOURCE_FORMATTED_CACHE.set(resource as object, computed);
  return computed;
}

function getFormattedAttachmentLines(attachment: unknown): StructuredTreeLine[] {
  if (!attachment || typeof attachment !== 'object') return [];
  const cached = ATTACHMENT_FORMATTED_CACHE.get(attachment as object);
  if (cached) return cached;
  const lines = renderRemainingTreeLines(attachment, [
    'resourceType',
    'resourceId',
    'contentType',
    'contentIndex',
    'contentPlaintext',
    'contentBase64',
  ]);
  ATTACHMENT_FORMATTED_CACHE.set(attachment as object, lines);
  return lines;
}

function decodeBase64ToText(base64: string): string | null {
  try {
    const normalized = base64
      .replace(/\s+/g, '')
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(base64.replace(/\s+/g, '').length / 4) * 4, '=');
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sanitizeHtmlForDisplay(inputHtml: string): string {
  const sanitized = DOMPurify.sanitize(inputHtml, { USE_PROFILES: { html: true } }).trim();
  if (sanitized) return sanitized;
  return '<p><em>No HTML content.</em></p>';
}

function getAttachmentHintStrings(attachment: Record<string, unknown>): string[] {
  const out: string[] = [];
  const pushString = (value: unknown): void => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (trimmed) out.push(trimmed);
  };

  pushString(attachment.sourceFormatCode);
  pushString(attachment.sourceFormatDisplay);
  pushString(attachment.sourceFormatSystem);
  pushString(attachment.sourceTypeCode);
  pushString(attachment.sourceTypeDisplay);
  pushString(attachment.sourceTypeSystem);
  pushString(attachment.sourceTypeText);
  if (Array.isArray(attachment.sourceProfiles)) {
    for (const profile of attachment.sourceProfiles) pushString(profile);
  }
  return out;
}

function inferXmlFlavorFromHints(hints: string[]): string | null {
  const joined = hints.join(' ').toLowerCase();
  if (
    joined.includes('ccda') ||
    joined.includes('clinicaldocument') ||
    joined.includes('urn:hl7-org:sdwg:ccda') ||
    joined.includes('2.16.840.1.113883.10.20.22')
  ) {
    return 'HL7 C-CDA (DocumentReference format)';
  }
  if (joined.includes('fhir+xml') || joined.includes('hl7.org/fhir')) {
    return 'FHIR XML (DocumentReference format)';
  }
  if (joined.includes('xds') || joined.includes('ihe')) {
    return 'IHE XDS XML (DocumentReference format)';
  }
  return null;
}

function summarizeAttachmentSourceFormat(attachment: Record<string, unknown>): string | null {
  const display = normalizeString(attachment.sourceFormatDisplay);
  const code = normalizeString(attachment.sourceFormatCode);
  const profile =
    Array.isArray(attachment.sourceProfiles) && typeof attachment.sourceProfiles[0] === 'string'
      ? normalizeString(attachment.sourceProfiles[0])
      : null;
  const base = display || code || profile;
  if (!base) return null;
  if (display && code && display.toLowerCase() !== code.toLowerCase()) {
    return truncateText(`${display} (${code})`, 120);
  }
  return truncateText(base, 120);
}

function detectXmlFlavor(xml: string, attachment?: Record<string, unknown>): string {
  const trimmed = xml.trimStart();
  const withoutDeclaration = trimmed.replace(/^<\?xml[^>]*>\s*/i, '');
  const hints = attachment ? getAttachmentHintStrings(attachment) : [];
  const hintedFlavor = inferXmlFlavorFromHints(hints);

  if (withoutDeclaration.includes('<ClinicalDocument') && withoutDeclaration.includes('urn:hl7-org:v3')) {
    return 'HL7 C-CDA (ClinicalDocument)';
  }
  if (withoutDeclaration.includes('<Bundle') && withoutDeclaration.includes('http://hl7.org/fhir')) {
    return 'FHIR XML (Bundle)';
  }
  if (withoutDeclaration.includes('<feed') && withoutDeclaration.includes('http://www.w3.org/2005/Atom')) {
    return 'Atom feed XML';
  }
  const rootMatch = withoutDeclaration.match(/^<([A-Za-z_][\w:.-]*)/);
  if (rootMatch && rootMatch[1]) {
    return hintedFlavor ? `${hintedFlavor} · <${rootMatch[1]}>` : `XML <${rootMatch[1]}>`;
  }
  if (hintedFlavor) return hintedFlavor;
  if (withoutDeclaration.includes('<') && withoutDeclaration.includes('xmlns=')) {
    return 'Namespaced XML';
  }
  return 'Generic XML';
}

function formatXmlForDisplay(xml: string): string {
  const compact = xml.replace(/>\s+</g, '><').trim();
  const withBreaks = compact.replace(/(>)(<)(\/*)/g, '$1\n$2$3');
  const lines = withBreaks.split('\n');
  let depth = 0;
  const out: string[] = [];
  for (const line of lines) {
    const token = line.trim();
    if (!token) continue;
    const isClosing = /^<\//.test(token);
    const isSelfClosing = /\/>$/.test(token) || /^<\?/.test(token) || /^<!/.test(token);
    if (isClosing) depth = Math.max(0, depth - 1);
    out.push(`${'  '.repeat(depth)}${token}`);
    if (!isClosing && !isSelfClosing && /^<[^!?][^>]*[^/]>\s*$/.test(token)) depth += 1;
  }
  return out.join('\n');
}

function attachmentMimePreferenceRank(contentType: string): number {
  const mime = contentType.toLowerCase();
  if (mime.includes('html') || mime.includes('xhtml')) return 0;
  if (mime.includes('rtf')) return 1;
  if (mime.includes('xml')) return 2;
  if (mime.startsWith('text/')) return 3;
  if (mime.includes('json')) return 4;
  return 5;
}

function normalizeAttachmentSources(attachments: ProcessedAttachment[]): AttachmentSourceGroup[] {
  return attachments;
}

function rtfToDisplayHtmlFallback(rtf: string): string {
  let text = rtf;
  text = text.replace(/\{\\fonttbl.*?\}|\{\\colortbl.*?\}|\{\\stylesheet.*?\}|\{\\info.*?\}/gs, '');
  text = text.replace(/\\u(\d+)\s*\\?\s?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  text = text.replace(/\\(par|pard|sect|page|line)\b\s*/g, '\n');
  text = text.replace(/\\tab\b\s*/g, '\t');
  text = text.replace(/\\[a-zA-Z]+(-?\d+)?\s?/g, '');
  text = text.replace(/[{}]/g, '');
  text = text.replace(/(\n\s*){3,}/g, '\n\n');
  text = text.replace(/[ \t]{2,}/g, ' ');
  text = text.trim();
  if (!text) return '<p><em>No RTF text content.</em></p>';
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replaceAll('\n', '<br/>')}</p>`)
    .join('');
  return paragraphs || `<p>${escapeHtml(text)}</p>`;
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

async function renderRtfToHtml(rtf: string): Promise<string> {
  const mod = await getRtfModule();
  const RTFJS = mod?.RTFJS;
  const WMFJS = mod?.WMFJS;
  const EMFJS = mod?.EMFJS;
  if (!RTFJS?.Document) throw new Error('RTFJS Document API unavailable');
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
  const html = container.innerHTML || '';
  if (!html.trim()) return '<p><em>No RTF content.</em></p>';
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function getAttachmentRenderModel(attachment: unknown): AttachmentRenderModel {
  if (!attachment || typeof attachment !== 'object') return { kind: 'text', text: null };
  const cached = ATTACHMENT_RENDER_CACHE.get(attachment as object);
  if (cached) return cached;

  const obj = attachment as Record<string, unknown>;
  const contentType = normalizeString(obj.contentType)?.toLowerCase() || '';
  const plaintext = typeof obj.contentPlaintext === 'string' ? obj.contentPlaintext : null;
  const base64 = typeof obj.contentBase64 === 'string' ? obj.contentBase64 : null;
  const decoded = base64 ? decodeBase64ToText(base64) : null;
  const candidate = decoded || plaintext || '';
  const hints = getAttachmentHintStrings(obj);
  const declaredHtml = contentType.includes('html') || contentType.includes('xhtml');
  const declaredRtf = contentType.includes('rtf');
  const declaredXml = contentType.includes('xml');
  const canRenderXml = Boolean(candidate) && declaredXml;
  const canRenderHtml = Boolean(candidate) && declaredHtml;
  const canRenderRtf = Boolean(candidate) && declaredRtf;

  let model: AttachmentRenderModel;
  if (canRenderRtf) {
    model = { kind: 'rtf', rtf: candidate };
  } else if (canRenderHtml) {
    model = { kind: 'html', html: sanitizeHtmlForDisplay(candidate) };
  } else if (canRenderXml) {
    const flavor = detectXmlFlavor(candidate, obj);
    if (flavor.toLowerCase().includes('c-cda') && plaintext) {
      model = { kind: 'text', text: plaintext, flavor };
    } else {
      model = {
        kind: 'xml',
        xml: formatXmlForDisplay(candidate),
        flavor,
      };
    }
  } else {
    model = {
      kind: 'text',
      text: plaintext ?? decoded ?? null,
    };
  }

  ATTACHMENT_RENDER_CACHE.set(attachment as object, model);
  return model;
}

function stringifyJson(value: unknown): string {
  try {
    if (value && typeof value === 'object') {
      const cached = JSON_STRING_CACHE.get(value as object);
      if (cached) return cached;
      const rendered = JSON.stringify(value, null, 2);
      JSON_STRING_CACHE.set(value as object, rendered);
      return rendered;
    }
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return `Unable to render JSON: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function sortResourceTypes(entries: Array<[string, any[]]>): Array<[string, any[]]> {
  return entries.sort(([a], [b]) => {
    const ai = MAIN_RESOURCE_TYPES.indexOf(a.toLowerCase());
    const bi = MAIN_RESOURCE_TYPES.indexOf(b.toLowerCase());
    const aRank = ai === -1 ? MAIN_RESOURCE_TYPES.length : ai;
    const bRank = bi === -1 ? MAIN_RESOURCE_TYPES.length : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.localeCompare(b);
  });
}

function sortResourceTypeNames(typeNames: string[]): string[] {
  return [...typeNames].sort((a, b) => {
    const ai = MAIN_RESOURCE_TYPES.indexOf(a.toLowerCase());
    const bi = MAIN_RESOURCE_TYPES.indexOf(b.toLowerCase());
    const aRank = ai === -1 ? MAIN_RESOURCE_TYPES.length : ai;
    const bRank = bi === -1 ? MAIN_RESOURCE_TYPES.length : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.localeCompare(b);
  });
}

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function getResourceTypeCounts(data: CachedFhirData): string[] {
  const entries = Object.entries(data.fhir || {})
    .filter(([, resources]) => Array.isArray(resources) && resources.length > 0) as Array<[string, any[]]>;
  return sortResourceTypes(entries).map(([resourceType, resources]) => `${resourceType}: ${resources.length}`);
}

function getPatientSnapshot(data: CachedFhirData): string[] {
  const fhir = data.fhir || {};
  const patientEntry = Object.entries(fhir).find(([resourceType]) => resourceType.toLowerCase() === 'patient');
  if (!patientEntry || !Array.isArray(patientEntry[1]) || patientEntry[1].length === 0) return [];
  const patient = patientEntry[1][0] || {};

  const lines: string[] = [];
  const name =
    (Array.isArray(patient.name) && patient.name.length > 0 && summarizeHumanName(patient.name[0])) ||
    normalizeString(patient.id);
  if (name) lines.push(`Name: ${name}`);

  const birthDate = normalizeString(patient.birthDate);
  if (birthDate) lines.push(`Birth date: ${birthDate}`);

  const gender = normalizeString(patient.gender);
  if (gender) lines.push(`Gender: ${gender}`);

  if (Array.isArray(patient.address) && patient.address.length > 0) {
    const address = patient.address[0];
    const line = Array.isArray(address?.line) ? address.line.join(' ') : normalizeString(address?.line) || '';
    const city = normalizeString(address?.city) || '';
    const state = normalizeString(address?.state) || '';
    const postal = normalizeString(address?.postalCode) || '';
    const merged = [line, city, state, postal].filter(Boolean).join(', ');
    if (merged) lines.push(`Address: ${merged}`);
  }

  if (Array.isArray(patient.telecom)) {
    const phone = patient.telecom.find((item: any) => item?.system === 'phone' || item?.system === 'fax');
    const email = patient.telecom.find((item: any) => item?.system === 'email');
    if (phone?.value) lines.push(`Phone: ${phone.value}`);
    if (email?.value) lines.push(`Email: ${email.value}`);
  }

  return lines.slice(0, 6);
}

function useProgressiveVisibleCount(total: number): number {
  const [visible, setVisible] = useState(() => Math.min(total, INITIAL_ROWS_PER_SECTION));

  useEffect(() => {
    setVisible((prev) => {
      if (total <= INITIAL_ROWS_PER_SECTION) return total;
      return prev > total ? total : Math.max(prev, INITIAL_ROWS_PER_SECTION);
    });
  }, [total]);

  useEffect(() => {
    if (visible >= total) return;
    let cancelled = false;
    let timeoutId: number | undefined;
    let idleId: number | undefined;

    const tick = () => {
      if (cancelled) return;
      setVisible((prev) => {
        if (prev >= total) return prev;
        return Math.min(total, prev + ROW_BATCH_SIZE);
      });
    };

    const schedule = () => {
      if (cancelled || visible >= total) return;
      if (typeof (globalThis as any).requestIdleCallback === 'function') {
        idleId = (globalThis as any).requestIdleCallback(tick, { timeout: 120 });
      } else {
        timeoutId = window.setTimeout(tick, 16);
      }
    };

    schedule();
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (idleId !== undefined && typeof (globalThis as any).cancelIdleCallback === 'function') {
        (globalThis as any).cancelIdleCallback(idleId);
      }
    };
  }, [visible, total]);

  return visible;
}

const TreeLines = memo(function TreeLines({ lines, keyPrefix }: { lines: StructuredTreeLine[]; keyPrefix: string }) {
  if (lines.length === 0) return null;
  return (
    <div className="browser-tree-block">
      <div className="browser-tree-title">Additional fields</div>
      <div className="browser-tree">
        {lines.map((line, lineIndex) => (
          <div
            key={`${keyPrefix}:line:${lineIndex}`}
            className={`browser-tree-line ${line.kind}${line.tone ? ` ${line.tone}` : ''}`}
            style={treeIndentStyle(line.depth)}
          >
            {line.kind === 'leaf' ? (
              <>
                <span className="browser-tree-label">{line.label}</span>
                <span className="browser-tree-sep">:</span>
                <span className="browser-tree-value">{line.value}</span>
              </>
            ) : (
              <span className={`browser-tree-group${line.tone === 'extension' ? ' browser-tree-group-ext' : ''}`}>{line.label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

const ResourceRows = memo(function ResourceRows({
  resources,
  typeKey,
  attachmentByResourceId,
}: {
  resources: any[];
  typeKey: string;
  attachmentByResourceId?: Map<string, AttachmentSourceGroup>;
}) {
  const visible = useProgressiveVisibleCount(resources.length);
  const visibleResources = resources.slice(0, visible);

  return (
    <div className="browser-resource-list">
      {visibleResources.map((resource, index) => {
        const resourceKey = `${typeKey}:${resource?.id || index}`;
        const resourceId = typeof resource?.id === 'string' ? resource.id : null;
        const attachmentSource = resourceId ? (attachmentByResourceId?.get(resourceId) || null) : null;
        return (
          <ResourceRow
            key={resourceKey}
            resource={resource}
            index={index}
            resourceKey={resourceKey}
            attachmentSource={attachmentSource}
          />
        );
      })}
      {visible < resources.length && (
        <div className="redaction-note">
          Rendering {visible.toLocaleString()} of {resources.length.toLocaleString()}…
        </div>
      )}
    </div>
  );
});

const ResourceRow = memo(function ResourceRow({
  resource,
  index,
  resourceKey,
  attachmentSource,
}: {
  resource: any;
  index: number;
  resourceKey: string;
  attachmentSource?: AttachmentSourceGroup | null;
}) {
  const [showJson, setShowJson] = useState(false);
  const summary = summarizeResource(resource, index);
  const formatted = showJson ? null : getFormattedResourceModel(resource);
  const fields = formatted?.fields ?? [];
  const remainingLines = formatted?.remainingLines ?? [];
  const jsonText = showJson ? stringifyJson(resource) : '';

  return (
    <div className="browser-resource-row" key={resourceKey}>
      <div className="browser-resource-row-head">
        <div className="browser-resource-title">{summary}</div>
      </div>
      <div className="browser-inline-actions">
        <div className="browser-view-toggle" role="tablist" aria-label="Resource view mode">
          <button
            className={`browser-view-option ${showJson ? '' : 'active'}`}
            onClick={() => setShowJson(false)}
            aria-pressed={!showJson}
          >
            Formatted
          </button>
          <button
            className={`browser-view-option ${showJson ? 'active' : ''}`}
            onClick={() => setShowJson(true)}
            aria-pressed={showJson}
          >
            JSON
          </button>
        </div>
      </div>
      {showJson ? (
        <pre className="browser-json">{jsonText}</pre>
      ) : (
        <>
          {fields.length > 0 && (
            <div className="browser-resource-fields">
              {fields.map((field, fieldIndex) => (
                <div className="browser-resource-field" key={`${resourceKey}:field:${field.label}:${fieldIndex}`}>
                  <span className="browser-resource-field-label">{formatFieldLabel(field.label)}</span>
                  <span className="browser-resource-field-value">{field.value}</span>
                </div>
              ))}
            </div>
          )}
          <TreeLines lines={remainingLines} keyPrefix={resourceKey} />
          {attachmentSource && (
            <div className="browser-section" style={{ marginTop: 10 }}>
              <div className="browser-section-title">Rendered Attachment</div>
              <AttachmentRow
                attachmentSource={attachmentSource}
                rowKey={`${resourceKey}:attachment`}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
});

const AttachmentRow = memo(function AttachmentRow({
  attachmentSource,
  rowKey,
}: {
  attachmentSource: AttachmentSourceGroup;
  rowKey: string;
}) {
  const [showJson, setShowJson] = useState(false);
  const [rtfHtml, setRtfHtml] = useState<string | null>(null);
  const [rtfLoading, setRtfLoading] = useState(false);
  const bestIndex = attachmentSource.bestEffortFrom;
  const selectedOriginal =
    bestIndex === null ? null : attachmentSource.originals[bestIndex] || null;
  const renderModel = showJson ? null : getAttachmentRenderModel(selectedOriginal);
  const plaintext = renderModel?.kind === 'text' ? renderModel.text : null;
  const rtfSource = renderModel?.kind === 'rtf' ? renderModel.rtf : null;
  const remainingAttachmentLines = showJson || !selectedOriginal ? [] : getFormattedAttachmentLines(selectedOriginal);
  const jsonText = showJson ? stringifyJson(attachmentSource) : '';

  useEffect(() => {
    if (showJson || !rtfSource) {
      setRtfLoading(false);
      setRtfHtml(null);
      return;
    }
    if (selectedOriginal && typeof selectedOriginal === 'object') {
      const cached = ATTACHMENT_RTF_HTML_CACHE.get(selectedOriginal as object);
      if (cached) {
        setRtfLoading(false);
        setRtfHtml(cached);
        return;
      }
    }

    let cancelled = false;
    setRtfLoading(true);
    setRtfHtml(null);
    void renderRtfToHtml(rtfSource)
      .then((html) => {
        if (cancelled) return;
        setRtfHtml(html);
        setRtfLoading(false);
        if (selectedOriginal && typeof selectedOriginal === 'object') {
          ATTACHMENT_RTF_HTML_CACHE.set(selectedOriginal as object, html);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRtfHtml(rtfToDisplayHtmlFallback(rtfSource));
        setRtfLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showJson, rtfSource, selectedOriginal]);

  return (
    <div className="browser-attachment" key={rowKey}>
      <div className="browser-inline-actions">
        <div className="browser-view-toggle" role="tablist" aria-label="Attachment view mode">
          <button
            className={`browser-view-option ${showJson ? '' : 'active'}`}
            onClick={() => setShowJson(false)}
            aria-pressed={!showJson}
          >
            Formatted
          </button>
          <button
            className={`browser-view-option ${showJson ? 'active' : ''}`}
            onClick={() => setShowJson(true)}
            aria-pressed={showJson}
          >
            JSON
          </button>
        </div>
      </div>

      {showJson ? (
        <pre className="browser-json">{jsonText}</pre>
      ) : (
        <>
          {!selectedOriginal ? (
            <div className="redaction-note" style={{ marginTop: 6 }}>
              No extracted attachment payload available.
            </div>
          ) : renderModel?.kind === 'html' ? (
            <iframe
              className="browser-attachment-html"
              sandbox=""
              srcDoc={renderModel.html}
              title="Attachment HTML"
            />
          ) : renderModel?.kind === 'rtf' ? (
            rtfLoading ? (
              <div className="redaction-note" style={{ marginTop: 6 }}>
                Rendering RTF…
              </div>
            ) : (
              <div
                className="browser-attachment-rich"
                dangerouslySetInnerHTML={{ __html: rtfHtml || '<p><em>No RTF content.</em></p>' }}
              />
            )
          ) : renderModel?.kind === 'xml' ? (
            <pre className="browser-xml">{renderModel.xml}</pre>
          ) : plaintext ? (
            <pre className="browser-plaintext">{plaintext}</pre>
          ) : (
            <div className="redaction-note" style={{ marginTop: 6 }}>
              No plaintext extraction available.
            </div>
          )}
          {remainingAttachmentLines.length > 0 && <TreeLines lines={remainingAttachmentLines} keyPrefix={rowKey} />}
        </>
      )}
    </div>
  );
});

export default function DataBrowserPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const connections = useRecordsStore((s) => s.connections);
  const loaded = useRecordsStore((s) => s.loaded);
  const loadConnections = useRecordsStore((s) => s.loadConnections);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dataByConnection, setDataByConnection] = useState<Record<string, CachedFhirData | null | undefined>>({});
  const [errorsByConnection, setErrorsByConnection] = useState<Record<string, string>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [selectedTypeFilters, setSelectedTypeFilters] = useState<Set<string>>(new Set());
  const [typeFiltersInitialized, setTypeFiltersInitialized] = useState(false);
  const [typeFiltersDirty, setTypeFiltersDirty] = useState(false);
  const lastAppliedSourceParamRef = useRef<string | null | undefined>(undefined);
  const requestedSourceId = useMemo(() => {
    const value = searchParams.get('source');
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [searchParams]);

  useEffect(() => {
    if (!loaded) void loadConnections();
  }, [loaded, loadConnections]);

  useEffect(() => {
    if (!loaded) return;
    const ids = connections.map((conn) => conn.id);
    setSelectedIds((prev) => {
      if (lastAppliedSourceParamRef.current !== requestedSourceId) {
        lastAppliedSourceParamRef.current = requestedSourceId;
        if (requestedSourceId && ids.includes(requestedSourceId)) {
          return sameStringSet(prev, [requestedSourceId]) ? prev : [requestedSourceId];
        }
      }
      const kept = prev.filter((id) => ids.includes(id));
      if (kept.length > 0) {
        return sameStringSet(prev, kept) ? prev : kept;
      }
      const withData = connections.filter((conn) => (conn.dataSizeBytes || 0) > 0).map((conn) => conn.id);
      const next = withData.length > 0 ? withData : ids;
      return sameStringSet(prev, next) ? prev : next;
    });
  }, [loaded, connections, requestedSourceId]);

  useEffect(() => {
    const idsToLoad = selectedIds.filter((id) => dataByConnection[id] === undefined && !loadingIds.has(id));
    if (idsToLoad.length === 0) return;

    let cancelled = false;
    setDataByConnection((prev) => {
      const next = { ...prev };
      for (const id of idsToLoad) {
        if (!(id in next)) next[id] = undefined;
      }
      return next;
    });
    setLoadingIds((prev) => {
      const next = new Set(prev);
      for (const id of idsToLoad) next.add(id);
      return next;
    });

    for (const id of idsToLoad) {
      void (async () => {
        try {
          const data = await getFhirData(id);
          if (cancelled) return;
          setDataByConnection((prev) => ({ ...prev, [id]: data }));
          setErrorsByConnection((prev) => {
            if (!(id in prev)) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
          });
        } catch (err) {
          if (cancelled) return;
          setDataByConnection((prev) => ({ ...prev, [id]: null }));
          setErrorsByConnection((prev) => ({
            ...prev,
            [id]: err instanceof Error ? err.message : String(err),
          }));
        } finally {
          setLoadingIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [selectedIds]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedConnections = useMemo(
    () => connections.filter((conn) => selectedSet.has(conn.id)),
    [connections, selectedSet],
  );
  const selectedLoadingCount = useMemo(() => {
    let count = 0;
    for (const id of selectedIds) {
      if (loadingIds.has(id)) count += 1;
    }
    return count;
  }, [selectedIds, loadingIds]);

  const availableResourceTypes = useMemo(() => {
    const buckets = new Map<string, { label: string; count: number }>();
    for (const conn of selectedConnections) {
      const data = dataByConnection[conn.id];
      if (data) {
        for (const [resourceType, resources] of Object.entries(data.fhir || {})) {
          if (!Array.isArray(resources) || resources.length === 0) continue;
          const key = resourceType.toLowerCase();
          const existing = buckets.get(key);
          if (existing) {
            existing.count += resources.length;
          } else {
            buckets.set(key, { label: resourceType, count: resources.length });
          }
        }
        continue;
      }
      const cachedCounts = conn.cachedResourceTypeCounts || {};
      for (const [resourceType, count] of Object.entries(cachedCounts)) {
        if (!count || count <= 0) continue;
        const key = resourceType.toLowerCase();
        const existing = buckets.get(key);
        if (existing) existing.count += count;
        else buckets.set(key, { label: resourceType, count });
      }
    }
    const ordered = sortResourceTypeNames(Array.from(buckets.values()).map((entry) => entry.label));
    return ordered
      .map((label) => {
        const key = label.toLowerCase();
        const entry = buckets.get(key);
        if (!entry) return null;
        return { key, label: entry.label, count: entry.count };
      })
      .filter((entry): entry is { key: string; label: string; count: number } => Boolean(entry));
  }, [selectedConnections, dataByConnection]);

  const availableContentFilters = availableResourceTypes;

  const availableTypeKey = useMemo(
    () => availableContentFilters.map((entry) => entry.key).join('|'),
    [availableContentFilters],
  );

  useEffect(() => {
    const keys = availableContentFilters.map((entry) => entry.key);
    setSelectedTypeFilters((prev) => {
      if (keys.length === 0) {
        if (selectedLoadingCount > 0) return prev;
        return new Set();
      }
      if (!typeFiltersInitialized || !typeFiltersDirty) return new Set(keys);
      if (prev.size === 0) return new Set();
      const next = new Set<string>();
      for (const key of prev) {
        if (keys.includes(key)) next.add(key);
      }
      if (next.size === 0) return new Set(keys);
      return next;
    });
    if (!typeFiltersInitialized && keys.length > 0) {
      setTypeFiltersInitialized(true);
    }
  }, [availableTypeKey, availableContentFilters, typeFiltersInitialized, typeFiltersDirty, selectedLoadingCount]);

  const selectAllSources = () => setSelectedIds(connections.map((conn) => conn.id));
  const selectNoSources = () => setSelectedIds([]);
  const selectAllTypes = () => {
    setSelectedTypeFilters(new Set(availableContentFilters.map((entry) => entry.key)));
    setTypeFiltersInitialized(true);
    setTypeFiltersDirty(true);
  };
  const selectNoTypes = () => {
    setSelectedTypeFilters(new Set());
    setTypeFiltersInitialized(true);
    setTypeFiltersDirty(true);
  };
  const toggleTypeFilter = (key: string) => {
    setSelectedTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setTypeFiltersDirty(true);
  };
  const handleToggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  return (
    <div className="page-top with-records-nav">
      <RecordsHeaderBar current="browser" />
      <div className="panel panel-wide">
        <div className="page-title">Data Browser</div>
        <div className="page-subtitle">
          Scan all connected records quickly with summary-first rendering and optional raw JSON.
        </div>

        <div className="browser-section-title" style={{ marginTop: 8 }}>Sources</div>
        <div className="browser-toolbar">
          <button className="link" onClick={selectAllSources} disabled={connections.length === 0}>All</button>
          <span className="sep">·</span>
          <button className="link" onClick={selectNoSources} disabled={selectedIds.length === 0}>None</button>
          <span className="browser-toolbar-note">
            {connections.length} source{connections.length === 1 ? '' : 's'} · {selectedIds.length} selected
          </span>
        </div>

        <div className="conn-list">
          {connections.map((conn) => {
            const checked = selectedSet.has(conn.id);
            return (
              <label key={conn.id} className={`conn-card${checked ? ' selected' : ''}`}>
                <input type="checkbox" checked={checked} onChange={() => handleToggle(conn.id)} />
                <div className="conn-body">
                  <div className="conn-name">{conn.patientDisplayName || conn.patientId}</div>
                  <div className="conn-meta">
                    {conn.providerName} · {fmtSize(conn.dataSizeBytes)} · fetched {fmtDate(conn.lastFetchedAt)}
                  </div>
                </div>
              </label>
            );
          })}
          {connections.length === 0 && <div className="redaction-empty">No connections yet.</div>}
        </div>

        {selectedConnections.length > 0 && (
          <>
            <div className="browser-section-title" style={{ marginTop: 12 }}>Content Types</div>
            <div className="browser-toolbar">
              <button className="link" onClick={selectAllTypes} disabled={availableContentFilters.length === 0}>All</button>
              <span className="sep">·</span>
              <button className="link" onClick={selectNoTypes} disabled={selectedTypeFilters.size === 0}>None</button>
              <span className="browser-toolbar-note">
                {availableContentFilters.length === 0 && selectedLoadingCount > 0
                  ? 'Discovering content types…'
                  : `${availableContentFilters.length} type${availableContentFilters.length === 1 ? '' : 's'} · ${selectedTypeFilters.size} selected`}
              </span>
            </div>
            {availableContentFilters.length > 0 && (
              <div className="browser-pillbar">
                {availableContentFilters.map((entry) => (
                  <button
                    key={`type-pill:${entry.key}`}
                    className={`browser-pill ${selectedTypeFilters.has(entry.key) ? 'active' : ''}`}
                    onClick={() => toggleTypeFilter(entry.key)}
                  >
                    {entry.label} ({entry.count})
                  </button>
                ))}
              </div>
            )}
            {availableContentFilters.length === 0 && selectedLoadingCount > 0 && (
              <div className="redaction-note">Scanning selected sources…</div>
            )}
          </>
        )}

        {selectedConnections.length === 0 ? (
          <div className="browser-empty">Select at least one source to browse data.</div>
        ) : (availableContentFilters.length === 0 && selectedLoadingCount > 0) ? (
          <div className="browser-empty">Loading content types…</div>
        ) : selectedTypeFilters.size === 0 ? (
          <div className="browser-empty">Select at least one content type to display.</div>
        ) : (
          <div className="browser-records">
            {selectedConnections.map((conn) => {
              const loading = loadingIds.has(conn.id);
              const loadError = errorsByConnection[conn.id];
              const data = dataByConnection[conn.id];

              if (loading || data === undefined) {
                return (
                  <div className="browser-record" key={conn.id}>
                    <div className="browser-record-title">{conn.patientDisplayName || conn.patientId}</div>
                    <div className="redaction-note">Loading cached data…</div>
                  </div>
                );
              }

              if (loadError) {
                return (
                  <div className="browser-record" key={conn.id}>
                    <div className="browser-record-title">{conn.patientDisplayName || conn.patientId}</div>
                    <div className="conn-error">{loadError}</div>
                  </div>
                );
              }

              if (!data) {
                return (
                  <div className="browser-record" key={conn.id}>
                    <div className="browser-record-title">{conn.patientDisplayName || conn.patientId}</div>
                    <div className="redaction-note">No cached data for this connection yet.</div>
                  </div>
                );
              }

              const resourceEntries = sortResourceTypes(
                Object.entries(data.fhir || {}).filter(([, resources]) => Array.isArray(resources) && resources.length > 0),
              );
              const attachmentSources = normalizeAttachmentSources(data.attachments);
              const filteredResourceEntries = resourceEntries.filter(([resourceType]) =>
                selectedTypeFilters.has(resourceType.toLowerCase()),
              );
              const selectedTypeKeySet = new Set(filteredResourceEntries.map(([resourceType]) => resourceType.toLowerCase()));
              const visibleAttachmentCount = attachmentSources.filter((source) =>
                selectedTypeKeySet.has((source.source.resourceType || '').toLowerCase()),
              ).length;
              const hasSelectedResourceTypeFilters = selectedTypeFilters.size > 0;
              const totalResources = filteredResourceEntries.reduce((sum, [, resources]) => sum + resources.length, 0);
              const patientSnapshot = getPatientSnapshot(data);
              const typeCounts = getResourceTypeCounts(data);

              return (
                <div className="browser-record" key={conn.id}>
                  <div className="browser-record-head">
                    <div>
                      <div className="browser-record-title">{conn.patientDisplayName || conn.patientId}</div>
                      <div className="browser-record-subtitle">
                        {conn.providerName} · fetched {fmtDate(data.fetchedAt)}
                      </div>
                    </div>
                    <div className="browser-counts">
                      <span className="redaction-chip">{filteredResourceEntries.length} resource types</span>
                      <span className="redaction-chip">{totalResources} resources</span>
                      <span className="redaction-chip">{visibleAttachmentCount} attachment sources</span>
                    </div>
                  </div>

                  {patientSnapshot.length > 0 && (
                    <div className="browser-section">
                      <div className="browser-section-title">Patient Snapshot</div>
                      <div className="browser-keyvals">
                        {patientSnapshot.map((line) => (
                          <div className="browser-keyval" key={`${conn.id}:snapshot:${line}`}>{line}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="browser-section">
                    <div className="browser-section-title">FHIR Resource Types</div>
                    <div className="browser-chips">
                      {typeCounts.length === 0
                        ? <span className="redaction-note">No resources found.</span>
                        : typeCounts.map((line) => <span className="redaction-chip" key={`${conn.id}:type:${line}`}>{line}</span>)}
                    </div>
                  </div>

                  {filteredResourceEntries.map(([resourceType, resources]) => {
                    const typeKey = `${conn.id}:${resourceType}`;
                    const typeAttachmentSources = attachmentSources.filter(
                      (source) => (source.source.resourceType || '').toLowerCase() === resourceType.toLowerCase(),
                    );
                    const attachmentByResourceId = new Map<string, AttachmentSourceGroup>();
                    for (const source of typeAttachmentSources) {
                      const id = source.source.resourceId;
                      if (!id || attachmentByResourceId.has(id)) continue;
                      attachmentByResourceId.set(id, source);
                    }

                    return (
                      <div className="browser-type-card" key={typeKey}>
                        <ResourceRows
                          resources={resources}
                          typeKey={typeKey}
                          attachmentByResourceId={attachmentByResourceId}
                        />
                      </div>
                    );
                  })}

                  {hasSelectedResourceTypeFilters && filteredResourceEntries.length === 0 && (
                    <div className="browser-empty">
                      No resources from selected types for this connection.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="actions-row">
          <button className="btn btn-secondary" onClick={() => nav('/records')}>
            Back to records
          </button>
        </div>
      </div>
    </div>
  );
}
