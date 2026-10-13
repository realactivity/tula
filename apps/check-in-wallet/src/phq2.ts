import type { FormAnswer } from "./types";

/** Synthetic PHQ-2 answers used by tests and the local demo autofill. */
export const SAMPLE_PHQ2_ANSWERS: FormAnswer[] = [
  {
    linkId: "phq2-1",
    text: "Little interest or pleasure in doing things",
    valueCoding: {
      system: "http://loinc.org",
      code: "LA6568-5",
      display: "Not at all",
    },
  },
  {
    linkId: "phq2-2",
    text: "Feeling down, depressed, or hopeless",
    valueCoding: {
      system: "http://loinc.org",
      code: "LA6568-5",
      display: "Not at all",
    },
  },
];
