#!/usr/bin/env node
// test-classify.mjs — Quick validation of Phase C classifier against real traces.

import { classify, classifyFromMetadata } from './classify.mjs';

const tests = [
  {
    name: 'Health report (Withings PDF)',
    input: {
      subject: 'Health report',
      fromAddress: 'pswider@realactivity.com',
      bodyPreview: 'Your Withings health report',
      attachments: [{ name: 'medical_report.PDF' }]
    },
    expectedRoute: 'med-pdf'
  },
  {
    name: 'Garmin scale data (image)',
    input: {
      subject: 'Garmin scale data',
      fromAddress: 'pswider@realactivity.com',
      attachments: [{ name: '6815.jpg' }]
    },
    expectedRoute: 'wearable-ingest'
  },
  {
    name: 'Generic lab PDF',
    input: {
      subject: 'Lab results - June 2026',
      attachments: [{ name: 'lab-report.pdf' }]
    },
    expectedRoute: 'med-pdf'
  },
  {
    name: 'Unknown email',
    input: {
      subject: 'Your order has shipped',
      attachments: [{ name: 'receipt.pdf' }]
    },
    expectedRoute: 'med-pdf'  // conservative default for any PDF in health mailbox
  },
  {
    name: 'CVS prescription screenshot (common portal capture)',
    input: {
      subject: 'CVS - your prescription is ready',
      fromAddress: 'pswider@realactivity.com',
      attachments: [{ name: 'cvs_rx_screenshot.png' }]
    },
    expectedRoute: 'med-pdf'
  },
  {
    name: 'Cell phone photo of skin bump (personal health capture)',
    input: {
      subject: 'this bump on my arm',
      fromAddress: 'pswider@realactivity.com',
      bodyPreview: 'took a picture with my phone, what do you think',
      attachments: [{ name: 'IMG_4821.jpg' }]
    },
    expectedRoute: 'med-pdf'
  },
  {
    name: 'Weight export CSV (Garmin/Withings style)',
    input: {
      subject: 'Data',
      fromAddress: 'pswider@realactivity.com',
      attachments: [{ name: 'Weight.csv' }]
    },
    expectedRoute: 'wearable-ingest'
  }
];

console.log('=== Phase C Classifier Tests ===\n');

let passed = 0;
for (const t of tests) {
  const result = classify(t.input);
  const ok = result.route === t.expectedRoute;
  if (ok) passed++;

  console.log(`${ok ? '✓' : '✗'} ${t.name}`);
  console.log(`  route: ${result.route} (expected ${t.expectedRoute})`);
  console.log(`  confidence: ${result.confidence}`);
  console.log(`  reason: ${result.reason}`);
  console.log('');
}

console.log(`Result: ${passed}/${tests.length} passed`);

// Bonus: demonstrate classifyFromMetadata shape (as used after materialization)
console.log('\n--- classifyFromMetadata example (Health report) ---');
const meta = {
  subject: 'Health report',
  from: { address: 'pswider@realactivity.com' },
  bodyPreview: '',
  attachments: [{ name: 'medical_report.PDF' }]
};
const res = classifyFromMetadata(meta, meta.attachments);
console.log(res);
