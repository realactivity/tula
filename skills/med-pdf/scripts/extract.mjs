#!/usr/bin/env node
// extract.mjs - Extract text and rendered page images from a (medical) PDF.
//
// Usage:
//   node extract.mjs <input.pdf> [outDir] [--scale=2.0] [--text-only] [--images-only]
//
// Outputs into <outDir> (default: <input>.extracted/):
//   text.txt              - concatenated text from text-extractable PDFs
//   pageN.png             - rendered page images (for vision/OCR fallback)
//   pageN.text.txt        - per-page text
//   meta.json             - { numPages, hasText, fingerprint, source, ts }
//
// Strategy:
//   1) Try pdfjs-dist textContent extraction. If it yields enough characters
//      (>200 across the doc), we keep the text path.
//   2) Always render pages to PNG via @napi-rs/canvas so the image tool /
//      vision model can read forms, signatures, scanned reports, charts,
//      and MyChart/Epic PDFs that have outlined fonts (no extractable text).
//
// Notes:
//   - This is a workspace skill: written for OpenClaw's bundled pdfjs-dist
//     and @napi-rs/canvas under /usr/lib/node_modules/openclaw/node_modules.
//   - The image tool requires images under the workspace dir, so call this
//     with an outDir inside ~/.openclaw/workspace/.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const OPENCLAW_NM = '/usr/lib/node_modules/openclaw/node_modules';
const pdfjsLib = await import(`${OPENCLAW_NM}/pdfjs-dist/legacy/build/pdf.mjs`);
const { createCanvas } = await import(`${OPENCLAW_NM}/@napi-rs/canvas/index.js`);

function parseArgs(argv) {
  const positional = [];
  const flags = { scale: 2.0, textOnly: false, imagesOnly: false };
  for (const a of argv) {
    if (a.startsWith('--scale=')) flags.scale = parseFloat(a.slice(8));
    else if (a === '--text-only') flags.textOnly = true;
    else if (a === '--images-only') flags.imagesOnly = true;
    else positional.push(a);
  }
  return { positional, flags };
}

const { positional, flags } = parseArgs(process.argv.slice(2));
if (positional.length === 0) {
  console.error('Usage: extract.mjs <input.pdf> [outDir] [--scale=2.0] [--text-only] [--images-only]');
  process.exit(2);
}

const inputPath = path.resolve(positional[0]);
if (!fs.existsSync(inputPath)) {
  console.error(`Input not found: ${inputPath}`);
  process.exit(2);
}
const outDir = path.resolve(positional[1] || `${inputPath}.extracted`);
fs.mkdirSync(outDir, { recursive: true });

const data = new Uint8Array(fs.readFileSync(inputPath));
const fingerprint = crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(ctx, w, h) { ctx.canvas.width = w; ctx.canvas.height = h; }
  destroy(ctx) { ctx.canvas.width = 0; ctx.canvas.height = 0; ctx.canvas = null; ctx.context = null; }
}

const canvasFactory = new NodeCanvasFactory();
const pdf = await pdfjsLib.getDocument({
  data,
  disableFontFace: true,
  useSystemFonts: false,
  canvasFactory,
}).promise;

const meta = {
  source: inputPath,
  fingerprint,
  numPages: pdf.numPages,
  hasText: false,
  ts: new Date().toISOString(),
  pages: [],
};

let combinedText = '';

for (let p = 1; p <= pdf.numPages; p++) {
  const page = await pdf.getPage(p);

  // ---- Text extraction ----
  let pageText = '';
  if (!flags.imagesOnly) {
    try {
      const tc = await page.getTextContent();
      const lines = [];
      let lastY = null;
      let line = [];
      for (const item of tc.items) {
        const y = Math.round(item.transform[5]);
        const s = item.str;
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          lines.push(line.join(''));
          line = [];
        }
        line.push(s);
        if (item.hasEOL) {
          lines.push(line.join(''));
          line = [];
        }
        lastY = y;
      }
      if (line.length) lines.push(line.join(''));
      pageText = lines.join('\n').trim();
    } catch (e) {
      pageText = '';
    }
    if (pageText) {
      fs.writeFileSync(path.join(outDir, `page${p}.text.txt`), pageText);
      combinedText += `\n\n===== PAGE ${p} =====\n${pageText}`;
    }
  }

  // ---- Image rendering ----
  let imagePath = null;
  if (!flags.textOnly) {
    const viewport = page.getViewport({ scale: flags.scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    await page.render({ canvasContext: ctx, viewport, canvasFactory }).promise;
    imagePath = path.join(outDir, `page${p}.png`);
    fs.writeFileSync(imagePath, canvas.toBuffer('image/png'));
  }

  meta.pages.push({
    page: p,
    textChars: pageText.length,
    image: imagePath ? path.basename(imagePath) : null,
  });
}

const totalChars = combinedText.replace(/\s/g, '').length;
meta.hasText = totalChars > 200;

if (combinedText) fs.writeFileSync(path.join(outDir, 'text.txt'), combinedText.trimStart());
fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));

// Stdout summary
console.log(JSON.stringify({
  outDir,
  numPages: meta.numPages,
  hasText: meta.hasText,
  textChars: totalChars,
  pages: meta.pages,
  fingerprint,
}, null, 2));
