import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { ContentBlock } from "./types";

/**
 * Read a markdown file from /data/content/. Used ONLY for editable copy
 * (welcome banner text, disclaimer text). Never for clinical data - that
 * flows through the FHIR types in lib/data/types.ts.
 */
export function getContent(slug: string): ContentBlock {
  const filePath = path.join(process.cwd(), "data", "content", `${slug}.md`);
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  return {
    frontmatter: parsed.data,
    content: parsed.content,
  };
}
