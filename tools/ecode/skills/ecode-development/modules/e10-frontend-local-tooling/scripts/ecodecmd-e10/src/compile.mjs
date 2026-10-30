import { readFile } from "node:fs/promises";
import path from "node:path";

import { walk } from "./common.mjs";
import { compileE10 } from "./compiler.mjs";

export async function compilePath(target) {
  const absolute = path.resolve(target);
  const files = absolute.endsWith(".js")
    ? [absolute]
    : (await walk(absolute, { excluded: ["resources", ".target", ".ecode-runtime", ".git"] }))
      .files.filter((filename) => filename.endsWith(".js"));
  for (const filename of files) {
    compileE10(await readFile(filename, "utf8"), filename);
  }
  return files;
}
