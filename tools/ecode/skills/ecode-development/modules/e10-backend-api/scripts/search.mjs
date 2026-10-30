#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REFERENCES_DIR = path.join(SKILL_DIR, "references");
const MAX_RESULTS = 3;
const MAX_BYTES = 12288;

function normalize(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\n[\s\S]*?\n---\n+/, "");
}

function title(markdown, filename) {
  return (
    markdown.match(/^title:\s*(.+)$/m)?.[1]?.trim()?.replace(/^"|"$/g, "") ||
    markdown.match(/^#\s+(.+)$/m)?.[1] ||
    filename
  );
}

async function documents() {
  const entries = [];
  for (const filename of (await readdir(REFERENCES_DIR)).filter((name) => name.endsWith(".md")).sort()) {
    const markdown = await readFile(path.join(REFERENCES_DIR, filename), "utf8");
    entries.push({
      id: filename.replace(/\.md$/, ""),
      title: title(markdown, filename),
      markdown,
      searchText: normalize(markdown),
    });
  }
  return entries;
}

function section(markdown, wanted) {
  const body = stripFrontmatter(markdown);
  if (!wanted || wanted === "all") return markdown;
  if (wanted === "summary") {
    const heading = body.match(/^# .+$/m)?.[0] || `# ${title(markdown, "文档")}`;
    const headings = [...body.matchAll(/^#{2,6}\s+(.+)$/gm)].map((match) => `- ${match[1]}`);
    const firstText = body
      .replace(/```[\s\S]*?```/g, "")
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#") && !line.startsWith("|") && line !== "---");
    return `${heading}\n\n${firstText || ""}\n\n## 章节\n\n${headings.join("\n")}`.trimEnd();
  }
  const normalized = normalize(wanted);
  const headings = [...body.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({
    level: match[1].length,
    title: match[2],
    start: match.index,
  }));
  const match = headings.find((item) => normalize(item.title).includes(normalized));
  if (!match) return "";
  const next = headings.find((item) => item.start > match.start && item.level <= match.level);
  return body.slice(match.start, next?.start ?? body.length);
}

function truncate(content) {
  if (Buffer.byteLength(content) <= MAX_BYTES) return content.trimEnd();
  return `${Buffer.from(content).subarray(0, MAX_BYTES - 80).toString("utf8").trimEnd()}\n\n[内容已截断]\n`;
}

function options(args) {
  const positional = [];
  let sectionName = "summary";
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--section") sectionName = args[++index];
    else positional.push(args[index]);
  }
  return { positional, sectionName };
}

async function main() {
  const [command = "help", ...args] = process.argv.slice(2);
  const { positional, sectionName } = options(args);
  const entries = await documents();
  if (command === "search") {
    const terms = normalize(positional.join(" ")).split(" ").filter(Boolean);
    const matches = entries
      .map((entry) => ({ ...entry, score: terms.filter((term) => entry.searchText.includes(term)).length }))
      .filter((entry) => entry.score)
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_RESULTS);
    for (const entry of matches) console.log(`- ${entry.id} | ${entry.title} | score=${entry.score}`);
    if (!matches.length) console.log("未找到匹配文档。");
    return;
  }
  if (command === "load") {
    const entry = entries.find((item) => item.id === positional[0]);
    if (!entry) throw new Error(`未找到文档：${positional[0]}`);
    const content = section(entry.markdown, sectionName);
    if (!content) throw new Error(`${entry.id} 不含章节：${sectionName}`);
    console.log(truncate(content));
    return;
  }
  console.log("Usage: search <关键词> | load <文档 ID> [--section summary|章节名|all]");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
