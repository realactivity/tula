#!/usr/bin/env bun
/**
 * Build skill packages from partials.
 * 
 * Usage:
 *   bun skill/build-skill.ts agent [baseUrl]     # Build agent-initiated skill
 *   bun skill/build-skill.ts local [outputPath]  # Build local skill with data
 * 
 * The agent version is served at /skill.zip
 * The local version is generated in-browser with user's data
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';

const SKILL_DIR = dirname(import.meta.path);
const PARTIALS_DIR = join(SKILL_DIR, 'partials');
const REFERENCES_DIR = join(SKILL_DIR, 'health-record-assistant', 'references');
const SCRIPTS_DIR = join(SKILL_DIR, 'health-record-assistant', 'scripts');

// Partial order for each skill variant
const AGENT_PARTIALS = [
  'header.md',
  'when-to-use.md',
  'analysis-philosophy.md',
  'connect-agent.md',
  'data-structure.md',
  'fhir-guide.md',
  'guidelines.md',
  'testing.md',
];

const LOCAL_PARTIALS = [
  'header.md',
  'when-to-use.md',
  'analysis-philosophy.md',
  'connect-local.md',
  'data-structure.md',
  'fhir-guide.md',
  'guidelines.md',
];

function readPartial(name: string): string {
  const path = join(PARTIALS_DIR, name);
  if (!existsSync(path)) {
    throw new Error(`Partial not found: ${path}`);
  }
  return readFileSync(path, 'utf-8');
}

function buildSkillMd(partials: string[]): string {
  return partials.map(readPartial).join('\n');
}

export function buildAgentSkill(baseUrl: string): string {
  let content = buildSkillMd(AGENT_PARTIALS);
  content = content.replaceAll('{{BASE_URL}}', baseUrl);
  return content;
}

export function buildLocalSkill(): string {
  return buildSkillMd(LOCAL_PARTIALS);
}

/**
 * Build the agent skill zip file.
 * Returns the path to the built zip.
 */
export async function buildAgentSkillZip(baseUrl: string, outputDir: string): Promise<string> {
  const skillDir = join(outputDir, 'health-record-assistant');
  mkdirSync(join(skillDir, 'scripts'), { recursive: true });
  mkdirSync(join(skillDir, 'references'), { recursive: true });

  // Write SKILL.md
  const skillMd = buildAgentSkill(baseUrl);
  writeFileSync(join(skillDir, 'SKILL.md'), skillMd);

  // Copy scripts with URL replacement
  if (existsSync(SCRIPTS_DIR)) {
    for (const file of readdirSync(SCRIPTS_DIR)) {
      let content = readFileSync(join(SCRIPTS_DIR, file), 'utf-8');
      content = content.replaceAll('{{BASE_URL}}', baseUrl);
      writeFileSync(join(skillDir, 'scripts', file), content);
    }
  }

  // Copy references
  if (existsSync(REFERENCES_DIR)) {
    for (const file of readdirSync(REFERENCES_DIR)) {
      let content = readFileSync(join(REFERENCES_DIR, file), 'utf-8');
      content = content.replaceAll('{{BASE_URL}}', baseUrl);
      writeFileSync(join(skillDir, 'references', file), content);
    }
  }

  // Create zip
  const { $ } = await import('bun');
  const zipPath = join(outputDir, 'skill.zip');
  await $`cd ${outputDir} && zip -r skill.zip health-record-assistant/`;
  
  return zipPath;
}

/**
 * Build the local skill structure (for browser-side zip creation).
 * Returns the file structure as an object.
 */
export function buildLocalSkillStructure(): Record<string, string> {
  const files: Record<string, string> = {};
  
  // SKILL.md
  files['health-record-assistant/SKILL.md'] = buildLocalSkill();
  
  // References
  if (existsSync(REFERENCES_DIR)) {
    for (const file of readdirSync(REFERENCES_DIR)) {
      const content = readFileSync(join(REFERENCES_DIR, file), 'utf-8');
      files[`health-record-assistant/references/${file}`] = content;
    }
  }
  
  return files;
}

// CLI
if (import.meta.main) {
  const [variant, arg] = process.argv.slice(2);
  
  if (variant === 'agent') {
    if (!arg) {
      console.error('Error: baseUrl is required for agent variant');
      console.error('Usage: bun build-skill.ts agent <baseUrl>');
      process.exit(1);
    }
    console.log(buildAgentSkill(arg));
  } else if (variant === 'local') {
    console.log(buildLocalSkill());
  } else {
    console.error('Usage: bun build-skill.ts [agent|local] [baseUrl|outputPath]');
    process.exit(1);
  }
}
