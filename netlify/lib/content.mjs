/* The content the API renders with: what ops/build.mjs wrote to .build/server.json (asset names,
 * site content, the shipped form definitions). Bundled into the function, so the API renders a
 * page with exactly the stylesheet and scripts of the build it shipped with. Tests may install
 * their own. */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const FILE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..", ".build", "server.json");
let content = null;

export function serverContent() {
  if (!content) {
    if (!fs.existsSync(FILE)) throw Object.assign(new Error("Run the build first: .build/server.json is missing."), { code: "config.missing" });
    content = JSON.parse(fs.readFileSync(FILE, "utf8"));
  }
  return content;
}

export function useContent(c) { content = c; }
