#!/usr/bin/env bun
/**
 * Package the Claude skill as a .zip file.
 * Builds SKILL.md from partials, includes scripts and references.
 */

import { existsSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { $ } from "bun";
import { buildAgentSkill } from "../skill/build-skill";

const PROJECT_DIR = dirname(dirname(import.meta.path));
const SKILL_DIR = join(PROJECT_DIR, "skill", "health-record-assistant");
const OUTPUT_ZIP = join(PROJECT_DIR, "skill", "health-record-assistant.zip");

// Default base URL for static builds (CI/artifacts)
const DEFAULT_BASE_URL = "https://health-skillz.joshuamandel.com";

async function main() {
  // Build SKILL.md from partials
  const baseUrl = process.env.BASE_URL || DEFAULT_BASE_URL;
  console.log(`Building skill with base URL: ${baseUrl}`);
  
  const skillMd = buildAgentSkill(baseUrl);
  writeFileSync(join(SKILL_DIR, "SKILL.md"), skillMd);
  console.log("✓ Built SKILL.md from partials");

  // Remove old zip if exists
  if (existsSync(OUTPUT_ZIP)) {
    await $`rm ${OUTPUT_ZIP}`;
  }

  // Create zip with SKILL.md, scripts/, and references/
  console.log("Packaging skill...");
  await $`cd ${SKILL_DIR} && zip -r ${OUTPUT_ZIP} SKILL.md scripts/ references/`;

  console.log(`\n✓ Created ${OUTPUT_ZIP}`);
}

main().catch(console.error);
