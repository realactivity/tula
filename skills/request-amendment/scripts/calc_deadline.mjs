#!/usr/bin/env node
import process from "node:process";

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(raw) {
  if (!raw) {
    return null;
  }

  const parsed = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

const receiptDateRaw = process.argv[2];
const receiptDate = parseIsoDate(receiptDateRaw);

if (receiptDateRaw && !receiptDate) {
  console.error(
    JSON.stringify(
      {
        error: "Invalid date. Use ISO format YYYY-MM-DD.",
        received: receiptDateRaw
      },
      null,
      2
    )
  );
  process.exit(1);
}

if (!receiptDate) {
  console.log(
    JSON.stringify(
      {
        deadlineStart: null,
        initialDeadline: null,
        extensionEligible: true,
        extensionDeadline: null,
        notes: [
          "Deadline starts on provider receipt date.",
          "Record both submission date and confirmed provider receipt date."
        ]
      },
      null,
      2
    )
  );
  process.exit(0);
}

const initialDeadline = addDays(receiptDate, 60);
const extensionDeadline = addDays(initialDeadline, 30);

console.log(
  JSON.stringify(
    {
      deadlineStart: toIsoDate(receiptDate),
      initialDeadline: toIsoDate(initialDeadline),
      extensionEligible: true,
      extensionDeadline: toIsoDate(extensionDeadline),
      notes: [
        "If an extension is used, provider should send written delay notice within the original 60-day window.",
        "One extension only."
      ]
    },
    null,
    2
  )
);
