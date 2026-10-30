import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

export function resolvePath(value) {
  if (!value) throw new Error("缺少项目路径");
  return path.resolve(value);
}

export async function ensureDirectory(directory) {
  await mkdir(directory, { recursive: true });
  return directory;
}

export function normalizeRelative(root, filename) {
  return path.relative(root, filename).split(path.sep).join("/");
}

export function createId() {
  return BigInt(`0x${createHash("sha256").update(randomUUID()).digest("hex").slice(0, 15)}`)
    .toString(10);
}

export async function walk(directory, options = {}) {
  const excluded = new Set(options.excluded ?? []);
  const files = [];
  const directories = [];

  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (excluded.has(entry.name)) continue;
      const filename = path.join(current, entry.name);
      if (entry.isDirectory()) {
        directories.push(filename);
        await visit(filename);
      } else if (entry.isFile()) {
        files.push(filename);
      }
    }
  }

  if (!(await stat(directory)).isDirectory()) throw new Error(`${directory} 不是目录`);
  await visit(directory);
  return { files, directories };
}
